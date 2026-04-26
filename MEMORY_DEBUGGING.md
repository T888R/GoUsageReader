# Memory Debugging and Performance Guide for UsageReader

This guide helps you monitor and debug memory usage in the UsageReader Wails application to ensure it remains stable during extended use (multiple hours).

## Quick Start - Memory Monitoring

### 1. Built-in Memory Monitoring

The application now includes automatic memory monitoring that runs every 60 seconds:

```javascript
// In the browser console (Ctrl+Shift+I in the app)
await getMemoryReport();          // Get full memory report
await forceBackendGC();           // Force garbage collection
await getBackendMemoryStats();    // Get Go backend stats only
getFrontendMemoryInfo();          // Get JavaScript heap info (Chrome/Edge only)
await cleanupMemory();            // Run memory cleanup
```

### 2. Automatic Alerts

The app will automatically:
- Monitor memory every 60 seconds
- Show a notification if memory exceeds 500MB
- Attempt automatic cleanup when high memory is detected
- Log memory stats to console every 5 minutes

## Memory Leak Debugging Tools

### Go Backend Debugging

#### Method 1: Runtime Memory Stats (Built-in)

The app exposes these Go methods to the frontend:

```go
// Get current memory statistics
GetMemoryStats() map[string]interface{}

// Returns:
// - alloc: bytes allocated and not yet freed
// - totalAlloc: total bytes allocated (even if freed)
// - sys: total bytes obtained from OS
// - numGC: number of completed GC cycles
// - heapAlloc: heap allocated bytes
// - heapSys: heap obtained from OS
// - goroutines: number of goroutines
```

#### Method 2: Force Garbage Collection

```javascript
// Force immediate GC and see results
const result = await forceBackendGC();
console.log(`Freed ${result.heapFreed / 1024 / 1024}MB`);
```

#### Method 3: Set Memory Limit (Go 1.19+)

```javascript
// Set memory limit to 1GB (Go will try to stay under this)
await window.go.main.App.SetMemoryLimit(1024);

// Remove limit
await window.go.main.App.SetMemoryLimit(0);
```

### Frontend (JavaScript) Debugging

#### Method 1: Chrome DevTools Memory Tab

1. Run the app with debug mode: `wails dev`
2. Open DevTools with Ctrl+Shift+I
3. Go to **Memory** tab
4. Take heap snapshots:
   - Click "Take snapshot" 
   - Use the app normally for a while
   - Take another snapshot
   - Compare to identify leaks

#### Method 2: Performance Monitor

In Chrome DevTools:
1. Press Ctrl+Shift+P
2. Type "Performance Monitor"
3. Watch:
   - JS heap size
   - DOM nodes
   - Event listeners
   - These should remain relatively stable

#### Method 3: Record Memory Timeline

1. DevTools → Performance tab
2. Click record (circle button)
3. Use app for 30-60 seconds
4. Stop recording
5. Look for continuously increasing memory lines

## Known Memory Considerations

### Large Image Data

**Current behavior:**
- Image data stored as base64 data URLs in `appState.originalImageBlob`
- Can be large (several MB for high-res images)
- Cleared on Reset/ResetPerspective

**To minimize:**
```javascript
// Manually clear when done with an image
cleanupImageData();  // Already called on reset
```

### Canvas Elements

**Current behavior:**
- Created for perspective preview and image processing
- Automatically cleaned up when disabled
- May leak if not properly disposed

**What's already in place:**
- `srcCanvas.width = 0; srcCanvas.height = 0;` after use
- Canvas elements removed from DOM when not needed
- Reusable `rotationCanvas` for crop preview

### Event Listeners

**Current behavior:**
- Added for crop, perspective, and UI interactions
- Most are cleaned up when modes are disabled

**Check for leaks:**
- Open DevTools → Elements → Event Listeners
- Should not accumulate listeners over time

### Go Routines

**Current behavior:**
- Global hotkey listener runs continuously
- Memory monitoring runs every 30 seconds
- Image processing uses parallel goroutines (cleaned up after use)

**What's fixed:**
- Hotkey listener now has proper shutdown channel
- Goroutines properly exit on app shutdown

## Wails Memory Management Options

### WebView GPU Policy

In `main.go`, the GPU policy is set:

```go
Linux: &linux.Options{
    WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
}
```

**Options:**
- `WebviewGpuPolicyAlways` - Use GPU (better performance, more memory)
- `WebviewGpuPolicyNever` - Software rendering (less memory, slower)

To reduce memory usage, change to:
```go
WebviewGpuPolicy: linux.WebviewGpuPolicyNever
```

### WebView Options (Wails v2)

Add to `wails.json` or main.go:

```go
// In main() function, before wails.Run()
options.App{
    // ... other options ...
    
    // Disable GPU for lower memory usage (Linux)
    Linux: &linux.Options{
        WebviewGpuPolicy: linux.WebviewGpuPolicyNever,
    },
    
    // Disable inspector in production (saves some memory)
    Debug: options.Debug{
        OpenInspectorOnStartup: false,
    },
}
```

## Profiling for Extended Sessions

### Long-Running Test Protocol

To verify no memory leaks over hours:

1. **Prepare:**
```bash
# Build production version
wails build

# Run with memory logging
./build/bin/UsageReader &
```

2. **Monitor (in browser console):**
```javascript
// Run this every 10 minutes
setInterval(async () => {
    const report = await getMemoryReport();
    console.log(`${new Date().toISOString()}, ${report.frontend?.usedMB || 0}, ${report.backend?.heapAlloc / 1024 / 1024 || 0}`);
}, 600000);
```

3. **Expected behavior:**
   - Memory should plateau after initial image load
   - Should not continuously increase
   - GC should periodically reduce memory

4. **Red flags:**
   - Memory increases without loading new images
   - GC doesn't reduce memory over time
   - DOM nodes continuously increasing

### Stress Testing

```javascript
// Simulate heavy usage
async function stressTest() {
    for (let i = 0; i < 50; i++) {
        // Toggle perspective mode
        perspectiveToggle.click();
        await new Promise(r => setTimeout(r, 500));
        perspectiveToggle.click();
        
        // Import same image repeatedly
        fileInput.files = fileInput.files;
        
        // Check memory every 10 iterations
        if (i % 10 === 0) {
            await getMemoryReport();
        }
    }
}

// Run stress test
stressTest();
```

## Memory Optimization Tips

### 1. Image Handling

**Current:** Images stored as base64 data URLs

**Optimization opportunities:**
- Consider storing only the original image, not multiple copies
- Limit maximum image size
- Use WebP format for smaller size

### 2. Canvas Reuse

Already implemented:
- `rotationCanvas` is reused for crop preview rotations
- Preview canvas reused for perspective transforms

### 3. Periodic Cleanup

The app now automatically:
- Forces GC after image operations
- Monitors memory usage
- Alerts on high memory

### 4. Memory Limit

Set a reasonable memory limit in your workflow:

```javascript
// At app startup, set 1GB limit
await window.go.main.App.SetMemoryLimit(1024);
```

## Troubleshooting Common Issues

### Issue: Memory keeps growing

**Diagnose:**
```javascript
// Check what's holding references
await getMemoryReport();

// Look at DOM nodes
console.log('DOM nodes:', document.getElementsByTagName('*').length);

// Check event listeners
console.log('Event listeners:', getEventListeners(document).length);
```

**Solutions:**
1. Call `cleanupMemory()` to force cleanup
2. Check for detached DOM nodes in DevTools
3. Verify event listeners are being removed
4. Restart the app (workaround)

### Issue: Image processing uses too much memory

**Current protections:**
- Parallel processing uses 32-row chunks
- Source image reference cleared after processing
- `runtime.GC()` called after transformations

**If still an issue:**
- Reduce `chunkSize` from 32 to 16 in `ApplyPerspectiveTransformParallel`
- This uses less concurrent memory but is slower

### Issue: Frontend memory high

**Check:**
```javascript
// 1. Image data size
console.log('Image data size:', appState.originalImageBlob?.length / 1024 / 1024, 'MB');

// 2. Canvas count
document.querySelectorAll('canvas').length;

// 3. Detached DOM nodes (DevTools → Memory → Heap snapshot → Containment)
```

**Fix:**
```javascript
// Clear when done
await resetAll(); // This calls cleanupImageData()
```

## Recommended Monitoring Setup

For production monitoring, add to your workflow:

1. **Visual indicator:** Add to UI showing memory usage
2. **Log to file:** Export memory reports periodically
3. **Alert threshold:** Notify user if memory > 1GB
4. **Auto-restart:** Consider restarting app if memory > 2GB (extreme case)

## Summary of Memory-Safe Practices Already in Place

✅ **Go Backend:**
- `runtime.GC()` called after large operations
- `debug.FreeOSMemory()` forces OS memory release
- Image data explicitly set to `nil` when done
- Goroutines have proper shutdown channels
- Memory monitoring with automatic alerts

✅ **Frontend:**
- Canvas elements cleaned up after use
- Image data cleared on reset
- Event listeners removed when disabling modes
- Reusable canvas for rotations
- Automatic memory monitoring

✅ **Build:**
- Production build strips debug symbols
- Embedded assets (no file watching)

## Additional Resources

- [Go Memory Model](https://go.dev/ref/mem)
- [Wails v2 Documentation](https://wails.io/docs/introduction)
- [Chrome DevTools Memory](https://developer.chrome.com/docs/devtools/memory/)

## Getting Help

If you encounter memory issues:

1. Run `getMemoryReport()` and save the output
2. Take heap snapshot in DevTools
3. Check if issue reproduces with same image/workflow
4. File an issue with memory report and reproduction steps
