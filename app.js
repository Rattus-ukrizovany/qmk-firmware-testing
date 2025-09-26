/**
 * Main Application - Virtual Keyboard Firmware Tester
 */

class VirtualKeyboardTester {
    constructor() {
        this.firmwareParser = new FirmwareParser();
        this.keyboardRenderer = null;
        this.currentFirmware = null;
        this.testLog = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // File upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.firmwareInfo = document.getElementById('firmwareInfo');
        
        // Firmware info elements
        this.firmwareType = document.getElementById('firmwareType');
        this.keyboardName = document.getElementById('keyboardName');
        this.layoutName = document.getElementById('layoutName');
        this.keyCount = document.getElementById('keyCount');
        
        // Workspace elements
        this.workspace = document.getElementById('workspace');
        this.keyboardCanvas = document.getElementById('keyboardCanvas');
        
        // Control elements
        this.resetTestBtn = document.getElementById('resetTest');
        this.toggleLabelsBtn = document.getElementById('toggleLabels');
        this.exportResultsBtn = document.getElementById('exportResults');
        
        // Stats elements
        this.keysTestered = document.getElementById('keysTestered');
        this.totalKeys = document.getElementById('totalKeys');
        
        // Additional components
        this.encoderSection = document.getElementById('encoderSection');
        this.trackballSection = document.getElementById('trackballSection');
        this.displaySection = document.getElementById('displaySection');
        this.encodersContainer = document.getElementById('encodersContainer');
        this.trackballContainer = document.getElementById('trackballContainer');
        this.displayContainer = document.getElementById('displayContainer');
        
        // Log container
        this.logContainer = document.getElementById('logContainer');
        
        // Initialize keyboard renderer
        this.keyboardRenderer = new KeyboardRenderer(this.keyboardCanvas);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFiles(Array.from(e.target.files));
            }
        });
        
        // Control buttons
        this.resetTestBtn.addEventListener('click', () => {
            this.resetTest();
        });
        
        this.toggleLabelsBtn.addEventListener('click', () => {
            this.toggleLabels();
        });
        
        this.exportResultsBtn.addEventListener('click', () => {
            this.exportResults();
        });
        
        // Keyboard renderer events
        this.keyboardCanvas.addEventListener('keyTested', (e) => {
            this.onKeyTested(e.detail);
        });
        
        this.keyboardCanvas.addEventListener('keyTestLog', (e) => {
            this.addLogEntry(e.detail.message, e.detail.type);
        });
        
        this.keyboardCanvas.addEventListener('testReset', () => {
            this.updateStats();
            this.addLogEntry('Test reset - all keys marked as untested', 'info');
        });
        
        // Keyboard events for actual key presses
        document.addEventListener('keydown', (e) => {
            this.handleRealKeyPress(e);
        });
        
        document.addEventListener('keyup', (e) => {
            this.handleRealKeyRelease(e);
        });
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => {
                this.uploadArea.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => {
                this.uploadArea.classList.remove('dragover');
            }, false);
        });
        
        // Handle dropped files
        this.uploadArea.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files);
        }, false);
    }

    /**
     * Prevent default drag behaviors
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Handle uploaded files
     */
    async handleFiles(files) {
        if (files.length === 0) return;
        
        this.addLogEntry(`Processing ${files.length} file(s)...`, 'info');
        
        try {
            // For now, handle the first file
            const file = files[0];
            this.addLogEntry(`Parsing firmware file: ${file.name}`, 'info');
            
            const firmwareData = await this.firmwareParser.parseFirmware(file);
            this.currentFirmware = firmwareData;
            
            this.displayFirmwareInfo(firmwareData);
            this.initializeWorkspace(firmwareData);
            this.showWorkspace();
            
            this.addLogEntry(`Successfully loaded firmware: ${firmwareData.name}`, 'success');
        } catch (error) {
            this.addLogEntry(`Error loading firmware: ${error.message}`, 'error');
            console.error('Firmware loading error:', error);
        }
    }

    /**
     * Display firmware information
     */
    displayFirmwareInfo(firmwareData) {
        this.firmwareType.textContent = firmwareData.type;
        this.keyboardName.textContent = firmwareData.name;
        this.layoutName.textContent = firmwareData.layout ? 
            firmwareData.layout.name : 'Auto-detected';
        this.keyCount.textContent = firmwareData.keys.length;
        
        this.firmwareInfo.style.display = 'block';
        this.firmwareInfo.classList.add('fade-in');
    }

    /**
     * Initialize workspace with firmware data
     */
    initializeWorkspace(firmwareData) {
        // Initialize keyboard renderer
        const keyboardInfo = this.keyboardRenderer.initializeKeyboard(firmwareData);
        
        // Update stats
        this.updateStats();
        
        // Setup additional components
        this.setupEncoders(firmwareData.encoders);
        this.setupTrackballs(firmwareData.trackballs);
        this.setupDisplays(firmwareData.displays);
        
        this.addLogEntry(`Initialized keyboard with ${keyboardInfo.totalKeys} keys`, 'info');
    }

    /**
     * Setup encoders
     */
    setupEncoders(encoders) {
        if (encoders.length === 0) {
            this.encoderSection.style.display = 'none';
            return;
        }
        
        this.encodersContainer.innerHTML = '';
        encoders.forEach(encoder => {
            const encoderElement = this.createEncoderElement(encoder);
            this.encodersContainer.appendChild(encoderElement);
        });
        
        this.encoderSection.style.display = 'block';
        this.addLogEntry(`Found ${encoders.length} encoder(s)`, 'info');
    }

    /**
     * Create encoder element
     */
    createEncoderElement(encoder) {
        const div = document.createElement('div');
        div.className = 'encoder';
        div.innerHTML = `
            <h4>${encoder.name}</h4>
            <div class="encoder-controls">
                <button class="encoder-btn" data-direction="ccw">↶</button>
                <button class="encoder-btn" data-direction="cw">↷</button>
                <button class="encoder-btn" data-direction="press">●</button>
            </div>
        `;
        
        // Add event listeners
        div.querySelectorAll('.encoder-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const direction = btn.dataset.direction;
                this.testEncoder(encoder, direction);
                div.classList.add('active');
                setTimeout(() => div.classList.remove('active'), 200);
            });
        });
        
        return div;
    }

    /**
     * Setup trackballs
     */
    setupTrackballs(trackballs) {
        if (trackballs.length === 0) {
            this.trackballSection.style.display = 'none';
            return;
        }
        
        this.trackballContainer.innerHTML = '';
        trackballs.forEach(trackball => {
            const trackballElement = this.createTrackballElement(trackball);
            this.trackballContainer.appendChild(trackballElement);
        });
        
        this.trackballSection.style.display = 'block';
        this.addLogEntry(`Found ${trackballs.length} trackball(s)`, 'info');
    }

    /**
     * Create trackball element
     */
    createTrackballElement(trackball) {
        const div = document.createElement('div');
        div.className = 'trackball';
        div.innerHTML = `
            <h4>${trackball.name}</h4>
            <div class="trackball-area" style="width: 100px; height: 100px; border: 2px solid #ddd; border-radius: 50%; position: relative; cursor: crosshair;">
                <div class="trackball-cursor" style="width: 10px; height: 10px; background: #667eea; border-radius: 50%; position: absolute; top: 45px; left: 45px; transition: all 0.1s;"></div>
            </div>
            <p>Move cursor to test</p>
        `;
        
        const trackballArea = div.querySelector('.trackball-area');
        const cursor = div.querySelector('.trackball-cursor');
        
        trackballArea.addEventListener('mousemove', (e) => {
            const rect = trackballArea.getBoundingClientRect();
            const x = e.clientX - rect.left - 5; // Adjust for cursor size
            const y = e.clientY - rect.top - 5;
            
            cursor.style.left = Math.max(0, Math.min(90, x)) + 'px';
            cursor.style.top = Math.max(0, Math.min(90, y)) + 'px';
            
            div.classList.add('active');
            this.testTrackball(trackball, x - 45, y - 45);
        });
        
        trackballArea.addEventListener('mouseleave', () => {
            // Reset cursor to center
            cursor.style.left = '45px';
            cursor.style.top = '45px';
            div.classList.remove('active');
        });
        
        return div;
    }

    /**
     * Setup displays
     */
    setupDisplays(displays) {
        if (displays.length === 0) {
            this.displaySection.style.display = 'none';
            return;
        }
        
        this.displayContainer.innerHTML = '';
        displays.forEach(display => {
            const displayElement = this.createDisplayElement(display);
            this.displayContainer.appendChild(displayElement);
        });
        
        this.displaySection.style.display = 'block';
        this.addLogEntry(`Found ${displays.length} display(s)`, 'info');
    }

    /**
     * Create display element
     */
    createDisplayElement(display) {
        const div = document.createElement('div');
        div.className = 'display';
        div.innerHTML = `
            <h4>${display.name}</h4>
            <div class="display-screen" style="width: ${display.width/2}px; height: ${display.height*2}px; background: #000; color: #0f0; font-family: monospace; font-size: 10px; padding: 5px; border-radius: 3px;">
                <div>Display: ${display.width}x${display.height}</div>
                <div>Type: ${display.type.toUpperCase()}</div>
                <div id="display-${display.id}-content">Ready...</div>
            </div>
            <button class="test-display-btn">Test Display</button>
        `;
        
        const testBtn = div.querySelector('.test-display-btn');
        testBtn.addEventListener('click', () => {
            this.testDisplay(display);
            div.classList.add('active');
            setTimeout(() => div.classList.remove('active'), 1000);
        });
        
        return div;
    }

    /**
     * Show workspace
     */
    showWorkspace() {
        this.workspace.style.display = 'block';
        this.workspace.classList.add('fade-in');
    }

    /**
     * Handle key tested event
     */
    onKeyTested(detail) {
        this.updateStats();
        
        // Check if all keys are tested
        const stats = this.keyboardRenderer.getTestStats();
        if (stats.testedKeys === stats.totalKeys && stats.totalKeys > 0) {
            this.addLogEntry('🎉 All keys tested! Test complete.', 'success');
        }
    }

    /**
     * Update statistics display
     */
    updateStats() {
        const stats = this.keyboardRenderer.getTestStats();
        this.keysTestered.textContent = stats.testedKeys;
        this.totalKeys.textContent = stats.totalKeys;
    }

    /**
     * Reset test
     */
    resetTest() {
        if (this.keyboardRenderer) {
            this.keyboardRenderer.resetTest();
        }
        this.addLogEntry('Test reset', 'info');
    }

    /**
     * Toggle labels
     */
    toggleLabels() {
        if (this.keyboardRenderer) {
            const showLabels = this.keyboardRenderer.toggleLabels();
            this.toggleLabelsBtn.textContent = showLabels ? 'Hide Labels' : 'Show Labels';
            this.addLogEntry(`Labels ${showLabels ? 'shown' : 'hidden'}`, 'info');
        }
    }

    /**
     * Export test results
     */
    exportResults() {
        if (!this.keyboardRenderer || !this.currentFirmware) {
            this.addLogEntry('No test data to export', 'error');
            return;
        }
        
        const results = this.keyboardRenderer.exportResults();
        results.keyboard = this.currentFirmware.name;
        results.firmwareType = this.currentFirmware.type;
        results.testLog = this.testLog;
        
        // Download as JSON file
        const blob = new Blob([JSON.stringify(results, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keyboard-test-results-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addLogEntry('Test results exported', 'success');
    }

    /**
     * Handle real keyboard key press
     */
    handleRealKeyPress(e) {
        if (!this.currentFirmware) return;
        
        // Map browser key codes to firmware key IDs (simplified)
        const keyId = this.mapBrowserKeyToFirmwareKey(e.code);
        if (keyId !== null) {
            this.keyboardRenderer.simulateKeyPress(keyId);
        }
    }

    /**
     * Handle real keyboard key release
     */
    handleRealKeyRelease(e) {
        // Could be used for more advanced key state management
    }

    /**
     * Map browser key codes to firmware key IDs (simplified mapping)
     */
    mapBrowserKeyToFirmwareKey(keyCode) {
        // This is a simplified mapping - in a real implementation,
        // this would be more sophisticated and based on the actual firmware layout
        const keyMap = {
            'Escape': 0,
            'Digit1': 1, 'Digit2': 2, 'Digit3': 3, 'Digit4': 4, 'Digit5': 5,
            'Digit6': 6, 'Digit7': 7, 'Digit8': 8, 'Digit9': 9, 'Digit0': 10,
            'KeyQ': 14, 'KeyW': 15, 'KeyE': 16, 'KeyR': 17, 'KeyT': 18,
            'KeyY': 19, 'KeyU': 20, 'KeyI': 21, 'KeyO': 22, 'KeyP': 23,
            'KeyA': 28, 'KeyS': 29, 'KeyD': 30, 'KeyF': 31, 'KeyG': 32,
            'KeyH': 33, 'KeyJ': 34, 'KeyK': 35, 'KeyL': 36,
            'KeyZ': 42, 'KeyX': 43, 'KeyC': 44, 'KeyV': 45, 'KeyB': 46,
            'KeyN': 47, 'KeyM': 48,
            'Space': 57
        };
        
        return keyMap[keyCode] !== undefined ? keyMap[keyCode] : null;
    }

    /**
     * Test encoder
     */
    testEncoder(encoder, direction) {
        const action = direction === 'press' ? 'pressed' : `rotated ${direction}`;
        this.addLogEntry(`Encoder "${encoder.name}" ${action}`, 'success');
    }

    /**
     * Test trackball
     */
    testTrackball(trackball, deltaX, deltaY) {
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            this.addLogEntry(`Trackball "${trackball.name}" moved: X=${deltaX.toFixed(1)}, Y=${deltaY.toFixed(1)}`, 'success');
        }
    }

    /**
     * Test display
     */
    testDisplay(display) {
        const content = document.getElementById(`display-${display.id}-content`);
        if (content) {
            const messages = [
                'Testing display...',
                'Display functional!',
                `${display.width}x${display.height} OK`,
                'All pixels working'
            ];
            
            let index = 0;
            const interval = setInterval(() => {
                content.textContent = messages[index];
                index++;
                if (index >= messages.length) {
                    clearInterval(interval);
                    setTimeout(() => {
                        content.textContent = 'Ready...';
                    }, 1000);
                }
            }, 200);
        }
        
        this.addLogEntry(`Display "${display.name}" test completed`, 'success');
    }

    /**
     * Add entry to test log
     */
    addLogEntry(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            type
        };
        
        this.testLog.push(logEntry);
        
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.innerHTML = `<span style="opacity: 0.7;">[${timestamp}]</span> ${message}`;
        
        this.logContainer.appendChild(div);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        // Keep only last 100 entries in DOM
        while (this.logContainer.children.length > 100) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VirtualKeyboardTester();
});