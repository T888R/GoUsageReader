// Application state
let appState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    isPanning: false,
    isRotating: false,
    startX: 0,
    startY: 0,
    mode: null, // 'standard' or 'addon'
    isCapturing: false,
    gridEnabled: false,
    isShiftHeld: false,
    perspectiveMode: false,
    cornerPoints: [
        { x: 0.1, y: 0.1 }, // top-left (normalized 0-1)
        { x: 0.9, y: 0.1 }, // top-right
        { x: 0.9, y: 0.9 }, // bottom-right
        { x: 0.1, y: 0.9 }  // bottom-left
    ],
    isDraggingCorner: false,
    draggedCorner: null,
    originalImageData: null,
    originalImageBlob: null // Store the actual blob data for transforms
};

// DOM elements
const pageBackground = document.getElementById('pageBackground');
const gridOverlay = document.getElementById('gridOverlay');
const fileInput = document.getElementById('fileInput');
const zoomLevel = document.getElementById('zoomLevel');
const yMaxInput = document.getElementById('yMaxInput');
const standardBtn = document.getElementById('standardBtn');
const addonBtn = document.getElementById('addonBtn');
const importBtn = document.getElementById('importBtn');
const gridToggle = document.getElementById('gridToggle');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
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
    if (!GoApp || !GoApp[methodName]) {
        console.warn(`Go method ${methodName} not available`);
        return null;
    }
    try {
        return await GoApp[methodName](...args);
    } catch (err) {
        console.error(`Error calling ${methodName}:`, err);
        throw err;
    }
}

// Image import
importBtn.addEventListener('click', () => fileInput.click());

// Grid toggle
gridToggle.addEventListener('click', () => {
    appState.gridEnabled = !appState.gridEnabled;
    if (gridOverlay) {
        gridOverlay.style.display = appState.gridEnabled ? 'block' : 'none';
    }
    gridToggle.textContent = appState.gridEnabled ? 'Grid: On' : 'Grid: Off';
    gridToggle.classList.toggle('active', appState.gridEnabled);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            pageBackground.style.backgroundImage = `url(${event.target.result})`;
            document.body.style.background = 'none';
            
            // Store original image data for perspective transform
            appState.originalImageData = pageBackground.style.backgroundImage;
            appState.originalImageBlob = event.target.result;
            
            resetView();
            showNotification('Image imported successfully. You can now use perspective transform.');
        };
        reader.readAsDataURL(file);
    }
});

// Update transform
let rafId = null;
function updateTransform() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
        const transform = `translate3d(${appState.panX}px, ${appState.panY}px, 0) scale(${appState.zoom}) rotate(${appState.rotation}deg)`;
        pageBackground.style.webkitTransform = transform;
        pageBackground.style.transform = transform;
        
        // Grid overlay stays fixed - no transform applied
        
        zoomLevel.textContent = `${Math.round(appState.zoom * 100)}%`;
        // Force repaint to clear artifacts in WebKit
        void pageBackground.offsetHeight;
    });
}

// Reset view
function resetView() {
    appState.zoom = 1;
    appState.panX = 0;
    appState.panY = 0;
    appState.rotation = 0;
    updateTransform();
}

// Zoom functions
function zoomIn() {
    appState.zoom = Math.min(appState.zoom * 1.2, 5);
    updateTransform();
}

function zoomOut() {
    appState.zoom = Math.max(appState.zoom / 1.2, 0.1);
    updateTransform();
}

zoomInBtn.addEventListener('click', zoomIn);
zoomOutBtn.addEventListener('click', zoomOut);

// Mouse wheel zoom
document.addEventListener('wheel', (e) => {
    if (e.target.closest('.container')) return; // Don't zoom when scrolling over the UI container
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, appState.zoom * delta));
    
    // Zoom towards mouse pointer
    const mouseX = e.clientX - window.innerWidth / 2;
    const mouseY = e.clientY - window.innerHeight / 2;
    
    appState.panX = mouseX - (mouseX - appState.panX) * (newZoom / appState.zoom);
    appState.panY = mouseY - (mouseY - appState.panY) * (newZoom / appState.zoom);
    appState.zoom = newZoom;
    
    updateTransform();
}, { passive: false });

// Pan with Ctrl + drag or Middle mouse button, Rotate with Shift + drag
// Capture clicks for usage reading
document.addEventListener('mousedown', (e) => {
    // Don't capture if clicking on the container UI
    if (e.target.closest('.container')) return;
    
    // Check if this is a rotate action (Shift key)
    if (e.shiftKey) {
        e.preventDefault();
        appState.isRotating = true;
        appState.startX = e.clientX;
        appState.startY = e.clientY;
        document.body.classList.add('rotating');
        return;
    }
    
    // Check if this is a pan action (Ctrl key or middle mouse button)
    if (e.ctrlKey || e.button === 1) {
        e.preventDefault();
        appState.isPanning = true;
        appState.startX = e.clientX - appState.panX;
        appState.startY = e.clientY - appState.panY;
        document.body.classList.add('panning');
        return;
    }
    
    // Otherwise, this is a capture click (only when mode is active)
    if (appState.mode && e.button === 0 && !e.ctrlKey) { // Left click only, no ctrl
        handleCaptureClick(e);
    }
});

document.addEventListener('mousemove', (e) => {
    if (appState.isPanning) {
        e.preventDefault();
        appState.panX = e.clientX - appState.startX;
        appState.panY = e.clientY - appState.startY;
        updateTransform();
    } else if (appState.isRotating) {
        e.preventDefault();
        // Calculate rotation based on horizontal mouse movement
        const deltaX = e.clientX - appState.startX;
        appState.rotation = deltaX * 0.5; // Adjust sensitivity
        updateTransform();
    }
});

document.addEventListener('mouseup', () => {
    appState.isPanning = false;
    appState.isRotating = false;
    document.body.classList.remove('panning');
    document.body.classList.remove('rotating');
});

// Handle capture click - sends Y coordinate to backend
async function handleCaptureClick(e) {
    if (!appState.mode) return;
    
    // Get click position relative to the window (for full-page background)
    const yPos = e.clientY;
    
    // Send to backend
    try {
        let result;
        if (appState.mode === 'standard') {
            result = await callGo("HandleClick", yPos);
            await updateDescription();
        } else {
            result = await callGo("HandleAddonClick", yPos);
            await updateAddonDescription();
        }
        
        if (result && result[0]) {
            readingsOutput.textContent += result[0] + '\n';
            readingsOutput.scrollTop = readingsOutput.scrollHeight;
        }
    } catch (err) {
        console.error('Error handling click:', err);
    }
}

// Keyboard controls for zoom
let keysPressed = {};

document.addEventListener('keydown', (e) => {
    if (keysPressed[e.key]) return;
    keysPressed[e.key] = true;
    
    // Track Shift key state
    if (e.key === 'Shift') {
        appState.isShiftHeld = true;
        document.body.classList.add('shift-held');
    }
    
    if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
    } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
    } else if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        resetView();
    }
});

document.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
    
    // Track Shift key release
    if (e.key === 'Shift') {
        appState.isShiftHeld = false;
        document.body.classList.remove('shift-held');
    }
});

// Disable context menu on middle click for panning
document.addEventListener('contextmenu', (e) => {
    if (e.button === 1) {
        e.preventDefault();
    }
});

// Y Max input handling
yMaxInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const value = parseInt(yMaxInput.value);
        if (value > 0) {
            if (isGoAvailable()) {
                callGo("SetYMax", value);
            }
        }
    }
});

// Mode selection
standardBtn.addEventListener('click', async () => {
    const value = parseInt(yMaxInput.value);
    if (value > 0) {
        appState.mode = 'standard';
        standardBtn.classList.add('mode-active');
        addonBtn.classList.remove('mode-active');
        
        if (isGoAvailable()) {
            await callGo("SetYMax", value);
            await callGo("StartRegularUsage");
            await callGo("SetWindowHeight", window.innerHeight);
            await updateDescription();
        }
        readingsOutput.textContent = '';
        description.textContent = 'Click the top of the graph';
    } else {
        alert('Please enter a valid Y axis maximum value');
    }
});

addonBtn.addEventListener('click', async () => {
    const value = parseInt(yMaxInput.value);
    if (value > 0) {
        appState.mode = 'addon';
        addonBtn.classList.add('mode-active');
        standardBtn.classList.remove('mode-active');
        
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
        // Copy to clipboard for the user to paste manually
        navigator.clipboard.writeText(data).then(() => {
            console.log('Data copied to clipboard');
            showNotification('Data copied to clipboard! Press Ctrl+V to paste.');
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            showNotification('Auto-paste failed. Please copy manually from the readings panel.');
        });
    });
}

// Show notification
function showNotification(message) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
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
    yMaxInput.value = '';
    readingsOutput.textContent = '';
    description.textContent = 'Input y axis, hit enter, and click the top of the graph';
    resetView();
}

// Window resize handling
window.addEventListener('resize', () => {
    if (isGoAvailable()) {
        callGo("SetWindowHeight", window.innerHeight);
    }
});

// Initialize
console.log('Usage Reader initialized');

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
        
        // Reset corners to image corners on first activation
        resetCornersToImageBounds();
        
        // Send to backend
        if (isGoAvailable()) {
            callGo("SetPerspectiveMode", true);
        }
        
        updateCornerPositions();
        applyPerspectivePreview();  // Show initial preview
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
    
    // Optionally keep grid on or turn it off - let's keep it on for now
    // as it might be useful for the usage reading
    
    if (isGoAvailable()) {
        callGo("SetPerspectiveMode", false);
    }
}

// Get the actual displayed image bounds (accounting for contain and zoom)
function getImageBounds() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Get the background image URL to determine its dimensions
    const bgImage = pageBackground.style.backgroundImage;
    if (!bgImage || bgImage === 'none') return null;
    
    // Extract image URL
    const imageUrl = bgImage.slice(4, -1).replace(/["']/g, '');
    
    // Create a temporary image to get dimensions
    const img = new Image();
    img.src = imageUrl;
    
    // Get natural dimensions (if available)
    let imgWidth = img.naturalWidth || windowWidth;
    let imgHeight = img.naturalHeight || windowHeight;
    
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
    
    // Apply zoom
    displayWidth *= appState.zoom;
    displayHeight *= appState.zoom;
    
    // Calculate center position with pan offset
    const centerX = windowWidth / 2 + appState.panX;
    const centerY = windowHeight / 2 + appState.panY;
    
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
    const bounds = getImageBounds();
    if (!bounds) return;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Set corners to image corners in normalized coordinates
    appState.cornerPoints = [
        { x: bounds.left / windowWidth, y: bounds.top / windowHeight },       // top-left
        { x: bounds.right / windowWidth, y: bounds.top / windowHeight },      // top-right
        { x: bounds.right / windowWidth, y: bounds.bottom / windowHeight },  // bottom-right
        { x: bounds.left / windowWidth, y: bounds.bottom / windowHeight }     // bottom-left
    ];
}

// Draw lines connecting the corners
function drawPerspectiveLines() {
    const linesContainer = document.getElementById('perspectiveLines');
    linesContainer.innerHTML = '';
    
    if (!appState.perspectiveMode) return;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Define line pairs (connections)
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 0] // Rectangle edges
    ];
    
    connections.forEach(([start, end]) => {
        const p1 = appState.cornerPoints[start];
        const p2 = appState.cornerPoints[end];
        
        // Get handle center positions
        const x1 = p1.x * windowWidth;
        const y1 = p1.y * windowHeight;
        const x2 = p2.x * windowWidth;
        const y2 = p2.y * windowHeight;
        
        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        
        const line = document.createElement('div');
        line.className = 'perspective-line';
        line.style.width = `${length}px`;
        line.style.left = `${x1}px`;
        line.style.top = `${y1}px`;
        line.style.transform = `rotate(${angle}deg)`;
        
        linesContainer.appendChild(line);
    });
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
        
        // Update corner position (normalized coordinates)
        appState.cornerPoints[cornerIndex] = {
            x: e.clientX / window.innerWidth,
            y: e.clientY / window.innerHeight
        };
        
        updateCornerPositions();
        applyPerspectivePreview();  // Real-time preview
    };
    
    const onMouseUp = () => {
        appState.isDraggingCorner = false;
        appState.draggedCorner = null;
        handle.classList.remove('dragging');
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Apply real-time perspective distortion using canvas with inverse homography and bilinear sampling
function applyPerspectivePreview() {
    if (!appState.perspectiveMode || !appState.originalImageBlob) return;
    
    const windowWidth = window.innerWidth;
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
        previewCanvas.style.zIndex = '350';  // Below handles but above background
        document.body.appendChild(previewCanvas);
    }
    
    // Source rectangle corners (original image display bounds)
    const srcCorners = [
        { x: bounds.left, y: bounds.top },      // top-left
        { x: bounds.right, y: bounds.top },     // top-right
        { x: bounds.right, y: bounds.bottom },  // bottom-right
        { x: bounds.left, y: bounds.bottom }    // bottom-left
    ];
    
    // Destination corners (dragged positions)
    const dstCorners = appState.cornerPoints.map(p => ({
        x: p.x * windowWidth,
        y: p.y * windowHeight
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
    
    // Remove preview canvas
    const previewCanvas = document.getElementById('perspectivePreviewCanvas');
    if (previewCanvas) {
        previewCanvas.style.display = 'none';
    }
}

// Hide perspective preview canvas
function hidePerspectivePreview() {
    const previewCanvas = document.getElementById('perspectivePreviewCanvas');
    if (previewCanvas) {
        previewCanvas.style.display = 'none';
    }
    pageBackground.style.opacity = '1';
}


// Update corner handle positions based on normalized coordinates
function updateCornerPositions() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    cornerHandles.forEach((handle, index) => {
        const point = appState.cornerPoints[index];
        // CSS handles centering with margin-left: -10px and margin-top: -10px
        // so we just set left/top to the exact pixel position
        handle.style.left = `${point.x * windowWidth}px`;
        handle.style.top = `${point.y * windowHeight}px`;
        handle.style.right = 'auto';
        handle.style.bottom = 'auto';
    });
    
    drawPerspectiveLines();
    
    // Apply perspective distortion to the image
    applyPerspectivePreview();
}

// Draw lines connecting the corners
function drawPerspectiveLines() {
    const linesContainer = document.getElementById('perspectiveLines');
    linesContainer.innerHTML = '';
    
    if (!appState.perspectiveMode) return;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Define line pairs (connections)
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 0] // Rectangle edges
    ];
    
    connections.forEach(([start, end]) => {
        const p1 = appState.cornerPoints[start];
        const p2 = appState.cornerPoints[end];
        
        // Get handle center positions
        const x1 = p1.x * windowWidth;
        const y1 = p1.y * windowHeight;
        const x2 = p2.x * windowWidth;
        const y2 = p2.y * windowHeight;
        
        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        
        const line = document.createElement('div');
        line.className = 'perspective-line';
        line.style.width = `${length}px`;
        line.style.left = `${x1}px`;
        line.style.top = `${y1}px`;
        line.style.transform = `rotate(${angle}deg)`;
        
        linesContainer.appendChild(line);
    });
}


// Calculate perspective transform matrix for CSS preview
// Uses the four corner points to calculate a CSS matrix3d transform
function calculatePerspectiveMatrix() {
    const bounds = getImageBounds();
    if (!bounds) return null;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Get the four corner points in screen coordinates
    const corners = appState.cornerPoints.map(p => ({
        x: p.x * windowWidth,
        y: p.y * windowHeight
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
    
    // Restore original image
    if (appState.originalImageBlob) {
        pageBackground.style.backgroundImage = `url(${appState.originalImageBlob})`;
    }
    
    updateCornerPositions();
    
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
        
        // Convert corner points to pixel coordinates relative to the original image
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Calculate pixel coordinates relative to the displayed image bounds
        const cornerPointsArray = appState.cornerPoints.map(p => {
            const screenX = p.x * windowWidth;
            const screenY = p.y * windowHeight;
            
            // Convert to coordinates relative to the displayed image
            const relX = screenX - bounds.left;
            const relY = screenY - bounds.top;
            
            // Scale to original image dimensions
            const origX = (relX / bounds.width) * windowWidth;
            const origY = (relY / bounds.height) * windowHeight;
            
            return [Math.round(origX), Math.round(origY)];
        });
        
        // Send corner points to backend
        await callGo("SetCornerPoints", [
            [cornerPointsArray[0][0], cornerPointsArray[0][1]],
            [cornerPointsArray[1][0], cornerPointsArray[1][1]],
            [cornerPointsArray[2][0], cornerPointsArray[2][1]],
            [cornerPointsArray[3][0], cornerPointsArray[3][1]]
        ]);
        
        // Convert base64 data URL to byte array
        const base64Data = appState.originalImageBlob.split(',')[1];
        const binaryString = atob(base64Data);
        const imageData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            imageData[i] = binaryString.charCodeAt(i);
        }
        
        // Send to backend for transformation
        const transformedData = await callGo("ApplyPerspectiveTransform", 
            imageData,
            window.innerWidth,
            window.innerHeight
        );
        
        if (transformedData && transformedData.length > 0) {
            // Convert transformed data back to base64
            const base64String = btoa(String.fromCharCode.apply(null, transformedData));
            const transformedUrl = `data:image/png;base64,${base64String}`;
            
            // Update background with transformed image
            pageBackground.style.backgroundImage = `url(${transformedUrl})`;
            
            // Update the stored original data with the transformed version
            appState.originalImageBlob = transformedUrl;
            appState.originalImageData = pageBackground.style.backgroundImage;
            
            showNotification('Perspective transform applied successfully!');
            
            // Disable perspective mode after applying
            disablePerspectiveMode();
            
            // Reset zoom and pan since image is now aligned
            resetView();
        } else {
            showNotification('Transform failed - no data returned');
        }
        
    } catch (error) {
        console.error('Perspective transform error:', error);
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

console.log('Usage Reader with perspective transform initialized');
