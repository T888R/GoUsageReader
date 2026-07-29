package main

// platform abstracts OS-specific behavior for screen dimensions, global
// hotkey handling, and automated typing/pasting.
//
// In the Wails architecture click coordinates are provided by the frontend,
// so cursor position is not obtained at the OS level. The reference height
// returned by referenceHeight is used to translate those frontend Y
// coordinates into the graph coordinate space.
type platform interface {
	// referenceHeight returns the height used to translate frontend Y
	// coordinates. On Linux this is the application window height. On
	// Windows this is the largest display height.
	referenceHeight(windowHeight int) int

	// startHotkeyListener registers the global paste hotkey and blocks until
	// stopChan is closed.
	startHotkeyListener(app *App, stopChan <-chan struct{})

	// typeValues pastes the supplied monthly values into the focused
	// application, handling zero values as configured for the platform.
	typeValues(values []string) error
}
