# AGENTS.md - Agent Coding Guidelines

## Project Overview
This is **UsageReader**, a Wails v2 application that imports utility bill images with bar graphs, allowing users to click on graph points to read usage values. Built with Go (backend) and vanilla JavaScript (frontend).

## Build Commands

### Development
```bash
# Run in development mode with hot reload
wails dev

# Build for production
wails build

# Build with verbose output
wails build -v 2
```

### Go Commands
```bash
# Build Go binary only (no frontend)
# Wails requires the desktop and production build tags to run
go build -tags desktop,production -o UsageReader .

# Run Go tests
go test ./...

# Run a single test
go test -run TestName ./...

# Format Go code
go fmt ./...

# Vet Go code
go vet ./...
```

### Frontend
```bash
cd frontend

# No package.json - vanilla JS/CSS only
# Frontend is served from frontend/dist/ in production
```

### Build Tags

Wails injects the required build tags (`desktop` and `production` for production,
`desktop` and `dev` for development) when you use `wails build` or `wails dev`.
If you build directly with `go build`, you must pass those tags yourself, otherwise
the resulting binary will print the error:

```
Error: Wails applications will not build without the correct build tags.
```

For production builds, use: `go build -tags desktop,production -o UsageReader .`

### Platform-Specific Builds

Platform-specific code is isolated in files tagged with `//go:build linux` or
`//go:build windows`. Common Wails options and the platform interface live in
`main.go` and `platform.go`.

```bash
# Linux (default on Linux hosts)
go build -tags desktop,production -o UsageReader .

# Windows cross-compile from Linux (requires a Windows C toolchain / CGO)
GOOS=windows GOARCH=amd64 CGO_ENABLED=1 go build -tags desktop,production -o UsageReader.exe .
```

The `robotgo` and `gohook` dependencies used for hotkeys and automated typing
require CGO, so Windows builds must be produced on Windows or with a suitable
MinGW-w64 cross-compiler.

## Code Style Guidelines

### Go Code
- **Formatting**: Use `go fmt` - no custom configuration
- **Imports**: Group as: 1) Standard library, 2) Third-party (separate with blank line)
- **Naming**:
  - `CamelCase` for exported identifiers (methods, types)
  - `camelCase` for unexported identifiers
  - `ALL_CAPS` for constants only when needed
- **Error Handling**: Return errors explicitly, wrap with context using `fmt.Errorf("...: %w", err)`
- **Comments**: Start with exported name for public functions (`// FunctionName does...`)
- **Struct Tags**: Use `json:"field_name"` for JSON serialization

### JavaScript Code
- Use ES6+ features (const/let, arrow functions)
- Async/await preferred over callbacks
- State management in a central `appState` object
- DOM manipulation uses standard methods (no framework)

### CSS
- BEM-like naming (e.g., `.perspective-controls-ui`)
- Flexbox for layouts
- CSS custom properties not currently used

## Project Structure

```
/
├── main.go              # Main Go backend with Wails bindings
├── platform.go          # Platform interface for OS-specific behavior
├── platform_linux.go    # Linux implementation (build tag: linux)
├── platform_windows.go  # Windows implementation (build tag: windows)
├── wails.json           # Wails configuration
├── go.mod/go.sum        # Go dependencies
├── frontend/
│   ├── app.js           # Frontend application logic
│   ├── style.css        # Styling
│   ├── dist/            # Production frontend assets
│   └── wailsjs/         # Wails generated bindings
└── build/               # Build output
```

## Wails Binding Conventions

Methods exposed to frontend:
```go
// Go backend method
func (a *App) MethodName(param Type) (ReturnType, error) {
    // Implementation
}
```

Called from JavaScript:
```javascript
const result = await window.go.main.App.MethodName(param);
```

## Key Patterns

### State Management (Go)
- App struct holds all application state
- Methods receive `*App` receiver
- Thread-safe operations where needed (use `sync.WaitGroup` for parallel processing)

### Event System
```javascript
// Emit from Go
wailsruntime.EventsEmit(a.ctx, "event-name", data)

// Listen in JS
window.runtime.EventsOn('event-name', (data) => { ... });
```

### Error Handling
- Go: Always return `(result, error)` from exported methods
- JS: Wrap Go calls in try/catch

## Testing

**Currently no tests exist.** When adding tests:
```bash
# Create test file
go test ./...
go test -v ./...
go test -run TestSpecific ./...
```

## Dependencies

### Go (main deps)
- `github.com/wailsapp/wails/v2` - Wails framework
- Standard library: `image`, `image/png`, `bytes`, `context`, `sync`

### Frontend
- Vanilla JavaScript (no build step)
- No external JS libraries

## Development Workflow

1. Start dev server: `wails dev`
2. Edit Go code → auto-reloads
3. Edit JS/CSS → auto-reloads
4. Test perspective transform with sample images
5. Build: `wails build`

## Linting

No linting config exists. Use standard Go tools:
```bash
go fmt ./...
go vet ./...
```

For stricter linting, install `golangci-lint`:
```bash
golangci-lint run
```

## Notes

- Application uses parallel goroutines for image processing (32-row chunks)
- Perspective transform uses homography matrix calculations
- No database - state is in-memory only
- Cross-platform target: Linux (primary), Windows supported via build tags
- Platform-specific behavior (screen reference height, global hotkeys, automated typing) is isolated in `platform_linux.go` and `platform_windows.go`
