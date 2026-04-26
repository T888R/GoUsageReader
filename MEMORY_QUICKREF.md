# Memory Debugging Quick Reference

## What Was Added

### 1. Go Backend Changes (`main.go`)

**New imports:**
- `runtime/debug` - For memory limit and FreeOSMemory

**New App struct fields:**
- `memStats` - Stores memory statistics
- `lastMemCheck` - Last check timestamp
- `hotkeyStopChan` - Channel for clean goroutine shutdown

**New methods exposed to frontend:**
```go
GetMemoryStats() map[string]interface{}          // Get current memory usage
ForceGarbageCollection() map[string]interface{}  // Force GC and report
SetMemoryLimit(limitMB int64) int64              // Set memory limit (0 = unlimited)
StartMemoryMonitoring()                          // Background monitoring
```

**Memory-safe improvements:**
- Hotkey listener now properly stops on shutdown
- OnShutdown clears image data and forces GC
- Automatic memory monitoring every 30 seconds

### 2. Frontend Changes (`app.js`)

**New functions:**
```javascript
getMemoryReport()          // Full memory report
forceBackendGC()           // Force Go garbage collection
getFrontendMemoryInfo()    // Browser heap info
getBackendMemoryStats()    // Go memory stats
cleanupMemory()            // Run cleanup routines
startMemoryMonitoring()    // Start periodic checks
```

**Automatic features:**
- Memory monitoring every 60 seconds
- Automatic alerts if memory > 500MB
- Memory cleanup when high usage detected
- Console logging every 5 minutes

### 3. UI Changes

**New memory status bar** (bottom of the container):
- Shows current memory usage
- Color-coded: green (<500MB), yellow (500-1000MB), red (>1000MB)
- 🗑️ Button - Force garbage collection
- 📊 Button - Toggle memory monitoring display

### 4. Build Optimization (`wails.json`)

Added build flags for smaller binary:
```json
"build": {
  "ldflags": "-s -w",
  "compressionLevel": 9
}
```

## How to Use

### During Development

1. **Run with hot reload:**
   ```bash
   wails dev
   ```

2. **Open DevTools:** Ctrl+Shift+I

3. **Check memory in console:**
   ```javascript
   await getMemoryReport()
   ```

### Memory Monitoring

**In the app:**
- Click 📊 button to toggle memory display
- Watch for color changes (yellow/red = high memory)
- Click 🗑️ to force garbage collection

**In console:**
```javascript
// Get full report
await getMemoryReport()

// Force GC
await forceBackendGC()

// Check just frontend
getFrontendMemoryInfo()

// Check just backend
await getBackendMemoryStats()

// Run cleanup
await cleanupMemory()
```

### Long-Running Testing

```javascript
// Log memory every 10 minutes
setInterval(async () => {
    const report = await getMemoryReport();
    const total = parseFloat(report.frontend?.usedMB || 0) + 
                  (report.backend?.heapAlloc / 1024 / 1024 || 0);
    console.log(`${new Date().toISOString()}: ${total.toFixed(2)}MB`);
}, 600000);
```

### If Memory is High

1. Check what's using memory:
   ```javascript
   const report = await getMemoryReport();
   console.log('Image size:', report.frontendState.imageDataMB, 'MB');
   ```

2. Clear image if done:
   ```javascript
   await resetAll(); // This clears image data
   ```

3. Force garbage collection:
   ```javascript
   await forceBackendGC();
   ```

## WebView Memory Options

### Reduce Memory Usage (Linux)

In `main.go`, change GPU policy:

```go
Linux: &linux.Options{
    WebviewGpuPolicy: linux.WebviewGpuPolicyNever, // Software rendering
},
```

**Trade-off:** Lower memory usage but slower rendering.

### Memory Limit

Set a hard limit (Go 1.19+):

```javascript
// In console or app code
await window.go.main.App.SetMemoryLimit(1024); // 1GB limit
```

## Expected Behavior

### Normal Operation
- Memory: 50-200MB typical
- Should plateau after loading an image
- GC runs periodically, memory should decrease
- No continuous growth over hours

### After Loading Large Image
- Memory may jump to 200-500MB depending on image size
- Should not continue growing without loading more images
- GC can reclaim some memory

### Red Flags
- Memory continuously increasing without new images
- Memory > 1GB for extended periods
- GC not reducing memory
- App becomes sluggish

## Debugging Memory Leaks

### Chrome DevTools Method

1. Open DevTools (Ctrl+Shift+I)
2. Go to **Memory** tab
3. Take heap snapshot
4. Use app normally for 5-10 minutes
5. Take another snapshot
6. Compare - look for increasing objects

### Check for Detached DOM Nodes

1. DevTools → Memory → Heap snapshot
2. Look for "Detached" in the summary
3. Increasing detached nodes = leak

### Monitor Over Time

```javascript
// Save to file periodically
const logs = [];
setInterval(async () => {
    const report = await getMemoryReport();
    logs.push({
        time: new Date().toISOString(),
        frontend: report.frontend?.usedMB,
        backend: report.backend?.heapAlloc / 1024 / 1024
    });
}, 60000);

// Save logs
console.save = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
};

// Call when done
console.save(logs, 'memory-log.json');
```

## Files Changed

1. `main.go` - Added memory monitoring methods and improvements
2. `frontend/app.js` - Added memory monitoring functions and UI integration
3. `frontend/index.html` - Added memory status display
4. `frontend/style.css` - Added memory status styles
5. `wails.json` - Added build optimization flags

## What's Already Protected

✅ Image data cleared on reset  
✅ Canvas elements cleaned up  
✅ Event listeners removed  
✅ Runtime GC called after operations  
✅ Goroutines have stop channels  
✅ FreeOSMemory called on shutdown  
✅ Automatic memory monitoring  

## Next Steps for Production

If you plan to run this for many hours continuously:

1. **Test for 4+ hours** with normal usage patterns
2. **Monitor memory** every 10-15 minutes
3. **Set memory limit** appropriate for your system
4. **Consider auto-restart** if memory exceeds threshold
5. **Log to file** for post-analysis

## Getting Help

If you find memory issues:

1. Run `await getMemoryReport()` and save output
2. Take DevTools heap snapshot
3. Note what actions you were doing
4. File issue with this information
