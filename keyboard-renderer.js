/**
 * Keyboard Renderer - Handles visual representation of keyboards and components
 */

class KeyboardRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.keys = [];
        this.keyStates = new Map(); // key_id -> state (untested, tested, pressed)
        this.showLabels = true;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Colors
        this.colors = {
            untested: '#e9ecef',
            tested: '#d4edda',
            pressed: '#f8d7da',
            hover: '#fff3cd',
            border: '#6c757d',
            testedBorder: '#28a745',
            pressedBorder: '#dc3545',
            hoverBorder: '#ffc107',
            text: '#333',
            background: '#f8f9fa'
        };
        
        this.setupEventListeners();
    }

    /**
     * Initialize keyboard from parsed firmware data
     */
    initializeKeyboard(firmwareData) {
        this.keys = firmwareData.keys || [];
        this.keyStates.clear();
        
        // Initialize all keys as untested
        this.keys.forEach(key => {
            this.keyStates.set(key.id, 'untested');
        });
        
        this.calculateBounds();
        this.render();
        
        return {
            totalKeys: this.keys.length,
            layout: firmwareData.layout
        };
    }

    /**
     * Calculate keyboard bounds and set appropriate scale
     */
    calculateBounds() {
        if (this.keys.length === 0) return;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.keys.forEach(key => {
            minX = Math.min(minX, key.x);
            minY = Math.min(minY, key.y);
            maxX = Math.max(maxX, key.x + key.width);
            maxY = Math.max(maxY, key.y + key.height);
        });
        
        const keyboardWidth = maxX - minX;
        const keyboardHeight = maxY - minY;
        
        // Calculate scale to fit canvas
        const scaleX = (this.canvas.width - 40) / keyboardWidth;
        const scaleY = (this.canvas.height - 40) / keyboardHeight;
        this.scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1
        
        // Center the keyboard
        this.offsetX = (this.canvas.width - keyboardWidth * this.scale) / 2 - minX * this.scale;
        this.offsetY = (this.canvas.height - keyboardHeight * this.scale) / 2 - minY * this.scale;
    }

    /**
     * Render the keyboard
     */
    render() {
        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.keys.length === 0) {
            this.renderPlaceholder();
            return;
        }
        
        // Render keys
        this.keys.forEach(key => {
            this.renderKey(key);
        });
    }

    /**
     * Render placeholder when no keyboard is loaded
     */
    renderPlaceholder() {
        this.ctx.fillStyle = '#666';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            'Upload firmware to see keyboard layout',
            this.canvas.width / 2,
            this.canvas.height / 2
        );
    }

    /**
     * Render a single key
     */
    renderKey(key) {
        const x = key.x * this.scale + this.offsetX;
        const y = key.y * this.scale + this.offsetY;
        const width = key.width * this.scale;
        const height = key.height * this.scale;
        
        const state = this.keyStates.get(key.id) || 'untested';
        
        // Key background
        this.ctx.fillStyle = this.colors[state];
        this.ctx.fillRect(x, y, width, height);
        
        // Key border
        this.ctx.strokeStyle = this.getBorderColor(state);
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Key label
        if (this.showLabels && width > 20 && height > 20) {
            this.renderKeyLabel(key, x, y, width, height);
        }
    }

    /**
     * Get border color based on key state
     */
    getBorderColor(state) {
        switch (state) {
            case 'tested': return this.colors.testedBorder;
            case 'pressed': return this.colors.pressedBorder;
            case 'hover': return this.colors.hoverBorder;
            default: return this.colors.border;
        }
    }

    /**
     * Render key label
     */
    renderKeyLabel(key, x, y, width, height) {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Adjust font size based on key size
        const fontSize = Math.min(width / 3, height / 3, 14);
        this.ctx.font = `${fontSize}px Arial`;
        
        // Draw key ID or keycode
        const label = key.keycode && key.keycode !== 'KC_NO' 
            ? this.formatKeycode(key.keycode)
            : key.id.toString();
            
        this.ctx.fillText(label, x + width / 2, y + height / 2);
    }

    /**
     * Format keycode for display
     */
    formatKeycode(keycode) {
        // Remove common prefixes
        let formatted = keycode.replace(/^KC_/, '');
        
        // Handle special cases
        const specialKeys = {
            'SPC': 'Space',
            'ENT': 'Enter',
            'BSPC': 'Backspace',
            'TAB': 'Tab',
            'ESC': 'Esc',
            'CAPS': 'Caps',
            'LSFT': 'Shift',
            'RSFT': 'Shift',
            'LCTL': 'Ctrl',
            'RCTL': 'Ctrl',
            'LALT': 'Alt',
            'RALT': 'Alt',
            'LGUI': 'Win',
            'RGUI': 'Win'
        };
        
        return specialKeys[formatted] || formatted;
    }

    /**
     * Set up event listeners for key interaction
     */
    setupEventListeners() {
        let hoveredKey = null;
        
        // Mouse move for hover effects
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const key = this.getKeyAtPosition(x, y);
            
            if (key !== hoveredKey) {
                // Remove hover from previous key
                if (hoveredKey && this.keyStates.get(hoveredKey.id) === 'hover') {
                    this.keyStates.set(hoveredKey.id, 'untested');
                }
                
                // Add hover to new key
                if (key && this.keyStates.get(key.id) === 'untested') {
                    this.keyStates.set(key.id, 'hover');
                }
                
                hoveredKey = key;
                this.render();
            }
        });
        
        // Mouse leave to clear hover
        this.canvas.addEventListener('mouseleave', () => {
            if (hoveredKey && this.keyStates.get(hoveredKey.id) === 'hover') {
                this.keyStates.set(hoveredKey.id, 'untested');
                hoveredKey = null;
                this.render();
            }
        });
        
        // Mouse click for key testing
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const key = this.getKeyAtPosition(x, y);
            if (key) {
                this.testKey(key);
            }
        });
    }

    /**
     * Get key at specific canvas position
     */
    getKeyAtPosition(x, y) {
        for (const key of this.keys) {
            const keyX = key.x * this.scale + this.offsetX;
            const keyY = key.y * this.scale + this.offsetY;
            const keyWidth = key.width * this.scale;
            const keyHeight = key.height * this.scale;
            
            if (x >= keyX && x <= keyX + keyWidth && 
                y >= keyY && y <= keyY + keyHeight) {
                return key;
            }
        }
        return null;
    }

    /**
     * Test a key (simulate key press)
     */
    testKey(key) {
        // Briefly show pressed state
        this.keyStates.set(key.id, 'pressed');
        this.render();
        
        // Log the key test
        this.logKeyTest(key);
        
        // After a short delay, mark as tested
        setTimeout(() => {
            this.keyStates.set(key.id, 'tested');
            this.render();
            
            // Dispatch custom event for app to handle
            this.canvas.dispatchEvent(new CustomEvent('keyTested', {
                detail: { key: key, keyId: key.id }
            }));
        }, 150);
    }

    /**
     * Log key test to console and UI
     */
    logKeyTest(key) {
        const keycode = key.keycode || 'KC_NO';
        const message = `Key ${key.id} tested (${keycode}) - Row: ${key.row}, Col: ${key.col}`;
        console.log(message);
        
        // Dispatch log event
        this.canvas.dispatchEvent(new CustomEvent('keyTestLog', {
            detail: { message: message, type: 'success' }
        }));
    }

    /**
     * Toggle key labels visibility
     */
    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.render();
        return this.showLabels;
    }

    /**
     * Reset all key states
     */
    resetTest() {
        this.keys.forEach(key => {
            this.keyStates.set(key.id, 'untested');
        });
        this.render();
        
        // Dispatch reset event
        this.canvas.dispatchEvent(new CustomEvent('testReset'));
    }

    /**
     * Get test statistics
     */
    getTestStats() {
        let testedCount = 0;
        this.keyStates.forEach(state => {
            if (state === 'tested') testedCount++;
        });
        
        return {
            totalKeys: this.keys.length,
            testedKeys: testedCount,
            untestedKeys: this.keys.length - testedCount,
            progress: this.keys.length > 0 ? (testedCount / this.keys.length * 100).toFixed(1) : 0
        };
    }

    /**
     * Export test results
     */
    exportResults() {
        const stats = this.getTestStats();
        const results = {
            timestamp: new Date().toISOString(),
            keyboard: 'Unknown', // Will be set by app
            totalKeys: stats.totalKeys,
            testedKeys: stats.testedKeys,
            progress: stats.progress,
            keyDetails: []
        };
        
        this.keys.forEach(key => {
            results.keyDetails.push({
                id: key.id,
                row: key.row,
                col: key.col,
                keycode: key.keycode || 'KC_NO',
                tested: this.keyStates.get(key.id) === 'tested'
            });
        });
        
        return results;
    }

    /**
     * Simulate key press from external source (e.g., actual keyboard)
     */
    simulateKeyPress(keyId) {
        const key = this.keys.find(k => k.id === keyId);
        if (key) {
            this.testKey(key);
        }
    }

    /**
     * Highlight specific keys (for tutorials or guides)
     */
    highlightKeys(keyIds, color = '#ffeb3b') {
        keyIds.forEach(keyId => {
            const key = this.keys.find(k => k.id === keyId);
            if (key) {
                // Store original color and set highlight
                key._originalState = this.keyStates.get(key.id);
                this.keyStates.set(key.id, 'hover');
            }
        });
        this.render();
    }

    /**
     * Clear key highlights
     */
    clearHighlights() {
        this.keys.forEach(key => {
            if (key._originalState !== undefined) {
                this.keyStates.set(key.id, key._originalState);
                delete key._originalState;
            }
        });
        this.render();
    }
}