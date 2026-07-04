// Check if Go runtime is available

// Application state - use window.appState to make it global
if (!window.appState) {
    window.appState = {};
}
window.appState = {
    ...window.appState,
    mode: null, // 'standard' or 'addon'
    isCapturing: false,
    gridEnabled: false,
    perspectiveMode: false,
    cropMode: false,
    isTogglingCrop: false,
    cornerPoints: [
        { x: 0.1, y: 0.1 }, // top-left (normalized 0-1)
        { x: 0.9, y: 0.1 }, // top-right
        { x: 0.9, y: 0.9 }, // bottom-right
        { x: 0.1, y: 0.9 }  // bottom-left
    ],
    isDraggingCorner: false,
    draggedCorner: null,
    originalImageData: null,
    originalImageBlob: null, // Store the actual blob data for transforms
    rotationAngle: 0, // Current rotation angle in degrees (0, 90, 180, 270)
    // Memory monitoring
    memoryStats: null,
    memoryWarningThreshold: 500 * 1024 * 1024, // 500MB
    lastMemoryCheck: 0
};

// Create local reference
let appState = window.appState;

// DOM elements
const pageBackground = document.getElementById('pageBackground');
const gridOverlay = document.getElementById('gridOverlay');
const fileInput = document.getElementById('fileInput');

const yMaxInput = document.getElementById('yMaxInput');
const standardBtn = document.getElementById('standardBtn');
const addonBtn = document.getElementById('addonBtn');
const importBtn = document.getElementById('importBtn');
const gridToggle = document.getElementById('gridToggle');

const description = document.getElementById('description');
const readingsOutput = document.getElementById('readingsOutput');

// Perspective transform elements
const perspectiveToggle = document.getElementById('perspectiveToggle');
const applyPerspectiveBtn = document.getElementById('applyPerspective');
const resetPerspectiveBtn = document.getElementById('resetPerspective');
const perspectiveControls = document.getElementById('perspectiveControls');
const cornerHandles = [
    document.getElementById('corner-tl'),
    document.getElementById('corner-tr'),
    document.getElementById('corner-br'),
    document.getElementById('corner-bl')
];

// Check if Go is available
function isGoAvailable() {
    return window.go && window.go.main && window.go.main.App;
}

// Get Go app reference
let GoApp = null;
if (isGoAvailable()) {
    GoApp = window.go.main.App;
}

// Helper function to call Go methods safely
async function callGo(methodName, ...args) {
    // Always check window.go directly in case it loaded after script initialization
    if (!window.go || !window.go.main || !window.go.main.App) {
        return null;
    }
    
    if (!window.go.main.App[methodName]) {
        return null;
    }
    
    try {
        const result = await window.go.main.App[methodName](...args);
        return result;
    } catch (err) {
        throw err;
    }
}

// Helper function to extract reading from Wails result
// Handles struct format {reading: string, description: string} from Go
function extractReading(result) {
    if (!result) {
        return '';
    }

    // Check if it's the new struct format from Go
    if (typeof result === 'object' && result.reading !== undefined) {
        return result.reading;
    }

    // Check if it's an array (from mock runtime.js)
    if (Array.isArray(result)) {
        return result[0] || '';
    }

    // Check if it's an object with numbered properties (old Wails v2 format)
    if (typeof result === 'object') {
        if (result.r0 !== undefined) {
            return result.r0;
        }
        // Fallback: try to find any string property
        for (const key in result) {
            if (typeof result[key] === 'string' && result[key].length > 0) {
                return result[key];
            }
        }
    }

    // If it's a string, return it directly
    if (typeof result === 'string') {
        return result;
    }

    return '';
}

// Image import - uses HTML file input
if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => {
        // Turn off perspective mode when importing a new image
        if (appState.perspectiveMode) {
            disablePerspectiveMode();
        }
        fileInput.click();
    });
}

// Grid toggle
gridToggle.addEventListener('click', () => {
    appState.gridEnabled = !appState.gridEnabled;
    if (gridOverlay) {
        gridOverlay.style.display = appState.gridEnabled ? 'block' : 'none';
    }
    gridToggle.textContent = appState.gridEnabled ? 'Grid: On' : 'Grid: Off';
    gridToggle.classList.toggle('active', appState.gridEnabled);
});

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // If we're in the middle of usage input, reset the state
    if (appState.mode) {
        await resetUsageState();
    }
    
    // Clean up previous image data before loading new one
    cleanupImageData();
    
    if (files.length === 1) {
        // Single file mode - process normally
        await processSingleFile(files[0]);
    } else {
        // Multi-file mode - process sequentially with aggregation
        await processMultipleFiles(files);
    }
});

// Process a single file (normal mode)
async function processSingleFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        // Reset rotation when importing a new image
        appState.rotationAngle = 0;
        // Show crop preview modal which will normalize image orientation
        showCropPreviewModal(event.target.result);
    };
    reader.readAsDataURL(file);
}

// Multi-file processing state
appState.multiFileQueue = [];
appState.currentFileIndex = 0;
appState.isProcessingMultiFile = false;
appState.isWaitingForNextFile = false; // True when auto-transitioning between files

// Process multiple files sequentially with aggregation
async function processMultipleFiles(files) {
    // Initialize multi-file mode in backend
    if (isGoAvailable()) {
        await callGo("StartMultiFileProcessing", files.length);
    }
    
    // Store the queue and start processing
    appState.multiFileQueue = files;
    appState.currentFileIndex = 0;
    appState.isProcessingMultiFile = true;
    
    // Show multi-file progress UI
    showMultiFileProgress(0, files.length);
    
    // Process the first file
    await processNextMultiFile();
}

// Process the next file in the multi-file queue
async function processNextMultiFile() {
    if (!appState.isProcessingMultiFile) return;
    
    // Sync index with backend to ensure we're on the right file
    const backendIndex = await callGo("GetCurrentFileIndex");
    appState.currentFileIndex = backendIndex;
    
    const index = appState.currentFileIndex;
    const files = appState.multiFileQueue;
    
    if (index >= files.length) {
        // All files processed
        appState.isProcessingMultiFile = false;
        appState.isWaitingForNextFile = false;
        appState.multiFileQueue = [];
        hideMultiFileProgress();
        showNotification('All files processed! Values aggregated.');
        return;
    }
    
    // Not waiting anymore - file is ready for user
    appState.isWaitingForNextFile = false;
    
    // Update progress
    showMultiFileProgress(index + 1, files.length);
    
    // Read and process the file
    const file = files[index];
    const reader = new FileReader();
    reader.onload = (event) => {
        // Reset rotation when importing a new image
        appState.rotationAngle = 0;
        // Show crop preview modal with multi-file mode enabled
        showCropPreviewModalMultiFile(event.target.result, index + 1, files.length);
    };
    reader.readAsDataURL(file);
}

// Multi-file progress UI
function showMultiFileProgress(current, total) {
    let progressEl = document.getElementById('multiFileProgress');
    if (!progressEl) {
        progressEl = document.createElement('div');
        progressEl.id = 'multiFileProgress';
        progressEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 11000;
            font-weight: 500;
        `;
        document.body.appendChild(progressEl);
    }
    progressEl.textContent = `Processing file ${current} of ${total}`;
    progressEl.style.display = 'block';
}

function hideMultiFileProgress() {
    const progressEl = document.getElementById('multiFileProgress');
    if (progressEl) {
        progressEl.style.display = 'none';
    }
}

// Modified crop preview modal for multi-file mode
function showCropPreviewModalMultiFile(imageDataUrl, currentFile, totalFiles) {
    if (!cropPreviewModal) {
        initCropPreviewElements();
    }
    
    // Update title to show file number
    const titleEl = cropPreviewModal.querySelector('h2');
    if (titleEl) {
        titleEl.textContent = `Crop Image ${currentFile} of ${totalFiles}`;
    }
    
    // Show the modal (reuse existing logic)
    showCropPreviewModal(imageDataUrl);
}



// Update transform
let rafId = null;
function updateTransform() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
        // Corner positions are updated separately when needed
        if (appState.perspectiveMode) {
            updateCornerPositions();
        }
        // Force repaint to clear artifacts in WebKit
        void pageBackground.offsetHeight;
    });
}

// Reset view
function resetView() {
    updateTransform();
}



// Pan with Ctrl + drag or Middle mouse button, Rotate with Shift + drag
// Capture clicks for usage reading
document.addEventListener('mousedown', (e) => {
    // Don't capture if clicking on the container UI
    if (e.target.closest('.container')) return;
    
    // Don't interfere with crop mode
    if (appState.cropMode) {
        return;
    }
    
    // This is a capture click (only when mode is active)
    if (appState.mode && e.button === 0) { // Left click only
        handleCaptureClick(e);
    }
});

// Handle capture click - sends Y coordinate to backend
async function handleCaptureClick(e) {
    if (!appState.mode) {
        return;
    }
    
    // Get click position relative to the window (for full-page background)
    const yPos = e.clientY;
    
    // Send to backend
    try {
        let result;
        let reading = '';
        if (appState.mode === 'standard') {
            result = await callGo("HandleClick", yPos);
            // Wails returns multiple values as an object with properties
            reading = extractReading(result);
            await updateDescription();
        } else {
            result = await callGo("HandleAddonClick", yPos);
            reading = extractReading(result);
            await updateAddonDescription();
        }
        
        // Display the reading
        if (reading) {
            readingsOutput.textContent += reading + '\n';
            readingsOutput.scrollTop = readingsOutput.scrollHeight;
        }
        
        // Check if mode was disabled after this click (e.g., after December)
        // and update frontend state accordingly
        let isModeActive = false;
        if (appState.mode === 'standard') {
            isModeActive = await callGo("IsRegularMode");
        } else {
            isModeActive = await callGo("IsAddonMode");
        }
        
        if (!isModeActive) {
            // Mode was disabled (e.g., after December click), reset frontend state
            appState.mode = null;
            standardBtn.classList.remove('mode-active');
            addonBtn.classList.remove('mode-active');
            
            // Check if we're in multi-file mode
            const isMultiFile = await callGo("IsMultiFileMode");
            if (isMultiFile && appState.isProcessingMultiFile) {
                // Move to next file (this updates the buffer and increments index in backend)
                const hasMoreFiles = await callGo("MoveToNextFile");
                // Update frontend index to match backend
                appState.currentFileIndex = await callGo("GetCurrentFileIndex");
                if (hasMoreFiles) {
                    showNotification('File ' + (appState.currentFileIndex) + ' complete. Starting next file...');
                    // Set waiting flag to prevent button presses during transition
                    appState.isWaitingForNextFile = true;
                    // Clear the UI for next file
                    readingsOutput.textContent = '';
                    description.textContent = 'Import an image and enter Y-axis max to begin';
                    
                    // Clear the background image to prompt user to import next file
                    setTimeout(() => {
                        cleanupImageData();
                        // Trigger file input for next file after a short delay
                        setTimeout(() => {
                            processNextMultiFile();
                        }, 500);
                    }, 1000);
                } else {
                    // All files complete
                    appState.isProcessingMultiFile = false;
                    appState.isWaitingForNextFile = false;
                    hideMultiFileProgress();
                    showNotification('All files processed! Press V with January field selected to paste aggregated values.');
                    // Update readings output with final aggregated values
                    updateReadingsWithAggregatedValues();
                }
            } else {
                showNotification('All months captured! Paste values to spreadsheet.');
            }
        }
    } catch (err) {
        // Error handling
    }
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        resetView();
    }
    if (e.key === 'o' && e.ctrlKey) {
        e.preventDefault();
        if (importBtn && fileInput) {
            if (appState.perspectiveMode) {
                disablePerspectiveMode();
            }
            fileInput.click();
        }
    }
});

// Y Max input handling - triggers standard workflow on Enter release
yMaxInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        const value = parseInt(yMaxInput.value);
        if (value > 0) {
            startStandardWorkflow(value);
        } else {
            alert('Please enter a valid Y axis maximum value');
        }
    }
});

// Start the standard usage workflow
async function startStandardWorkflow(value) {
    // Prevent starting if in auto-transition between files
    if (appState.isWaitingForNextFile) {
        showNotification('Please wait for the next file to load...');
        return;
    }
    
    appState.mode = 'standard';
    standardBtn.classList.add('mode-active');
    addonBtn.classList.remove('mode-active');
    document.body.style.cursor = 'crosshair';
    
    if (isGoAvailable()) {
        await callGo("SetYMax", value);
        await callGo("StartRegularUsage");
        await callGo("SetWindowHeight", window.innerHeight);
        await updateDescription();
    }
    readingsOutput.textContent = '';
    description.textContent = 'Click the top of the graph';
}

// Mode selection
standardBtn.addEventListener('click', async () => {
    const value = parseInt(yMaxInput.value);
    if (value > 0) {
        await startStandardWorkflow(value);
    } else {
        alert('Please enter a valid Y axis maximum value');
    }
});

addonBtn.addEventListener('click', async () => {
    const value = parseInt(yMaxInput.value);
    if (value > 0) {
        // Prevent starting if in auto-transition between files
        if (appState.isWaitingForNextFile) {
            showNotification('Please wait for the next file to load...');
            return;
        }
        
        appState.mode = 'addon';
        addonBtn.classList.add('mode-active');
        standardBtn.classList.remove('mode-active');
        document.body.style.cursor = 'crosshair';
        
        if (isGoAvailable()) {
            await callGo("SetYMax", value);
            await callGo("StartAddonUsage");
            await callGo("SetWindowHeight", window.innerHeight);
            await updateAddonDescription();
        }
        readingsOutput.textContent = '';
        description.textContent = 'Click the top of the graph';
    } else {
        alert('Please enter a valid Y axis maximum value');
    }
});

// Update description from Go
async function updateDescription() {
    if (isGoAvailable()) {
        const desc = await callGo("GetDescription");
        description.textContent = desc;
    }
}

async function updateAddonDescription() {
    if (isGoAvailable()) {
        const desc = await callGo("GetAddonDescription");
        description.textContent = desc;
    }
}

// Listen for auto-paste event from backend
if (window.runtime && window.runtime.EventsOn) {
    window.runtime.EventsOn('auto-paste', (data) => {
        // Show notification that Alt+V hotkey is ready
        if (appState.isProcessingMultiFile) {
            showNotification('File complete. Continue with next file...');
        } else {
            showNotification('Press v with January selected to paste');
        }
    });
}

// Update readings output with aggregated values
async function updateReadingsWithAggregatedValues() {
    if (!isGoAvailable()) return;
    
    const aggregated = await callGo("GetAggregatedValues");
    if (aggregated) {
        readingsOutput.textContent = 
            `January: ${aggregated.january}\n` +
            `February: ${aggregated.february}\n` +
            `March: ${aggregated.march}\n` +
            `April: ${aggregated.april}\n` +
            `May: ${aggregated.may}\n` +
            `June: ${aggregated.june}\n` +
            `July: ${aggregated.july}\n` +
            `August: ${aggregated.august}\n` +
            `September: ${aggregated.september}\n` +
            `October: ${aggregated.october}\n` +
            `November: ${aggregated.november}\n` +
            `December: ${aggregated.december}\n` +
            '\n--- AGGREGATED TOTALS ---';
        readingsOutput.scrollTop = readingsOutput.scrollHeight;
    }
}

// Show notification
function showNotification(message) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: #4caf50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 11000;
        font-weight: 500;
        max-width: 300px;
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transition = 'opacity 0.3s';
        setTimeout(() => notif.remove(), 300);
    }, 5000);
}

// Reset function
async function resetAll() {
    if (isGoAvailable()) {
        await callGo("Reset");
    }
    appState.mode = null;
    standardBtn.classList.remove('mode-active');
    addonBtn.classList.remove('mode-active');
    document.body.style.cursor = '';
    yMaxInput.value = '';
    readingsOutput.textContent = '';
    description.textContent = 'Input y axis, hit enter, and click the top of the graph';

    // Clean up image data to free memory
    cleanupImageData();
    
    // Reset multi-file state
    appState.multiFileQueue = [];
    appState.currentFileIndex = 0;
    appState.isProcessingMultiFile = false;
    appState.isWaitingForNextFile = false;
    hideMultiFileProgress();

    resetView();
}

// Reset usage state when importing an image mid-usage input
async function resetUsageState() {
    if (isGoAvailable()) {
        await callGo("Reset");
    }
    appState.mode = null;
    standardBtn.classList.remove('mode-active');
    addonBtn.classList.remove('mode-active');
    document.body.style.cursor = '';
    readingsOutput.textContent = '';
    description.textContent = 'Input y axis, hit enter, and click the top of the graph';
}

// Cleanup image data and canvases to free memory
function cleanupImageData() {
    // Disable crop mode to reset all crop-related state
    if (appState.cropMode) {
        disableCropMode();
    }
    
    // Clear crop selection state
    appState.cropSelection = null;
    appState.isDrawingCrop = false;
    appState.cropStart = null;
    clearCropSelection();
    
    // Clear crop preview modal state if it exists
    if (typeof cropPreviewSelectionData !== 'undefined') {
        cropPreviewSelectionData = null;
    }
    if (typeof clearCropPreviewSelection === 'function') {
        clearCropPreviewSelection();
    }
    
    // Clear image blob and data URLs
    if (appState.originalImageBlob) {
        // Revoke object URL if it was created from a blob
        try {
            URL.revokeObjectURL(appState.originalImageBlob);
        } catch (e) {
            // Not a blob URL, ignore
        }
        appState.originalImageBlob = null;
    }
    
    if (appState.originalImageData) {
        appState.originalImageData = null;
    }
    
    // Clear raw image dimensions
    appState.rawImageWidth = null;
    appState.rawImageHeight = null;
    
    // Remove perspective preview canvas completely
    const previewCanvas = document.getElementById('perspectivePreviewCanvas');
    if (previewCanvas && previewCanvas.parentNode) {
        previewCanvas.parentNode.removeChild(previewCanvas);
    }
    
    // Reset perspective mode state
    appState.perspectiveMode = false;
    appState.cornerPoints = [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 }
    ];
    
    // Reset rotation
    appState.rotationAngle = 0;
    
    // Disable perspective mode in backend and update UI
    if (isGoAvailable()) {
        callGo("SetPerspectiveMode", false);
        callGo("ResetPerspective");
    }
    
    // Update perspective UI to reflect off state
    if (perspectiveToggle) {
        perspectiveToggle.textContent = 'Perspective: Off';
        perspectiveToggle.classList.remove('active');
    }
    if (perspectiveControls) {
        perspectiveControls.style.display = 'none';
        perspectiveControls.classList.remove('active');
    }
    if (applyPerspectiveBtn) {
        applyPerspectiveBtn.style.display = 'none';
    }
    if (resetPerspectiveBtn) {
        resetPerspectiveBtn.style.display = 'none';
    }
    
    // Clear background image
    pageBackground.style.backgroundImage = '';
    
    // Reset file input to allow reloading same file
    if (fileInput) {
        fileInput.value = '';
    }
}

// Window resize handling
window.addEventListener('resize', () => {
    if (isGoAvailable()) {
        callGo("SetWindowHeight", window.innerHeight);
    }
});

// Initialize

// Add escape key to reset
document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
        if (confirm('Reset all data?')) {
            await resetAll();
        }
    }
});

// ============================================
// PERSPECTIVE TRANSFORM FUNCTIONS
// ============================================

// Initialize perspective controls
function initPerspectiveControls() {
    // Toggle perspective mode
    perspectiveToggle.addEventListener('click', togglePerspectiveMode);
    
    // Apply perspective transform
    applyPerspectiveBtn.addEventListener('click', applyPerspectiveTransform);
    
    // Reset corner positions
    resetPerspectiveBtn.addEventListener('click', resetCornerPositions);
    
    // Corner dragging
    cornerHandles.forEach((handle, index) => {
        handle.addEventListener('mousedown', (e) => startDraggingCorner(e, index));
    });
}

// Toggle perspective transform mode
function togglePerspectiveMode() {
    // Check if an image is loaded
    const hasImage = pageBackground.style.backgroundImage && 
                     pageBackground.style.backgroundImage !== 'none' &&
                     appState.originalImageData;
    
    if (!hasImage) {
        showNotification('Please import an image first');
        return;
    }
    
    appState.perspectiveMode = !appState.perspectiveMode;
    
    if (appState.perspectiveMode) {
        // Enable perspective mode
        perspectiveToggle.textContent = 'Perspective: On';
        perspectiveToggle.classList.add('active');
        perspectiveControls.style.display = 'block';
        perspectiveControls.classList.add('active');
        applyPerspectiveBtn.style.display = 'inline-block';
        resetPerspectiveBtn.style.display = 'inline-block';
        
        // Enable grid to help with alignment
        if (gridOverlay) {
            appState.gridEnabled = true;
            gridOverlay.style.display = 'block';
            gridToggle.textContent = 'Grid: On';
            gridToggle.classList.add('active');
        }
        
        // Wait for image dimensions to be available, then reset corners and show preview
        const initPerspective = () => {
            if (appState.rawImageWidth && appState.rawImageHeight) {
                resetCornersToImageBounds();
                updateCornerPositions();
                applyPerspectivePreview();  // Show initial preview
            } else {
                // Retry after a short delay if dimensions aren't loaded yet
                setTimeout(initPerspective, 100);
            }
        };
        initPerspective();
        
        // Send to backend
        if (isGoAvailable()) {
            callGo("SetPerspectiveMode", true);
        }
        
        showNotification('Drag the 4 corners to align the image to the grid');
    } else {
        // Disable perspective mode
        disablePerspectiveMode();
    }
}

// Disable perspective mode
function disablePerspectiveMode() {
    appState.perspectiveMode = false;
    perspectiveToggle.textContent = 'Perspective: Off';
    perspectiveToggle.classList.remove('active');
    perspectiveControls.style.display = 'none';
    perspectiveControls.classList.remove('active');
    applyPerspectiveBtn.style.display = 'none';
    resetPerspectiveBtn.style.display = 'none';
    
    // Reset the CSS transform to remove perspective distortion
    resetPerspectivePreview();
    
    // If crop mode is active, restore the preview canvas opacity
    if (appState.cropMode) {
        const previewCanvas = document.getElementById('perspectivePreviewCanvas');
        if (previewCanvas) {
            previewCanvas.style.opacity = '1';
        }
    }
    
    if (isGoAvailable()) {
        callGo("SetPerspectiveMode", false);
    }
}

// Get the actual displayed image bounds
function getImageBounds() {
    const dialogWidth = 360; // Match CSS var(--dialog-width)
    const leftPadding = 40; // Match CSS var(--left-padding)
    const topPadding = 20; // Top padding for image area
    const windowWidth = window.innerWidth - dialogWidth - leftPadding;
    const windowHeight = window.innerHeight - 40; // Subtract top and bottom padding (20px each)
    
    // Check if we have raw image dimensions stored
    if (!appState.rawImageWidth || !appState.rawImageHeight) {
        return null;
    }
    
    const imgWidth = appState.rawImageWidth;
    const imgHeight = appState.rawImageHeight;
    
    // Calculate display size with 'contain' mode
    const windowRatio = windowWidth / windowHeight;
    const imgRatio = imgWidth / imgHeight;
    
    let displayWidth, displayHeight;
    
    if (imgRatio > windowRatio) {
        // Image is wider - constrained by width
        displayWidth = windowWidth;
        displayHeight = windowWidth / imgRatio;
    } else {
        // Image is taller - constrained by height
        displayHeight = windowHeight;
        displayWidth = windowHeight * imgRatio;
    }
    
    // Calculate center position with top padding offset
    const centerX = leftPadding + windowWidth / 2;
    const centerY = topPadding + windowHeight / 2;
    
    // Calculate actual image bounds
    const bounds = {
        left: centerX - displayWidth / 2,
        top: centerY - displayHeight / 2,
        right: centerX + displayWidth / 2,
        bottom: centerY + displayHeight / 2,
        width: displayWidth,
        height: displayHeight
    };
    
    return bounds;
}

// Reset corner positions to image corners
function resetCornersToImageBounds() {
    if (!appState.rawImageWidth || !appState.rawImageHeight) {
        return;
    }
    
    // Set corners to full image corners in raw pixel coordinates
    appState.cornerPoints = [
        { x: 0, y: 0 },                      // top-left
        { x: appState.rawImageWidth, y: 0 }, // top-right
        { x: appState.rawImageWidth, y: appState.rawImageHeight }, // bottom-right
        { x: 0, y: appState.rawImageHeight } // bottom-left
    ];
}

// Start dragging a corner handle
function startDraggingCorner(e, cornerIndex) {
    if (!appState.perspectiveMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    appState.isDraggingCorner = true;
    appState.draggedCorner = cornerIndex;
    
    const handle = cornerHandles[cornerIndex];
    handle.classList.add('dragging');
    
    const onMouseMove = (e) => {
        if (!appState.isDraggingCorner) return;
        
        if (!appState.rawImageWidth || !appState.rawImageHeight) {
            return;
        }
        
        const dialogWidth = 360; // Match CSS var(--dialog-width)
        const leftPadding = 40; // Match CSS var(--left-padding)
        const topPadding = 20; // Top padding for image area
        const windowWidth = window.innerWidth - dialogWidth - leftPadding;
        const windowHeight = window.innerHeight - 40; // Subtract top and bottom padding (20px each)
        const imgWidth = appState.rawImageWidth;
        const imgHeight = appState.rawImageHeight;
        
        // Calculate base display size with 'contain' mode
        const windowRatio = windowWidth / windowHeight;
        const imgRatio = imgWidth / imgHeight;
        
        let displayWidth, displayHeight;
        if (imgRatio > windowRatio) {
            displayWidth = windowWidth;
            displayHeight = windowWidth / imgRatio;
        } else {
            displayHeight = windowHeight;
            displayWidth = windowHeight * imgRatio;
        }
        
        // Calculate center position with top padding offset
        const centerX = leftPadding + windowWidth / 2;
        const centerY = topPadding + windowHeight / 2;
        
        // Get mouse position
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // Convert to normalized coordinates relative to image center
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        
        // Normalize (divide by half display size to get -1 to 1)
        const normX = dx / (displayWidth / 2);
        const normY = dy / (displayHeight / 2);
        
        // Convert normalized (-1 to 1) back to raw pixel coordinates
        const rawX = (normX / 2 + 0.5) * imgWidth;
        const rawY = (normY / 2 + 0.5) * imgHeight;
        
        // Update corner position (raw image pixel coordinates)
        appState.cornerPoints[cornerIndex] = {
            x: rawX,
            y: rawY
        };
        
        // Only update UI elements during drag (lightweight)
        updateCornerPositions();
    };
    
    const onMouseUp = () => {
        appState.isDraggingCorner = false;
        appState.draggedCorner = null;
        handle.classList.remove('dragging');
        
        // Apply the perspective transform only when drag ends
        applyPerspectivePreview();
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Apply real-time perspective distortion using canvas with inverse homography and bilinear sampling
function applyPerspectivePreview() {
    if (!appState.perspectiveMode || !appState.originalImageBlob) return;
    
    const dialogWidth = 360; // Match CSS var(--dialog-width)
    const leftPadding = 40; // Match CSS var(--left-padding)
    const windowWidth = window.innerWidth - dialogWidth - leftPadding;
    const windowHeight = window.innerHeight;
    
    // Get image bounds
    const bounds = getImageBounds();
    if (!bounds) return;
    
    // Get or create preview canvas
    let previewCanvas = document.getElementById('perspectivePreviewCanvas');
    if (!previewCanvas) {
        previewCanvas = document.createElement('canvas');
        previewCanvas.id = 'perspectivePreviewCanvas';
        previewCanvas.style.position = 'fixed';
        previewCanvas.style.top = '0';
        previewCanvas.style.left = '0';
        previewCanvas.style.pointerEvents = 'none';
        previewCanvas.style.zIndex = '100';  // Below grid (10000) but above background
        // Insert before gridOverlay so grid naturally stacks on top
        const gridOverlay = document.getElementById('gridOverlay');
        if (gridOverlay && gridOverlay.parentNode) {
            gridOverlay.parentNode.insertBefore(previewCanvas, gridOverlay);
        } else {
            document.body.appendChild(previewCanvas);
        }
    }
    
    // Source rectangle corners (original image display bounds)
    const srcCorners = [
        { x: bounds.left, y: bounds.top },      // top-left
        { x: bounds.right, y: bounds.top },     // top-right
        { x: bounds.right, y: bounds.bottom },  // bottom-right
        { x: bounds.left, y: bounds.bottom }    // bottom-left
    ];
    
    // Destination corners (dragged positions) - convert from raw pixels to screen coords
    if (!appState.rawImageWidth || !appState.rawImageHeight) {
        return;
    }
    
    const dstCorners = appState.cornerPoints.map(p => ({
        x: bounds.left + (p.x / appState.rawImageWidth) * bounds.width,
        y: bounds.top + (p.y / appState.rawImageHeight) * bounds.height
    }));
    
    // Calculate bounding box of destination quadrilateral
    const minX = Math.min(...dstCorners.map(p => p.x));
    const maxX = Math.max(...dstCorners.map(p => p.x));
    const minY = Math.min(...dstCorners.map(p => p.y));
    const maxY = Math.max(...dstCorners.map(p => p.y));
    
    const dstWidth = Math.ceil(maxX - minX);
    const dstHeight = Math.ceil(maxY - minY);
    
    if (dstWidth <= 0 || dstHeight <= 0) return;
    
    // Set canvas size to match destination bounds
    previewCanvas.width = dstWidth;
    previewCanvas.height = dstHeight;
    previewCanvas.style.left = `${minX}px`;
    previewCanvas.style.top = `${minY}px`;
    previewCanvas.style.width = `${dstWidth}px`;
    previewCanvas.style.height = `${dstHeight}px`;
    previewCanvas.style.display = 'block';
    
    // Load source image to get pixel data
    const img = new Image();
    img.onload = function() {
        // Create source canvas to get pixel data
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width;
        srcCanvas.height = img.height;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, img.width, img.height);
        
        // Create destination context
        const dstCtx = previewCanvas.getContext('2d');
        const dstData = dstCtx.createImageData(dstWidth, dstHeight);
        
        // Compute inverse homography matrix (maps destination to source)
        // We want to find where each destination pixel came from in the source
        const H = computeHomography(dstCorners, srcCorners);
        const invH = invertMatrix3x3(H);
        
        if (!invH) return;
        
        // Render pixel by pixel with bilinear interpolation
        for (let y = 0; y < dstHeight; y++) {
            for (let x = 0; x < dstWidth; x++) {
                // Destination pixel coordinate in screen space
                const dstX = minX + x;
                const dstY = minY + y;
                
                // Apply inverse homography to get source coordinate
                const srcCoord = applyHomography(invH, dstX, dstY);
                
                // Check if source coordinate is within source bounds
                if (srcCoord.x >= bounds.left && srcCoord.x < bounds.right &&
                    srcCoord.y >= bounds.top && srcCoord.y < bounds.bottom) {
                    
                    // Convert to normalized coordinates within the source rectangle
                    const normX = (srcCoord.x - bounds.left) / bounds.width;
                    const normY = (srcCoord.y - bounds.top) / bounds.height;
                    
                    // Convert to pixel coordinates in the source image
                    const srcPixelX = normX * img.width;
                    const srcPixelY = normY * img.height;
                    
                    // Bilinear interpolation
                    const pixel = bilinearSample(srcData, srcPixelX, srcPixelY, img.width, img.height);
                    
                    // Write to destination
                    const dstIdx = (y * dstWidth + x) * 4;
                    dstData.data[dstIdx] = pixel[0];
                    dstData.data[dstIdx + 1] = pixel[1];
                    dstData.data[dstIdx + 2] = pixel[2];
                    dstData.data[dstIdx + 3] = pixel[3];
                } else {
                    // Outside bounds - transparent
                    const dstIdx = (y * dstWidth + x) * 4;
                    dstData.data[dstIdx] = 0;
                    dstData.data[dstIdx + 1] = 0;
                    dstData.data[dstIdx + 2] = 0;
                    dstData.data[dstIdx + 3] = 0;
                }
            }
        }
        
        // Put the rendered data onto the canvas
        dstCtx.putImageData(dstData, 0, 0);
        
        // Clean up temporary canvas to free memory
        srcCanvas.width = 0;
        srcCanvas.height = 0;
        
        // Hide the original background image while showing preview
        pageBackground.style.opacity = '0';
    };
    img.src = appState.originalImageBlob;
}

// Compute homography matrix from 4 point correspondences
// Maps points from dst to src (forward mapping)
function computeHomography(dst, src) {
    // Build matrix A (8x9)
    const A = [];
    
    for (let i = 0; i < 4; i++) {
        const sx = src[i].x, sy = src[i].y;
        const dx = dst[i].x, dy = dst[i].y;
        
        // Two rows per point
        A.push([sx, sy, 1, 0, 0, 0, -sx*dx, -sy*dx, -dx]);
        A.push([0, 0, 0, sx, sy, 1, -sx*dy, -sy*dy, -dy]);
    }
    
    // Solve using SVD (simplified: solve 8x8 system with h33 = 1)
    const B = [];
    const c = [];
    
    for (let i = 0; i < 8; i++) {
        const row = [];
        for (let j = 0; j < 8; j++) {
            row.push(A[i][j]);
        }
        B.push(row);
        c.push(-A[i][8]);
    }
    
    const solution = solveLinearSystem8x8(B, c);
    if (!solution) return null;
    
    // Add h33 = 1
    solution.push(1);
    
    return solution;
}

// Invert 3x3 matrix
function invertMatrix3x3(m) {
    const det = m[0] * (m[4] * m[8] - m[5] * m[7]) -
                m[1] * (m[3] * m[8] - m[5] * m[6]) +
                m[2] * (m[3] * m[7] - m[4] * m[6]);
    
    if (Math.abs(det) < 1e-10) return null;
    
    const invDet = 1.0 / det;
    
    return [
        (m[4] * m[8] - m[5] * m[7]) * invDet,
        (m[2] * m[7] - m[1] * m[8]) * invDet,
        (m[1] * m[5] - m[2] * m[4]) * invDet,
        (m[5] * m[6] - m[3] * m[8]) * invDet,
        (m[0] * m[8] - m[2] * m[6]) * invDet,
        (m[2] * m[3] - m[0] * m[5]) * invDet,
        (m[3] * m[7] - m[4] * m[6]) * invDet,
        (m[1] * m[6] - m[0] * m[7]) * invDet,
        (m[0] * m[4] - m[1] * m[3]) * invDet
    ];
}

// Apply homography matrix to point
function applyHomography(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    if (Math.abs(w) < 1e-10) return { x: 0, y: 0 };
    return {
        x: (H[0] * x + H[1] * y + H[2]) / w,
        y: (H[3] * x + H[4] * y + H[5]) / w
    };
}

// Bilinear interpolation sampling
function bilinearSample(imageData, x, y, width, height) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    
    const fx = x - x0;
    const fy = y - y0;
    
    const idx00 = (y0 * width + x0) * 4;
    const idx01 = (y0 * width + x1) * 4;
    const idx10 = (y1 * width + x0) * 4;
    const idx11 = (y1 * width + x1) * 4;
    
    const data = imageData.data;
    
    const result = [0, 0, 0, 0];
    
    for (let i = 0; i < 4; i++) {
        const v00 = data[idx00 + i];
        const v01 = data[idx01 + i];
        const v10 = data[idx10 + i];
        const v11 = data[idx11 + i];
        
        const v0 = v00 * (1 - fx) + v01 * fx;
        const v1 = v10 * (1 - fx) + v11 * fx;
        
        result[i] = Math.round(v0 * (1 - fy) + v1 * fy);
    }
    
    return result;
}

// Solve 8x8 linear system
function solveLinearSystem8x8(A, b) {
    const n = 8;
    const M = A.map((row, i) => [...row, b[i]]);
    
    // Gaussian elimination with partial pivoting
    for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i;
        let maxVal = Math.abs(M[i][i]);
        for (let k = i + 1; k < n; k++) {
            const val = Math.abs(M[k][i]);
            if (val > maxVal) {
                maxVal = val;
                maxRow = k;
            }
        }
        
        if (maxVal < 1e-10) return null;
        
        // Swap rows
        [M[i], M[maxRow]] = [M[maxRow], M[i]];
        
        // Eliminate
        for (let k = i + 1; k < n; k++) {
            const factor = M[k][i] / M[i][i];
            for (let j = i; j <= n; j++) {
                M[k][j] -= factor * M[i][j];
            }
        }
    }
    
    // Back substitution
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
        let sum = M[i][n];
        for (let j = i + 1; j < n; j++) {
            sum -= M[i][j] * x[j];
        }
        x[i] = sum / M[i][i];
    }
    
    return x;
}

// Reset perspective preview (show original background again)
function resetPerspectivePreview() {
    // Show the original background
    pageBackground.style.opacity = '1';
    
    // Remove preview canvas from DOM to free memory
    const previewCanvas = document.getElementById('perspectivePreviewCanvas');
    if (previewCanvas && previewCanvas.parentNode) {
        previewCanvas.parentNode.removeChild(previewCanvas);
    }
}

// Hide perspective preview canvas (keeps in DOM but hidden)
function hidePerspectivePreview() {
    const previewCanvas = document.getElementById('perspectivePreviewCanvas');
    if (previewCanvas) {
        previewCanvas.style.display = 'none';
    }
    pageBackground.style.opacity = '1';
}


// Update corner handle positions based on raw image pixel coordinates
function updateCornerPositions() {
    if (!appState.rawImageWidth || !appState.rawImageHeight) {
        return;
    }
    
    const dialogWidth = 360; // Match CSS var(--dialog-width)
    const leftPadding = 40; // Match CSS var(--left-padding)
    const topPadding = 20; // Top padding for image area
    const windowWidth = window.innerWidth - dialogWidth - leftPadding;
    const windowHeight = window.innerHeight - 40; // Subtract top and bottom padding (20px each)
    const imgWidth = appState.rawImageWidth;
    const imgHeight = appState.rawImageHeight;
    
    // Calculate base display size with 'contain' mode (same as getImageBounds)
    const windowRatio = windowWidth / windowHeight;
    const imgRatio = imgWidth / imgHeight;
    
    let displayWidth, displayHeight;
    if (imgRatio > windowRatio) {
        displayWidth = windowWidth;
        displayHeight = windowWidth / imgRatio;
    } else {
        displayHeight = windowHeight;
        displayWidth = windowHeight * imgRatio;
    }
    
    // Calculate center position with top padding offset
    const centerX = leftPadding + windowWidth / 2;
    const centerY = topPadding + windowHeight / 2;
    
    cornerHandles.forEach((handle, index) => {
        const point = appState.cornerPoints[index];
        
        // Convert raw pixel coordinates to normalized (-1 to 1) relative to image center
        const normX = (point.x / imgWidth - 0.5) * 2;
        const normY = (point.y / imgHeight - 0.5) * 2;
        
        // Apply scale
        const scaledX = normX * displayWidth / 2;
        const scaledY = normY * displayHeight / 2;
        
        // Add center position
        // Subtract leftPadding and topPadding because the perspectiveControls container already has margins
        const screenX = centerX + scaledX - leftPadding;
        const screenY = centerY + scaledY - topPadding;
        
        handle.style.left = `${screenX}px`;
        handle.style.top = `${screenY}px`;
        handle.style.right = 'auto';
        handle.style.bottom = 'auto';
    });
    
    drawPerspectiveLines();
}

// Draw lines connecting the corners
function drawPerspectiveLines() {
    const linesContainer = document.getElementById('perspectiveLines');
    linesContainer.innerHTML = '';
    
    if (!appState.perspectiveMode) return;
    
    if (!appState.rawImageWidth || !appState.rawImageHeight) {
        return;
    }
    
    const dialogWidth = 360; // Match CSS var(--dialog-width)
    const leftPadding = 40; // Match CSS var(--left-padding)
    const topPadding = 20; // Top padding for image area
    const windowWidth = window.innerWidth - dialogWidth - leftPadding;
    const windowHeight = window.innerHeight - 40; // Subtract top and bottom padding (20px each)
    const imgWidth = appState.rawImageWidth;
    const imgHeight = appState.rawImageHeight;
    
    // Calculate base display size with 'contain' mode
    const windowRatio = windowWidth / windowHeight;
    const imgRatio = imgWidth / imgHeight;
    
    let displayWidth, displayHeight;
    if (imgRatio > windowRatio) {
        displayWidth = windowWidth;
        displayHeight = windowWidth / imgRatio;
    } else {
        displayHeight = windowHeight;
        displayWidth = windowHeight * imgRatio;
    }
    
    // Calculate center position with top padding offset
    const centerX = leftPadding + windowWidth / 2;
    const centerY = topPadding + windowHeight / 2;
    
    // Helper function to convert raw image point to screen coordinates
    const getScreenPoint = (point) => {
        // Convert raw pixel coordinates to normalized (-1 to 1) relative to image center
        const normX = (point.x / imgWidth - 0.5) * 2;
        const normY = (point.y / imgHeight - 0.5) * 2;
        
        // Apply scale
        const scaledX = normX * displayWidth / 2;
        const scaledY = normY * displayHeight / 2;
        
        // Add center position
        // Subtract leftPadding and topPadding because the perspectiveControls container already has margins
        return {
            x: centerX + scaledX - leftPadding,
            y: centerY + scaledY - topPadding
        };
    };
    
    // Define line pairs (connections)
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 0] // Rectangle edges
    ];
    
    connections.forEach(([start, end]) => {
        const p1 = getScreenPoint(appState.cornerPoints[start]);
        const p2 = getScreenPoint(appState.cornerPoints[end]);
        
        const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        
        const line = document.createElement('div');
        line.className = 'perspective-line';
        line.style.width = `${length}px`;
        line.style.left = `${p1.x}px`;
        line.style.top = `${p1.y}px`;
        line.style.transform = `rotate(${angle}deg)`;
        
        linesContainer.appendChild(line);
    });
}


// Calculate perspective transform matrix for CSS preview
// Uses the four corner points to calculate a CSS matrix3d transform
function calculatePerspectiveMatrix() {
    const bounds = getImageBounds();
    if (!bounds) return null;
    
    if (!appState.rawImageWidth || !appState.rawImageHeight) {
        return null;
    }
    
    // Get the four corner points in screen coordinates (convert from raw pixels)
    const corners = appState.cornerPoints.map(p => ({
        x: bounds.left + (p.x / appState.rawImageWidth) * bounds.width,
        y: bounds.top + (p.y / appState.rawImageHeight) * bounds.height
    }));
    
    // Source rectangle (the actual image bounds)
    const src = [
        { x: bounds.left, y: bounds.top },      // top-left
        { x: bounds.right, y: bounds.top },     // top-right
        { x: bounds.right, y: bounds.bottom },  // bottom-right
        { x: bounds.left, y: bounds.bottom }   // bottom-left
    ];
    
    // Destination (dragged corners)
    const dst = corners;
    
    // Calculate the perspective transform matrix using the adjugate method
    // This maps the source rectangle to the destination quadrilateral
    const matrix = getPerspectiveTransformMatrix(src, dst);
    
    return matrix;
}

// Calculate 3x3 perspective transform matrix
// Maps src points to dst points using homography
function getPerspectiveTransformMatrix(src, dst) {
    // Using Direct Linear Transform (DLT) algorithm
    // Build the constraint matrix
    const A = [];
    
    for (let i = 0; i < 4; i++) {
        const sx = src[i].x, sy = src[i].y;
        const dx = dst[i].x, dy = dst[i].y;
        
        // Two rows per point
        A.push([sx, sy, 1, 0, 0, 0, -sx*dx, -sy*dx, -dx]);
        A.push([0, 0, 0, sx, sy, 1, -sx*dy, -sy*dy, -dy]);
    }
    
    // Solve using simple SVD or Gaussian elimination
    // For simplicity, we'll use a numeric approach
    const h = solveHomography(A);
    
    return h;
}

// Simple solver for homography matrix
function solveHomography(A) {
    // Use Gaussian elimination to solve Ah = 0
    // This finds the null space of A
    
    // Simplified implementation using the fact that h is defined up to scale
    // We'll set h[8] = 1 and solve for the rest
    
    const n = A.length;
    const m = A[0].length;
    
    // Build the 8x8 matrix (setting h[8] = 1)
    const B = [];
    const c = [];
    
    for (let i = 0; i < 8; i++) {
        B.push(A[i].slice(0, 8));
        c.push(-A[i][8]);
    }
    
    // Solve B * h' = c using Gaussian elimination
    const h = solveLinearSystem(B, c);
    h.push(1);  // h[8] = 1
    
    return h;
}

// Simple Gaussian elimination solver
function solveLinearSystem(A, b) {
    const n = A.length;
    
    // Create augmented matrix
    const M = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
                maxRow = k;
            }
        }
        
        // Swap rows
        [M[i], M[maxRow]] = [M[maxRow], M[i]];
        
        // Eliminate column
        for (let k = i + 1; k < n; k++) {
            const factor = M[k][i] / M[i][i];
            for (let j = i; j <= n; j++) {
                M[k][j] -= factor * M[i][j];
            }
        }
    }
    
    // Back substitution
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = M[i][n];
        for (let j = i + 1; j < n; j++) {
            x[i] -= M[i][j] * x[j];
        }
        x[i] /= M[i][i];
    }
    
    return x;
}

// Reset corner positions to default
function resetCornerPositions() {
    // Reset corners to current image bounds
    resetCornersToImageBounds();
    
    // Update corner positions
    updateCornerPositions();
    
    // Force a redraw after a short delay to ensure DOM has updated
    requestAnimationFrame(() => {
        updateCornerPositions();
    });
    
    // Update the preview
    if (appState.perspectiveMode) {
        applyPerspectivePreview();
    }
    
    // Reset in backend
    if (isGoAvailable()) {
        callGo("ResetPerspective");
    }
    
    showNotification('Corner positions reset to image corners');
}

// Apply perspective transform
async function applyPerspectiveTransform() {
    if (!window.go || !window.go.main || !window.go.main.App) {
        showNotification('Backend not available');
        return;
    }
    
    if (!appState.originalImageBlob) {
        showNotification('No image data available');
        return;
    }
    
    try {
        showNotification('Applying perspective transform...');
        
        // Get the bounds to calculate relative positions
        const bounds = getImageBounds();
        if (!bounds) {
            showNotification('Could not determine image bounds');
            return;
        }
        
        // Corner points are already in raw image pixel coordinates
        // Send them directly to backend
        await callGo("SetCornerPoints", [
            [appState.cornerPoints[0].x, appState.cornerPoints[0].y],
            [appState.cornerPoints[1].x, appState.cornerPoints[1].y],
            [appState.cornerPoints[2].x, appState.cornerPoints[2].y],
            [appState.cornerPoints[3].x, appState.cornerPoints[3].y]
        ]);
        
        // Extract base64 data from data URL (backend expects base64 string)
        const base64Data = appState.originalImageBlob.split(',')[1];
        
        // Send to backend for transformation with raw image dimensions
        const transformedData = await callGo("ApplyPerspectiveTransform", 
            base64Data,
            appState.rawImageWidth,
            appState.rawImageHeight
        );
        
        if (transformedData && transformedData.length > 0) {
            // Backend now returns base64 string directly
            const base64String = typeof transformedData === 'string' ? transformedData : transformedData.toString();
            const transformedUrl = `data:image/png;base64,${base64String}`;
            
            // Update background with transformed image
            pageBackground.style.backgroundImage = `url(${transformedUrl})`;
            
            // Update the stored original data with the transformed version
            appState.originalImageBlob = transformedUrl;
            appState.originalImageData = pageBackground.style.backgroundImage;
            
            showNotification('Perspective transform applied successfully!');
            
            // Disable perspective mode after applying
            disablePerspectiveMode();
            
            // Reset view since image is now aligned
            resetView();
        } else {
            showNotification('Transform failed - no data returned');
        }
        
    } catch (error) {
        showNotification('Error applying perspective transform: ' + error.message);
    }
}

// Window resize handling - update corner positions
const originalResizeHandler = window.onresize;
window.addEventListener('resize', () => {
    if (appState.perspectiveMode) {
        updateCornerPositions();
    }
    if (isGoAvailable()) {
        callGo("SetWindowHeight", window.innerHeight);
    }
});

// Initialize perspective controls
initPerspectiveControls();

// ============================================
// CROP TOOL FUNCTIONS
// ============================================

// Crop tool state
appState.cropMode = false;
appState.cropSelection = null; // { x, y, width, height } in screen coordinates
appState.isDrawingCrop = false;
appState.cropStart = null;

// Crop DOM elements - initialized after DOM is ready
let cropToggle, applyCropBtn, cancelCropBtn, cropOverlay, cropSelection;

function initCropElements() {
    console.log('Initializing crop elements...');
    cropToggle = document.getElementById('cropToggle');
    applyCropBtn = document.getElementById('applyCrop');
    cancelCropBtn = document.getElementById('cancelCrop');
    cropOverlay = document.getElementById('cropOverlay');
    cropSelection = document.getElementById('cropSelection');
    
    console.log('Crop elements found:');
    console.log('  cropToggle:', !!cropToggle, cropToggle);
    console.log('  applyCropBtn:', !!applyCropBtn, applyCropBtn);
    console.log('  cancelCropBtn:', !!cancelCropBtn, cancelCropBtn);
    console.log('  cropOverlay:', !!cropOverlay, cropOverlay);
    console.log('  cropSelection:', !!cropSelection, cropSelection);
    
    // Add click listeners if elements exist and don't already have them
    if (cropToggle && !cropToggle._hasClickListener) {
        console.log('Adding click listener to cropToggle');
        cropToggle.addEventListener('click', function(e) {
            console.log('Crop toggle clicked! Target:', e.target.id, 'Current mode:', appState.cropMode);
            e.preventDefault();
            e.stopPropagation();
            // Only toggle if not already processing
            if (!appState.isTogglingCrop) {
                console.log('Proceeding with toggle');
                toggleCropModeImpl();
            } else {
                console.log('Already toggling, ignoring click');
            }
        });
        cropToggle._hasClickListener = true;
        console.log('Click listener added successfully');
    } else if (cropToggle) {
        console.log('cropToggle already has click listener');
    }
    
    if (applyCropBtn && !applyCropBtn._hasClickListener) {
        console.log('Adding click listener to applyCropBtn');
        applyCropBtn.addEventListener('click', function(e) {
            console.log('=== APPLY CROP BUTTON CLICKED ===');
            console.log('Event target:', e.target.id);
            console.log('cropSelection exists:', !!appState.cropSelection);
            e.preventDefault();
            e.stopPropagation();
            console.log('Calling applyCropImpl...');
            applyCropImpl().then(() => {
                console.log('applyCropImpl completed');
            }).catch(err => {
                console.error('applyCropImpl error:', err);
            });
        });
        applyCropBtn._hasClickListener = true;
        console.log('Apply crop button listener attached successfully');
    }
    
    if (cancelCropBtn && !cancelCropBtn._hasClickListener) {
        console.log('Adding click listener to cancelCropBtn');
        cancelCropBtn.addEventListener('click', function(e) {
            console.log('Cancel crop clicked!');
            e.preventDefault();
            e.stopPropagation();
            cancelCropImpl();
        });
        cancelCropBtn._hasClickListener = true;
    }
}

// Initialize crop elements immediately since script is at end of body
let cropElementsInitialized = false;
function initCropElementsOnce() {
    if (cropElementsInitialized) {
        console.log('Crop elements already initialized, skipping');
        return;
    }
    cropElementsInitialized = true;
    initCropElements();
}

// Initialize immediately
initCropElementsOnce();

// Also try on DOMContentLoaded just in case
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    initCropElementsOnce();
});

// Toggle crop mode
function toggleCropModeImpl() {
    console.log('toggleCropModeImpl called, current state:', appState.cropMode);
    
    // Check if an image is loaded
    const hasImage = pageBackground.style.backgroundImage && 
                     pageBackground.style.backgroundImage !== 'none' &&
                     appState.originalImageBlob;
    
    if (!hasImage) {
        console.log('No image loaded');
        showNotification('Please import an image first');
        return;
    }
    
    // Prevent double-toggle by checking if we're already in the middle of toggling
    if (appState.isTogglingCrop) {
        console.log('Already toggling, ignoring');
        return;
    }
    
    appState.isTogglingCrop = true;
    
    appState.cropMode = !appState.cropMode;
    console.log('Crop mode changed to:', appState.cropMode);
    
    if (appState.cropMode) {
        enableCropMode();
    } else {
        disableCropMode();
    }
    
    // Reset toggle lock after a short delay
    setTimeout(() => {
        appState.isTogglingCrop = false;
    }, 100);
}

// Enable crop mode
function enableCropMode() {
    console.log('Enabling crop mode');
    if (cropToggle) {
        cropToggle.textContent = 'Crop: On';
        cropToggle.classList.add('active');
    }
    if (applyCropBtn) applyCropBtn.style.display = 'inline-block';
    if (cancelCropBtn) cancelCropBtn.style.display = 'inline-block';
    if (cropOverlay) {
        console.log('Setting up crop overlay');
        console.log('cropOverlay element:', cropOverlay);
        console.log('cropOverlay classList before:', cropOverlay.classList.toString());
        
        // Force styles directly on the element - use z-index below container (1000) so buttons remain clickable
        cropOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 100; pointer-events: auto; cursor: crosshair; background: transparent;';
        cropOverlay.style.display = 'block';
        cropOverlay.classList.add('active');
        
        console.log('cropOverlay classList after:', cropOverlay.classList.toString());
        console.log('cropOverlay computed z-index:', window.getComputedStyle(cropOverlay).zIndex);
        console.log('cropOverlay computed pointer-events:', window.getComputedStyle(cropOverlay).pointerEvents);
        
        // Add crop drawing event listeners
        cropOverlay.addEventListener('mousedown', startCropDrawing);
        console.log('Added mousedown listener to cropOverlay');
        console.log('Try clicking and dragging on the screen now!');
    } else {
        console.error('cropOverlay element not found!');
    }
    document.body.classList.add('crop-mode');
    
    // If perspective mode is active, temporarily hide the preview canvas 
    // so we can see the corner handles while cropping
    if (appState.perspectiveMode) {
        const previewCanvas = document.getElementById('perspectivePreviewCanvas');
        if (previewCanvas) {
            previewCanvas.style.opacity = '0.3';
        }
    }
    
    showNotification('Drag on the image to create a crop selection');
}

// Disable crop mode
function disableCropMode() {
    appState.cropMode = false;
    if (cropToggle) {
        cropToggle.textContent = 'Crop: Off';
        cropToggle.classList.remove('active');
    }
    if (applyCropBtn) applyCropBtn.style.display = 'none';
    if (cancelCropBtn) cancelCropBtn.style.display = 'none';
    if (cropOverlay) {
        cropOverlay.style.display = 'none';
        cropOverlay.classList.remove('active');
        // Remove event listeners
        cropOverlay.removeEventListener('mousedown', startCropDrawing);
    }
    document.body.classList.remove('crop-mode');
    
    // Clear selection
    clearCropSelection();
    
    // Restore perspective preview if it was dimmed
    if (appState.perspectiveMode) {
        const previewCanvas = document.getElementById('perspectivePreviewCanvas');
        if (previewCanvas) {
            previewCanvas.style.opacity = '1';
        }
    }
}

// Start drawing crop selection
function startCropDrawing(e) {
    console.log('startCropDrawing called at', e.clientX, e.clientY, 'target:', e.target.id || e.target.className);
    
    if (!appState.cropMode) {
        console.log('Crop mode not active, ignoring click');
        return;
    }
    
    // Don't start drawing if clicking on the container UI
    if (e.target.closest('.container')) {
        console.log('Click in container, ignoring');
        return;
    }
    
    // Only allow drawing when clicking on the actual image background
    // Check if click is within the image bounds
    const imageBounds = getImageBounds();
    if (!imageBounds) {
        console.log('No image bounds available');
        return;
    }
    
    const clickX = e.clientX;
    const clickY = e.clientY;
    
    // Check if click is within image area
    if (clickX < imageBounds.left || clickX > imageBounds.right ||
        clickY < imageBounds.top || clickY > imageBounds.bottom) {
        console.log('Click outside image bounds, ignoring');
        console.log('Click:', clickX, clickY, 'Image bounds:', imageBounds);
        return;
    }
    
    console.log('Click is within image bounds, starting selection');
    
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing selection
    clearCropSelection();
    
    appState.isDrawingCrop = true;
    appState.cropStart = {
        x: e.clientX,
        y: e.clientY
    };
    
    // Show selection element
    if (cropSelection) {
        cropSelection.style.display = 'block';
        cropSelection.classList.add('active');
        
        // Set initial position
        cropSelection.style.left = e.clientX + 'px';
        cropSelection.style.top = e.clientY + 'px';
        cropSelection.style.width = '0px';
        cropSelection.style.height = '0px';
    }
    
    console.log('Started crop drawing at:', appState.cropStart);
    
    // Add move and up listeners
    document.addEventListener('mousemove', updateCropDrawing);
    document.addEventListener('mouseup', endCropDrawing);
}

// Update crop selection while dragging
function updateCropDrawing(e) {
    if (!appState.isDrawingCrop) return;
    
    const startX = appState.cropStart.x;
    const startY = appState.cropStart.y;
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    // Calculate rectangle
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    // Update selection element
    if (cropSelection) {
        cropSelection.style.left = left + 'px';
        cropSelection.style.top = top + 'px';
        cropSelection.style.width = width + 'px';
        cropSelection.style.height = height + 'px';
        // Ensure selection is visible
        cropSelection.style.display = 'block';
        cropSelection.style.zIndex = '10000';
    }
}

// End drawing crop selection
function endCropDrawing(e) {
    console.log('endCropDrawing called');
    if (!appState.isDrawingCrop) {
        console.log('Not drawing, ignoring');
        return;
    }
    
    appState.isDrawingCrop = false;
    
    const startX = appState.cropStart.x;
    const startY = appState.cropStart.y;
    const endX = e.clientX;
    const endY = e.clientY;
    
    console.log('Start:', startX, startY, 'End:', endX, endY);
    
    // Store the selection
    appState.cropSelection = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY)
    };
    
    console.log('Selection:', appState.cropSelection);
    
    // Remove event listeners
    document.removeEventListener('mousemove', updateCropDrawing);
    document.removeEventListener('mouseup', endCropDrawing);
    
    // Only keep selection if it has meaningful size (lowered to 5 pixels)
    if (appState.cropSelection.width < 5 || appState.cropSelection.height < 5) {
        console.log('Selection too small:', appState.cropSelection.width, 'x', appState.cropSelection.height);
        clearCropSelection();
        showNotification('Selection too small, please try again');
    } else {
        console.log('Selection accepted, adding handles');
        // Add resize handles
        addCropHandles();
        showNotification('Selection created! Click Apply Crop to crop the image.');
    }
}

// Add resize handles to crop selection
function addCropHandles() {
    if (!cropSelection) return;
    const handles = ['tl', 'tr', 'bl', 'br'];
    handles.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `crop-handle ${pos}`;
        handle.dataset.handle = pos;
        handle.addEventListener('mousedown', (e) => startResizeCrop(e, pos));
        cropSelection.appendChild(handle);
    });
}

// Start resizing crop selection
function startResizeCrop(e, handle) {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startSelection = { ...appState.cropSelection };
    
    function resize(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newX = startSelection.x;
        let newY = startSelection.y;
        let newWidth = startSelection.width;
        let newHeight = startSelection.height;
        
        switch(handle) {
            case 'tl':
                newX = startSelection.x + dx;
                newY = startSelection.y + dy;
                newWidth = startSelection.width - dx;
                newHeight = startSelection.height - dy;
                break;
            case 'tr':
                newY = startSelection.y + dy;
                newWidth = startSelection.width + dx;
                newHeight = startSelection.height - dy;
                break;
            case 'bl':
                newX = startSelection.x + dx;
                newWidth = startSelection.width - dx;
                newHeight = startSelection.height + dy;
                break;
            case 'br':
                newWidth = startSelection.width + dx;
                newHeight = startSelection.height + dy;
                break;
        }
        
        // Ensure minimum size
        if (newWidth >= 10 && newHeight >= 10) {
            appState.cropSelection = { x: newX, y: newY, width: newWidth, height: newHeight };
            if (cropSelection) {
                cropSelection.style.left = newX + 'px';
                cropSelection.style.top = newY + 'px';
                cropSelection.style.width = newWidth + 'px';
                cropSelection.style.height = newHeight + 'px';
            }
        }
    }
    
    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }
    
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
}

// Clear crop selection
function clearCropSelection() {
    appState.cropSelection = null;
    if (cropSelection) {
        cropSelection.style.display = 'none';
        cropSelection.classList.remove('active');
        cropSelection.innerHTML = '';
    }
}

// Cancel crop
function cancelCropImpl() {
    // Hide the crop selection
    if (cropSelection) {
        cropSelection.style.display = 'none';
        cropSelection.style.borderColor = '';
        cropSelection.style.background = '';
    }
    
    clearCropSelection();
    disableCropMode();
}

// Convert screen coordinates to image coordinates
// If perspective mode is active, this accounts for the perspective transform
function screenToImageCoords(screenX, screenY) {
    if (!appState.rawImageWidth || !appState.rawImageHeight) {
        return null;
    }
    
    // If perspective mode is active and preview is showing, we need to account
    // for the perspective transform when converting coordinates
    if (appState.perspectiveMode && appState.cornerPoints) {
        return screenToImageCoordsPerspective(screenX, screenY);
    }
    
    const bounds = getImageBounds();
    if (!bounds) return null;
    
    // Check if point is within image bounds
    if (screenX < bounds.left || screenX > bounds.right ||
        screenY < bounds.top || screenY > bounds.bottom) {
        return null;
    }
    
    // Calculate normalized position within image (0-1)
    const normX = (screenX - bounds.left) / bounds.width;
    const normY = (screenY - bounds.top) / bounds.height;
    
    // Convert to raw image pixel coordinates
    return {
        x: normX * appState.rawImageWidth,
        y: normY * appState.rawImageHeight
    };
}

// Convert screen coordinates to image coordinates using perspective transform
function screenToImageCoordsPerspective(screenX, screenY) {
    const bounds = getImageBounds();
    if (!bounds || !appState.cornerPoints) return null;
    
    // Get the four corner points in screen coordinates (convert from raw pixels)
    const dstCorners = appState.cornerPoints.map(p => ({
        x: bounds.left + (p.x / appState.rawImageWidth) * bounds.width,
        y: bounds.top + (p.y / appState.rawImageHeight) * bounds.height
    }));
    
    // Source rectangle corners (original image display bounds)
    const srcCorners = [
        { x: bounds.left, y: bounds.top },      // top-left
        { x: bounds.right, y: bounds.top },     // top-right
        { x: bounds.right, y: bounds.bottom },  // bottom-right
        { x: bounds.left, y: bounds.bottom }    // bottom-left
    ];
    
    // Compute inverse homography (maps screen coords back to original image)
    const H = computeHomography(dstCorners, srcCorners);
    const invH = invertMatrix3x3(H);
    
    if (!invH) return null;
    
    // Apply inverse homography to get source coordinate
    const srcCoord = applyHomography(invH, screenX, screenY);
    
    // Check if within source bounds
    if (srcCoord.x < bounds.left || srcCoord.x > bounds.right ||
        srcCoord.y < bounds.top || srcCoord.y > bounds.bottom) {
        return null;
    }
    
    // Convert to normalized and then to raw pixel coordinates
    const normX = (srcCoord.x - bounds.left) / bounds.width;
    const normY = (srcCoord.y - bounds.top) / bounds.height;
    
    return {
        x: normX * appState.rawImageWidth,
        y: normY * appState.rawImageHeight
    };
}

// Apply crop - this actually crops the image and updates the state
async function applyCropImpl() {
    console.log('=== APPLY CROP STARTED ===');
    console.log('cropSelection:', appState.cropSelection);
    console.log('originalImageBlob available:', !!appState.originalImageBlob);
    console.log('window.go exists:', !!window.go);
    console.log('window.go.main exists:', !!(window.go && window.go.main));
    console.log('window.go.main.App exists:', !!(window.go && window.go.main && window.go.main.App));
    
    // Check what methods are available
    if (window.go && window.go.main && window.go.main.App) {
        console.log('Available methods in App:', Object.keys(window.go.main.App));
        console.log('ApplyCrop method exists:', typeof window.go.main.App.ApplyCrop);
    }
    
    if (!appState.cropSelection) {
        console.log('ERROR: No crop selection');
        showNotification('Please draw a selection first');
        return;
    }
    
    if (!window.go || !window.go.main || !window.go.main.App) {
        console.log('ERROR: Backend not available');
        showNotification('Backend not available - Go runtime not loaded');
        return;
    }
    
    if (!window.go.main.App.ApplyCrop) {
        console.log('ERROR: ApplyCrop method not found in backend');
        showNotification('Backend method not available - please restart the app');
        return;
    }
    
    if (!appState.originalImageBlob) {
        console.log('ERROR: No image data');
        showNotification('No image data available');
        return;
    }
    
    try {
        console.log('Converting coordinates...');
        showNotification('Applying crop...');
        
        // Convert screen coordinates to image coordinates
        console.log('Selection coordinates:', appState.cropSelection);
        const topLeft = screenToImageCoords(appState.cropSelection.x, appState.cropSelection.y);
        const bottomRight = screenToImageCoords(
            appState.cropSelection.x + appState.cropSelection.width,
            appState.cropSelection.y + appState.cropSelection.height
        );
        
        console.log('topLeft:', topLeft);
        console.log('bottomRight:', bottomRight);
        
        if (!topLeft || !bottomRight) {
            console.log('ERROR: Coordinates outside bounds');
            showNotification('Selection is outside image bounds');
            return;
        }
        
        console.log('Preparing image data...');
        // Get the base64 data (without the data URL prefix)
        const base64Data = appState.originalImageBlob.split(',')[1];
        console.log('Base64 data length:', base64Data.length);
        console.log('First 50 chars of base64:', base64Data.substring(0, 50));
        
        console.log('Calling backend ApplyCrop with params:');
        console.log('  x:', Math.round(topLeft.x));
        console.log('  y:', Math.round(topLeft.y));
        console.log('  width:', Math.round(bottomRight.x - topLeft.x));
        console.log('  height:', Math.round(bottomRight.y - topLeft.y));
        
        // Send to backend for actual cropping - pass base64 string directly
        // Wails v2 will handle the []byte conversion from base64
        const croppedData = await callGo("ApplyCrop",
            base64Data,  // Pass base64 string, not array
            Math.round(topLeft.x),
            Math.round(topLeft.y),
            Math.round(bottomRight.x - topLeft.x),
            Math.round(bottomRight.y - topLeft.y)
        );
        
        console.log('Backend returned cropped data:', croppedData ? 'YES' : 'NO');
        console.log('Cropped data type:', typeof croppedData);
        console.log('Cropped data length:', croppedData ? croppedData.length : 0);
        console.log('CODE VERSION: 2.0');
        
        if (croppedData && croppedData.length > 0) {
            console.log('Processing cropped image...');
            
            // Wails returns []byte as array of characters
            let croppedUrl;
            let base64String = '';
            
            if (typeof croppedData === 'string') {
                console.log('Received string from Wails');
                base64String = croppedData;
            } else {
                // It's an array of characters from Wails
                console.log('Received array from Wails, joining...');
                
                // Fast join using array method
                if (Array.isArray(croppedData)) {
                    base64String = croppedData.join('');
                } else {
                    // Convert to array first
                    const arr = [];
                    for (let i = 0; i < croppedData.length; i++) {
                        arr.push(croppedData[i]);
                    }
                    base64String = arr.join('');
                }
            }
            
            console.log('Base64 string length:', base64String.length);
            console.log('Base64 starts with:', base64String.substring(0, 50));
            console.log('Base64 ends with:', base64String.substring(base64String.length - 20));
            
            // Build data URL
            croppedUrl = `data:image/png;base64,${base64String}`;
            console.log('Cropped URL created, length:', croppedUrl.length);
            console.log('Setting background image...');
            
            // First verify the image loads
            const testImg = new Image();
            testImg.onload = () => {
                console.log('Cropped image loaded successfully:', testImg.naturalWidth, 'x', testImg.naturalHeight);
                
                // Now update the background
                pageBackground.style.backgroundImage = `url(${croppedUrl})`;
                pageBackground.style.backgroundSize = 'contain';
                pageBackground.style.backgroundRepeat = 'no-repeat';
                pageBackground.style.backgroundPosition = 'center center';
                pageBackground.style.opacity = '1';
                
                // Update the stored original data with the cropped version
                appState.originalImageBlob = croppedUrl;
                appState.originalImageData = pageBackground.style.backgroundImage;
                
                // Update raw dimensions after crop
                appState.rawImageWidth = testImg.naturalWidth;
                appState.rawImageHeight = testImg.naturalHeight;
                
                // Reset corner points to the new cropped image bounds
                resetCornersToImageBounds();
                
                // Update backend with new dimensions
                if (isGoAvailable()) {
                    callGo("SetImageDimensions", appState.rawImageWidth, appState.rawImageHeight);
                }
                
                // Disable crop mode after applying
                disableCropMode();
                
                // Reset view
                resetView();
                
                showNotification('Crop applied successfully!');
            };
            testImg.onerror = (err) => {
                console.error('Failed to load cropped image:', err);
                showNotification('Error: Failed to load cropped image');
            };
            testImg.src = croppedUrl;
        } else {
            showNotification('Crop failed - no data returned');
        }
        
    } catch (error) {
        console.error('Crop error:', error);
        showNotification('Error applying crop: ' + error.message);
    }
}

// ============================================
// CROP PREVIEW MODAL FUNCTIONS
// ============================================

// Crop preview modal state
let cropPreviewModal, cropPreviewImage, cropPreviewSelection, cropPreviewApplyBtn, cropPreviewSkipBtn;
let cropPreviewSelectionData = null;
let isDrawingCropPreview = false;
let cropPreviewStart = null;
let rotateLeftBtn, rotateRightBtn, rotationIndicator;
let cropPreviewRotationAngle = 0; // Rotation angle for preview modal
let cropPreviewOriginalImage = null; // Store original image for efficient rotation
let rotationCanvas = null; // Reusable canvas for rotation

// Initialize crop preview elements
function initCropPreviewElements() {
    cropPreviewModal = document.getElementById('cropPreviewModal');
    cropPreviewImage = document.getElementById('cropPreviewImage');
    cropPreviewSelection = document.getElementById('cropPreviewSelection');
    cropPreviewApplyBtn = document.getElementById('cropPreviewApply');
    cropPreviewSkipBtn = document.getElementById('cropPreviewSkip');
    rotateLeftBtn = document.getElementById('rotateLeftBtn');
    rotateRightBtn = document.getElementById('rotateRightBtn');
    rotationIndicator = document.getElementById('rotationIndicator');

    if (cropPreviewApplyBtn) {
        cropPreviewApplyBtn.addEventListener('click', applyCropFromPreview);
    }

    if (cropPreviewSkipBtn) {
        cropPreviewSkipBtn.addEventListener('click', skipCropPreview);
    }

    // Rotation button handlers
    if (rotateLeftBtn) {
        rotateLeftBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            rotatePreviewImage(-90);
        });
    }

    if (rotateRightBtn) {
        rotateRightBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            rotatePreviewImage(90);
        });
    }
}

// Rotate the preview image by specified degrees - optimized version
function rotatePreviewImage(degrees) {
    if (!cropPreviewOriginalImage) return;

    // Prevent multiple rapid rotations
    if (rotateLeftBtn) rotateLeftBtn.disabled = true;
    if (rotateRightBtn) rotateRightBtn.disabled = true;

    // Calculate new rotation angle
    cropPreviewRotationAngle = (cropPreviewRotationAngle + degrees + 360) % 360;

    // Update the rotation indicator
    if (rotationIndicator) {
        rotationIndicator.textContent = cropPreviewRotationAngle + '°';
    }

    // Show loading state
    cropPreviewImage.style.opacity = '0.5';
    cropPreviewImage.style.filter = 'blur(2px)';

    // Use requestAnimationFrame to prevent UI blocking
    requestAnimationFrame(() => {
        performFastRotation();
    });
}

// Perform the actual rotation using optimized canvas operations
function performFastRotation() {
    const img = cropPreviewOriginalImage;
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    // Create or reuse canvas
    if (!rotationCanvas) {
        rotationCanvas = document.createElement('canvas');
    }

    const canvas = rotationCanvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Swap dimensions for 90/270 degree rotations
    if (cropPreviewRotationAngle === 90 || cropPreviewRotationAngle === 270) {
        canvas.width = height;
        canvas.height = width;
    } else {
        canvas.width = width;
        canvas.height = height;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply rotation transformation
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((cropPreviewRotationAngle * Math.PI) / 180);
    ctx.drawImage(img, -width / 2, -height / 2);
    ctx.restore();

    // Convert to data URL with lower quality for speed (0.9 is a good balance)
    // Use JPEG for better performance unless we need transparency
    const rotatedUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Create a new image to preload before updating display
    const preloader = new Image();
    preloader.onload = () => {
        // Update the preview image source
        cropPreviewImage.src = rotatedUrl;

        // Restore opacity
        cropPreviewImage.style.opacity = '1';
        cropPreviewImage.style.filter = 'none';

        // Re-enable rotation buttons
        if (rotateLeftBtn) rotateLeftBtn.disabled = false;
        if (rotateRightBtn) rotateRightBtn.disabled = false;

        // Clear any existing selection since the image rotated
        clearCropPreviewSelection();
    };
    preloader.onerror = () => {
        // Re-enable buttons even on error
        if (rotateLeftBtn) rotateLeftBtn.disabled = false;
        if (rotateRightBtn) rotateRightBtn.disabled = false;
        cropPreviewImage.style.opacity = '1';
        cropPreviewImage.style.filter = 'none';
    };
    preloader.src = rotatedUrl;
}

// Read Exif orientation from image data - optimized version
async function getExifOrientation(imageDataUrl) {
    return new Promise((resolve) => {
        // Only process JPEG images
        if (!imageDataUrl.startsWith('data:image/jpeg')) {
            resolve(1); // Default orientation for non-JPEG
            return;
        }

        // Extract base64 data and decode
        try {
            const base64Data = imageDataUrl.split(',')[1];
            const binaryString = atob(base64Data);

            // Only read first 64KB which should contain all Exif data
            const maxBytes = Math.min(binaryString.length, 65536);
            const bytes = new Uint8Array(maxBytes);

            for (let i = 0; i < maxBytes; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const view = new DataView(bytes.buffer);

            // Check for JPEG magic number
            if (view.getUint16(0, false) !== 0xFFD8) {
                resolve(1);
                return;
            }

            let offset = 2;
            while (offset < bytes.length - 4) {
                const marker = view.getUint16(offset, false);

                // APP1 marker (Exif)
                if (marker === 0xFFE1) {
                    if (offset + 8 > bytes.length) break;

                    const segmentLength = view.getUint16(offset + 2, false);
                    const exifOffset = offset + 4;

                    // Check for Exif header
                    if (exifOffset + 6 > bytes.length) break;

                    const exifHeader = String.fromCharCode(
                        bytes[exifOffset],
                        bytes[exifOffset + 1],
                        bytes[exifOffset + 2],
                        bytes[exifOffset + 3]
                    );

                    if (exifHeader === 'Exif') {
                        const tiffOffset = exifOffset + 6;
                        if (tiffOffset + 8 > bytes.length) break;

                        const isLittleEndian = view.getUint16(tiffOffset, false) === 0x4949;
                        const ifdOffset = view.getUint32(tiffOffset + 4, isLittleEndian);

                        if (tiffOffset + ifdOffset + 2 > bytes.length) break;

                        const numEntries = view.getUint16(tiffOffset + ifdOffset, isLittleEndian);

                        // Search for orientation tag (0x0112)
                        for (let i = 0; i < numEntries && i < 20; i++) {
                            const entryOffset = tiffOffset + ifdOffset + 2 + (i * 12);
                            if (entryOffset + 10 > bytes.length) break;

                            const tag = view.getUint16(entryOffset, isLittleEndian);

                            if (tag === 0x0112) {
                                const orientation = view.getUint16(entryOffset + 8, isLittleEndian);
                                resolve(orientation);
                                return;
                            }
                        }
                    }

                    offset += 2 + segmentLength;
                } else if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFD9 || marker === 0xFFDA) {
                    // Invalid marker or end of image
                    break;
                } else {
                    // Skip other segments
                    if (offset + 4 > bytes.length) break;
                    const segmentLength = view.getUint16(offset + 2, false);
                    offset += 2 + segmentLength;
                }
            }

            resolve(1); // Default orientation
        } catch (e) {
            resolve(1); // Default on error
        }
    });
}

// Normalize image orientation by drawing to canvas
async function normalizeImageOrientation(imageDataUrl) {
    const orientation = await getExifOrientation(imageDataUrl);
    
    if (orientation === 1) {
        // No transformation needed
        return imageDataUrl;
    }
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions based on orientation
            if (orientation >= 5) {
                // 90 or 270 degree rotation - swap dimensions
                canvas.width = img.naturalHeight;
                canvas.height = img.naturalWidth;
            } else {
                // 0 or 180 degree rotation - keep dimensions
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
            }
            
            // Apply transformations based on orientation
            ctx.save();
            
            switch (orientation) {
                case 2: // Flip horizontal
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                    break;
                case 3: // Rotate 180
                    ctx.translate(canvas.width, canvas.height);
                    ctx.rotate(Math.PI);
                    break;
                case 4: // Flip vertical
                    ctx.translate(0, canvas.height);
                    ctx.scale(1, -1);
                    break;
                case 5: // Flip horizontal then rotate 90 CW
                    ctx.translate(canvas.width, 0);
                    ctx.rotate(Math.PI / 2);
                    ctx.scale(-1, 1);
                    break;
                case 6: // Rotate 90 CW
                    ctx.translate(canvas.width, 0);
                    ctx.rotate(Math.PI / 2);
                    break;
                case 7: // Flip horizontal then rotate 90 CCW
                    ctx.translate(0, canvas.height);
                    ctx.rotate(-Math.PI / 2);
                    ctx.scale(-1, 1);
                    break;
                case 8: // Rotate 90 CCW
                    ctx.translate(0, canvas.height);
                    ctx.rotate(-Math.PI / 2);
                    break;
            }
            
            ctx.drawImage(img, 0, 0);
            ctx.restore();

            // Convert back to data URL using JPEG for better performance
            // JPEG is much faster than PNG and we don't need transparency
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.src = imageDataUrl;
    });
}

// Show crop preview modal
async function showCropPreviewModal(imageDataUrl) {
    if (!cropPreviewModal) {
        initCropPreviewElements();
    }

    // Normalize image orientation first
    showNotification('Processing image...');
    const normalizedImageUrl = await normalizeImageOrientation(imageDataUrl);

    // Load the normalized image and store it for efficient rotation
    cropPreviewOriginalImage = new Image();
    cropPreviewOriginalImage.onload = () => {
        // Set the preview image
        cropPreviewImage.src = normalizedImageUrl;
    };
    cropPreviewOriginalImage.src = normalizedImageUrl;

    // Reset rotation
    cropPreviewRotationAngle = 0;
    if (rotationIndicator) {
        rotationIndicator.textContent = '0°';
    }

    // Reset selection
    cropPreviewSelectionData = null;
    cropPreviewSelection.style.display = 'none';
    cropPreviewSelection.classList.remove('active');

    // Disable apply button until selection is made
    cropPreviewApplyBtn.disabled = true;
    cropPreviewApplyBtn.textContent = 'Apply Crop';

    // Show modal
    cropPreviewModal.style.display = 'flex';
    
    // Add event listeners for drawing selection
    const container = document.querySelector('.crop-preview-container');
    container.addEventListener('mousedown', startCropPreviewDrawing);
}

// Start drawing crop selection in preview
function startCropPreviewDrawing(e) {
    if (e.target !== cropPreviewImage && e.target !== document.querySelector('.crop-preview-container')) {
        return;
    }
    
    e.preventDefault();
    
    const container = document.querySelector('.crop-preview-container');
    const rect = container.getBoundingClientRect();
    
    // Clear existing selection
    clearCropPreviewSelection();
    
    isDrawingCropPreview = true;
    cropPreviewStart = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    // Show selection element
    cropPreviewSelection.style.display = 'block';
    cropPreviewSelection.classList.add('active');
    cropPreviewSelection.style.left = cropPreviewStart.x + 'px';
    cropPreviewSelection.style.top = cropPreviewStart.y + 'px';
    cropPreviewSelection.style.width = '0px';
    cropPreviewSelection.style.height = '0px';
    
    document.addEventListener('mousemove', updateCropPreviewDrawing);
    document.addEventListener('mouseup', endCropPreviewDrawing);
}

// Update crop selection while dragging
function updateCropPreviewDrawing(e) {
    if (!isDrawingCropPreview) return;
    
    const container = document.querySelector('.crop-preview-container');
    const rect = container.getBoundingClientRect();
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const left = Math.min(cropPreviewStart.x, currentX);
    const top = Math.min(cropPreviewStart.y, currentY);
    const width = Math.abs(currentX - cropPreviewStart.x);
    const height = Math.abs(currentY - cropPreviewStart.y);
    
    cropPreviewSelection.style.left = left + 'px';
    cropPreviewSelection.style.top = top + 'px';
    cropPreviewSelection.style.width = width + 'px';
    cropPreviewSelection.style.height = height + 'px';
}

// End drawing crop selection
function endCropPreviewDrawing(e) {
    if (!isDrawingCropPreview) return;
    
    isDrawingCropPreview = false;
    
    const container = document.querySelector('.crop-preview-container');
    const rect = container.getBoundingClientRect();
    
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    const left = Math.min(cropPreviewStart.x, endX);
    const top = Math.min(cropPreviewStart.y, endY);
    const width = Math.abs(endX - cropPreviewStart.x);
    const height = Math.abs(endY - cropPreviewStart.y);
    
    document.removeEventListener('mousemove', updateCropPreviewDrawing);
    document.removeEventListener('mouseup', endCropPreviewDrawing);
    
    // Only keep selection if it has meaningful size
    if (width >= 10 && height >= 10) {
        cropPreviewSelectionData = { x: left, y: top, width, height };
        cropPreviewApplyBtn.disabled = false;
        cropPreviewApplyBtn.textContent = 'Apply Crop';
    } else {
        clearCropPreviewSelection();
    }
}

// Clear crop preview selection
function clearCropPreviewSelection() {
    cropPreviewSelectionData = null;
    cropPreviewSelection.style.display = 'none';
    cropPreviewSelection.classList.remove('active');
    cropPreviewApplyBtn.disabled = true;
}

// Apply crop from preview modal
async function applyCropFromPreview() {
    if (!cropPreviewSelectionData || !cropPreviewImage.src) return;
    
    cropPreviewApplyBtn.disabled = true;
    cropPreviewApplyBtn.textContent = 'Processing...';
    
    try {
        // Get image natural dimensions
        const img = new Image();
        img.src = cropPreviewImage.src;
        await new Promise(resolve => {
            img.onload = resolve;
        });
        
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        // Get displayed dimensions
        const displayedWidth = cropPreviewImage.clientWidth;
        const displayedHeight = cropPreviewImage.clientHeight;
        
        // Get image position within container
        const container = document.querySelector('.crop-preview-container');
        const containerRect = container.getBoundingClientRect();
        const imageRect = cropPreviewImage.getBoundingClientRect();
        
        const imageOffsetX = imageRect.left - containerRect.left;
        const imageOffsetY = imageRect.top - containerRect.top;
        
        // Convert selection from container coordinates to image coordinates
        const selectionRelativeX = cropPreviewSelectionData.x - imageOffsetX;
        const selectionRelativeY = cropPreviewSelectionData.y - imageOffsetY;
        
        // Scale to natural dimensions
        const scaleX = naturalWidth / displayedWidth;
        const scaleY = naturalHeight / displayedHeight;
        
        const cropX = Math.round(selectionRelativeX * scaleX);
        const cropY = Math.round(selectionRelativeY * scaleY);
        const cropWidth = Math.round(cropPreviewSelectionData.width * scaleX);
        const cropHeight = Math.round(cropPreviewSelectionData.height * scaleY);
        
        // Ensure valid crop dimensions
        const finalX = Math.max(0, cropX);
        const finalY = Math.max(0, cropY);
        const finalWidth = Math.min(cropWidth, naturalWidth - finalX);
        const finalHeight = Math.min(cropHeight, naturalHeight - finalY);
        
        if (finalWidth <= 0 || finalHeight <= 0) {
            showNotification('Invalid crop selection');
            cropPreviewApplyBtn.disabled = false;
            cropPreviewApplyBtn.textContent = 'Apply Crop';
            return;
        }
        
        // Apply crop using backend
        const base64Data = cropPreviewImage.src.split(',')[1];
        const croppedData = await callGo("ApplyCrop", base64Data, finalX, finalY, finalWidth, finalHeight);
        
        if (croppedData && croppedData.length > 0) {
            // Process cropped data
            let base64String = '';
            if (typeof croppedData === 'string') {
                base64String = croppedData;
            } else if (Array.isArray(croppedData)) {
                base64String = croppedData.join('');
            } else {
                const arr = [];
                for (let i = 0; i < croppedData.length; i++) {
                    arr.push(croppedData[i]);
                }
                base64String = arr.join('');
            }
            
            const croppedUrl = `data:image/png;base64,${base64String}`;
            
            // Load the cropped image to get dimensions
            const croppedImg = new Image();
            croppedImg.onload = () => {
                // Set the image
                pageBackground.style.backgroundImage = `url(${croppedUrl})`;
                document.body.style.background = 'none';

                // Store original image data
                appState.originalImageBlob = croppedUrl;
                appState.originalImageData = pageBackground.style.backgroundImage;

                // Update dimensions
                appState.rawImageWidth = croppedImg.naturalWidth;
                appState.rawImageHeight = croppedImg.naturalHeight;

                // Store the rotation angle for reference
                appState.rotationAngle = cropPreviewRotationAngle;

                // Reset view
                resetView();
                
                // Close modal
                hideCropPreviewModal();
                
                showNotification('Image cropped successfully!');
            };
            croppedImg.src = croppedUrl;
        } else {
            showNotification('Crop failed - no data returned');
            cropPreviewApplyBtn.disabled = false;
            cropPreviewApplyBtn.textContent = 'Apply Crop';
        }
    } catch (error) {
        console.error('Crop error:', error);
        showNotification('Error applying crop: ' + error.message);
        cropPreviewApplyBtn.disabled = false;
        cropPreviewApplyBtn.textContent = 'Apply Crop';
    }
}

// Skip crop and use full image
function skipCropPreview() {
    const imageDataUrl = cropPreviewImage.src;

    // Load the full image
    const img = new Image();
    img.onload = () => {
        pageBackground.style.backgroundImage = `url(${imageDataUrl})`;
        document.body.style.background = 'none';

        // Store original image data
        appState.originalImageBlob = imageDataUrl;
        appState.originalImageData = pageBackground.style.backgroundImage;

        // Update dimensions - account for rotation
        appState.rawImageWidth = img.naturalWidth;
        appState.rawImageHeight = img.naturalHeight;

        // Store the rotation angle for reference
        appState.rotationAngle = cropPreviewRotationAngle;

        // Reset view
        resetView();

        // Close modal
        hideCropPreviewModal();

        showNotification('Image imported successfully. You can now use perspective transform.');
    };
    img.onerror = (err) => {
        console.error('Failed to load image:', err);
        showNotification('Error loading image');
    };
    img.src = imageDataUrl;
}

// Hide crop preview modal
function hideCropPreviewModal() {
    cropPreviewModal.style.display = 'none';
    cropPreviewImage.src = '';
    clearCropPreviewSelection();

    // Clean up stored image and canvas to free memory
    cropPreviewOriginalImage = null;
    if (rotationCanvas) {
        rotationCanvas.width = 0;
        rotationCanvas.height = 0;
        rotationCanvas = null;
    }

    // Remove event listeners
    const container = document.querySelector('.crop-preview-container');
    if (container) {
        container.removeEventListener('mousedown', startCropPreviewDrawing);
    }
}

// Initialize crop preview on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initCropPreviewElements();
});

// Immediate initialization check
console.log('=== APP.JS EXECUTING ===');
console.log('Window toggleCropMode:', typeof window.toggleCropMode);
console.log('Window applyCrop:', typeof window.applyCrop);
console.log('Window cancelCrop:', typeof window.cancelCrop);

// Find crop elements immediately
cropToggle = document.getElementById('cropToggle');
applyCropBtn = document.getElementById('applyCrop');
cancelCropBtn = document.getElementById('cancelCrop');
cropOverlay = document.getElementById('cropOverlay');
cropSelection = document.getElementById('cropSelection');

console.log('Crop elements found on init:');
console.log('  cropToggle:', cropToggle ? 'YES' : 'NO', cropToggle);
console.log('  applyCropBtn:', applyCropBtn ? 'YES' : 'NO');
console.log('  cancelCropBtn:', cancelCropBtn ? 'YES' : 'NO');
console.log('  cropOverlay:', cropOverlay ? 'YES' : 'NO');
console.log('  cropSelection:', cropSelection ? 'YES' : 'NO');

console.log('Checking if crop functions are defined:');
console.log('  toggleCropModeImpl:', typeof toggleCropModeImpl);
console.log('  applyCropImpl:', typeof applyCropImpl);
console.log('  cancelCropImpl:', typeof cancelCropImpl);

// Set initial background color on startup
if (pageBackground) {
    pageBackground.style.backgroundColor = '#11111b';
}

console.log('Usage Reader with perspective transform and crop tool initialized');

// ============================================
// MEMORY MONITORING AND DEBUGGING FUNCTIONS
// ============================================

// Listen for memory warnings from backend
if (window.runtime && window.runtime.EventsOn) {
    window.runtime.EventsOn('memory-warning', (data) => {
        console.warn('Memory warning from backend:', data);
        showNotification(`Warning: High memory usage (${data.heapAllocMB}MB)`);
    });
}

// Get memory stats from backend
async function getBackendMemoryStats() {
    if (!isGoAvailable()) {
        console.log('Go backend not available');
        return null;
    }
    try {
        const stats = await callGo('GetMemoryStats');
        console.log('Backend memory stats:', stats);
        return stats;
    } catch (err) {
        console.error('Error getting memory stats:', err);
        return null;
    }
}

// Force garbage collection in backend
async function forceBackendGC() {
    if (!isGoAvailable()) {
        console.log('Go backend not available');
        return null;
    }
    try {
        const result = await callGo('ForceGarbageCollection');
        console.log('Garbage collection result:', result);
        showNotification(`GC completed: ${(result.heapFreed / 1024 / 1024).toFixed(2)}MB freed`);
        return result;
    } catch (err) {
        console.error('Error forcing GC:', err);
        return null;
    }
}

// Get frontend memory info (Chrome/Edge only)
function getFrontendMemoryInfo() {
    if (performance && performance.memory) {
        const memory = performance.memory;
        return {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usedMB: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
            totalMB: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
            limitMB: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
        };
    }
    return null;
}

// Comprehensive memory report
async function getMemoryReport() {
    const report = {
        timestamp: new Date().toISOString(),
        frontend: getFrontendMemoryInfo(),
        backend: await getBackendMemoryStats(),
        frontendState: {
            hasImage: !!appState.originalImageBlob,
            imageDataLength: appState.originalImageBlob ? appState.originalImageBlob.length : 0,
            imageDataMB: appState.originalImageBlob ? (appState.originalImageBlob.length / 1024 / 1024).toFixed(2) : 0,
            perspectiveMode: appState.perspectiveMode,
            cropMode: appState.cropMode,
            mode: appState.mode
        }
    };
    
    console.log('=== MEMORY REPORT ===', report);
    return report;
}

// Periodic memory monitoring
function startMemoryMonitoring(intervalMs = 60000) {
    console.log(`Starting memory monitoring every ${intervalMs}ms`);
    
    // Initial check
    getMemoryReport();
    
    // Set up interval
    const intervalId = setInterval(async () => {
        const report = await getMemoryReport();
        
        // Check for high memory usage
        const frontendMB = report.frontend ? parseFloat(report.frontend.usedMB) : 0;
        const backendMB = report.backend ? report.backend.heapAlloc / 1024 / 1024 : 0;
        const imageMB = parseFloat(report.frontendState.imageDataMB);
        
        const totalMB = frontendMB + backendMB;
        
        if (totalMB > 500) { // 500MB threshold
            console.warn(`High memory usage detected: ${totalMB.toFixed(2)}MB total`);
            showNotification(`High memory usage: ${totalMB.toFixed(0)}MB`);
            
            // Try to free memory
            await cleanupMemory();
        }
        
        // Log every 5 minutes regardless
        if (Date.now() - appState.lastMemoryCheck > 300000) {
            console.log('Periodic memory check:', {
                frontend: `${frontendMB.toFixed(2)}MB`,
                backend: `${backendMB.toFixed(2)}MB`,
                image: `${imageMB.toFixed(2)}MB`
            });
            appState.lastMemoryCheck = Date.now();
        }
    }, intervalMs);
    
    // Return function to stop monitoring
    return () => clearInterval(intervalId);
}

// Memory cleanup function
async function cleanupMemory() {
    console.log('Running memory cleanup...');
    
    // 1. Clear any unused canvases
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
        if (canvas.id !== 'perspectivePreviewCanvas' && !canvas.parentElement) {
            canvas.width = 0;
            canvas.height = 0;
        }
    });
    
    // 2. Force backend GC
    await forceBackendGC();
    
    // 3. Clear image blob if no longer needed (optional - be careful with this)
    // Only clear if we're not in the middle of processing
    if (!appState.perspectiveMode && !appState.cropMode && !appState.mode) {
        // Safe to potentially clear, but let's keep it for now
        // and just ensure we're not holding duplicates
    }
    
    // 4. Get report after cleanup
    const afterReport = await getMemoryReport();
    console.log('Memory cleanup completed');
    
    return afterReport;
}

// Expose memory functions globally for debugging
window.getMemoryReport = getMemoryReport;
window.forceBackendGC = forceBackendGC;
window.getBackendMemoryStats = getBackendMemoryStats;
window.getFrontendMemoryInfo = getFrontendMemoryInfo;
window.cleanupMemory = cleanupMemory;

// Start monitoring when app initializes
if (isGoAvailable()) {
    startMemoryMonitoring(60000); // Check every minute
    initMemoryUI();
}

// Memory UI controls
let memoryMonitoringEnabled = false;
let memoryMonitoringInterval = null;

function initMemoryUI() {
    const memoryStatus = document.getElementById('memoryStatus');
    const memoryValue = document.getElementById('memoryValue');
    const cleanupBtn = document.getElementById('memoryCleanupBtn');
    const toggleBtn = document.getElementById('memoryToggleBtn');
    
    if (!memoryStatus) return;
    
    // Show the memory status container
    memoryStatus.style.display = 'flex';
    
    // Cleanup button
    if (cleanupBtn) {
        cleanupBtn.addEventListener('click', async () => {
            cleanupBtn.style.transform = 'scale(0.9)';
            await cleanupMemory();
            setTimeout(() => {
                cleanupBtn.style.transform = '';
            }, 200);
            updateMemoryDisplay();
        });
    }
    
    // Toggle button
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            memoryMonitoringEnabled = !memoryMonitoringEnabled;
            toggleBtn.style.opacity = memoryMonitoringEnabled ? '1' : '0.5';
            
            if (memoryMonitoringEnabled) {
                updateMemoryDisplay();
                memoryMonitoringInterval = setInterval(updateMemoryDisplay, 5000);
            } else {
                clearInterval(memoryMonitoringInterval);
                memoryValue.textContent = '--';
                memoryValue.className = 'memory-value';
            }
        });
    }
    
    // Initial display update
    updateMemoryDisplay();
}

async function updateMemoryDisplay() {
    const memoryValue = document.getElementById('memoryValue');
    if (!memoryValue || !memoryMonitoringEnabled) return;
    
    try {
        const report = await getMemoryReport();
        const frontendMB = report.frontend ? parseFloat(report.frontend.usedMB) : 0;
        const backendMB = report.backend ? report.backend.heapAlloc / 1024 / 1024 : 0;
        const totalMB = frontendMB + backendMB;
        
        memoryValue.textContent = `${totalMB.toFixed(0)}MB`;
        
        // Color code based on usage
        memoryValue.className = 'memory-value';
        if (totalMB > 1000) {
            memoryValue.classList.add('critical');
        } else if (totalMB > 500) {
            memoryValue.classList.add('warning');
        }
    } catch (err) {
        memoryValue.textContent = 'Error';
    }
}
