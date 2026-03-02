// Application state
let appState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    startX: 0,
    startY: 0,
    mode: null, // 'standard' or 'addon'
    isCapturing: false
};

// DOM elements
const imageViewport = document.getElementById('imageViewport');
const imageContainer = document.getElementById('imageContainer');
const uploadedImage = document.getElementById('uploadedImage');
const fileInput = document.getElementById('fileInput');
const zoomLevel = document.getElementById('zoomLevel');
const yMaxInput = document.getElementById('yMaxInput');
const standardBtn = document.getElementById('standardBtn');
const addonBtn = document.getElementById('addonBtn');
const importBtn = document.getElementById('importBtn');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const description = document.getElementById('description');
const readingsOutput = document.getElementById('readingsOutput');
const imagePlaceholder = document.querySelector('.image-placeholder');

// Image import
importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedImage.src = event.target.result;
            uploadedImage.style.display = 'block';
            imagePlaceholder.style.display = 'none';
            resetView();
        };
        reader.readAsDataURL(file);
    }
});

// Update transform
function updateTransform() {
    imageContainer.style.transform = `translate(${appState.panX}px, ${appState.panY}px) scale(${appState.zoom})`;
    zoomLevel.textContent = `${Math.round(appState.zoom * 100)}%`;
}

// Reset view
function resetView() {
    appState.zoom = 1;
    appState.panX = 0;
    appState.panY = 0;
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
imageViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, appState.zoom * delta));
    
    // Zoom towards mouse pointer
    const rect = imageViewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    
    appState.panX = mouseX - (mouseX - appState.panX) * (newZoom / appState.zoom);
    appState.panY = mouseY - (mouseY - appState.panY) * (newZoom / appState.zoom);
    appState.zoom = newZoom;
    
    updateTransform();
}, { passive: false });

// Pan with Ctrl + drag or Middle mouse button
// Capture clicks for usage reading
imageViewport.addEventListener('mousedown', (e) => {
    // Check if this is a pan action (Ctrl key or middle mouse button)
    if (e.ctrlKey || e.button === 1) {
        e.preventDefault();
        appState.isPanning = true;
        appState.startX = e.clientX - appState.panX;
        appState.startY = e.clientY - appState.panY;
        imageViewport.classList.add('panning');
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
    }
});

document.addEventListener('mouseup', () => {
    appState.isPanning = false;
    imageViewport.classList.remove('panning');
});

// Handle capture click - sends Y coordinate to backend
async function handleCaptureClick(e) {
    if (!appState.mode) return;
    
    // Get click position relative to the viewport
    const rect = imageViewport.getBoundingClientRect();
    const yPos = e.clientY - rect.top;
    
    // Send to backend
    try {
        let result;
        if (appState.mode === 'standard') {
            result = await window.go.main.App.HandleClick(yPos);
            await updateDescription();
        } else {
            result = await window.go.main.App.HandleAddonClick(yPos);
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
});

// Disable context menu on middle click for panning
imageViewport.addEventListener('contextmenu', (e) => {
    if (e.button === 1) {
        e.preventDefault();
    }
});

// Y Max input handling
yMaxInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const value = parseInt(yMaxInput.value);
        if (value > 0) {
            if (window.go && window.go.main && window.go.main.App) {
                window.go.main.App.SetYMax(value);
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
        
        if (window.go && window.go.main && window.go.main.App) {
            await window.go.main.App.SetYMax(value);
            await window.go.main.App.StartRegularUsage();
            await window.go.main.App.SetWindowHeight(window.innerHeight);
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
        
        if (window.go && window.go.main && window.go.main.App) {
            await window.go.main.App.SetYMax(value);
            await window.go.main.App.StartAddonUsage();
            await window.go.main.App.SetWindowHeight(window.innerHeight);
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
    if (window.go && window.go.main && window.go.main.App) {
        const desc = await window.go.main.App.GetDescription();
        description.textContent = desc;
    }
}

async function updateAddonDescription() {
    if (window.go && window.go.main && window.go.main.App) {
        const desc = await window.go.main.App.GetAddonDescription();
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
    if (window.go && window.go.main && window.go.main.App) {
        await window.go.main.App.Reset();
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
    if (window.go && window.go.main && window.go.main.App) {
        window.go.main.App.SetWindowHeight(window.innerHeight);
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
