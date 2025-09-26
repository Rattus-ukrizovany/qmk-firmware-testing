/**
 * Firmware Parser - Handles QMK and ZMK firmware file parsing
 */

class FirmwareParser {
    constructor() {
        this.supportedFormats = ['.json', '.hex', '.uf2', '.keymap', '.c', '.h'];
        this.keyboardLayouts = {
            // Common keyboard layouts with key positions
            'tkl': { rows: 6, cols: 17, name: 'Tenkeyless' },
            'full': { rows: 6, cols: 21, name: 'Full Size' },
            '60': { rows: 5, cols: 14, name: '60%' },
            '65': { rows: 5, cols: 16, name: '65%' },
            '75': { rows: 6, cols: 16, name: '75%' },
            'ortho': { rows: 4, cols: 12, name: 'Ortholinear' },
            'split': { rows: 4, cols: 6, name: 'Split' }
        };
    }

    /**
     * Parse firmware file and extract keyboard configuration
     */
    async parseFirmware(file) {
        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
        
        try {
            const content = await this.readFileContent(file);
            
            let parsedData = {
                type: 'unknown',
                name: fileName,
                layout: null,
                keys: [],
                encoders: [],
                trackballs: [],
                displays: [],
                layers: [],
                metadata: {}
            };

            if (fileExtension === '.json') {
                parsedData = await this.parseJsonFirmware(content, fileName);
            } else if (fileExtension === '.keymap') {
                parsedData = await this.parseZmkKeymap(content, fileName);
            } else if (fileExtension === '.c' || fileExtension === '.h') {
                parsedData = await this.parseQmkSource(content, fileName);
            } else if (fileExtension === '.hex' || fileExtension === '.uf2') {
                parsedData = await this.parseBinaryFirmware(content, fileName);
            }

            // Auto-detect layout if not specified
            if (!parsedData.layout) {
                parsedData.layout = this.detectLayout(parsedData);
            }

            return parsedData;
        } catch (error) {
            console.error('Error parsing firmware:', error);
            throw new Error(`Failed to parse firmware: ${error.message}`);
        }
    }

    /**
     * Read file content based on type
     */
    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.hex') || fileName.endsWith('.uf2')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    /**
     * Parse JSON firmware configuration
     */
    async parseJsonFirmware(content, fileName) {
        try {
            const config = JSON.parse(content);
            
            const parsedData = {
                type: this.detectFirmwareType(config),
                name: config.keyboard_name || config.keyboard || config.name || fileName,
                layout: config.layout || this.detectLayoutFromConfig(config),
                keys: this.extractKeys(config),
                encoders: this.extractEncoders(config),
                trackballs: this.extractTrackballs(config),
                displays: this.extractDisplays(config),
                layers: this.extractLayers(config),
                metadata: {
                    version: config.version,
                    author: config.author,
                    description: config.description,
                    isSplit: this.detectSplitKeyboard(config),
                    split: config.split || null
                }
            };
            
            return parsedData;
        } catch (error) {
            throw new Error('Invalid JSON format');
        }
    }

    /**
     * Parse ZMK keymap file
     */
    async parseZmkKeymap(content, fileName) {
        const keymap = {
            type: 'ZMK',
            name: fileName,
            layout: null,
            keys: [],
            encoders: [],
            trackballs: [],
            displays: [],
            layers: [],
            metadata: {}
        };

        // Extract keyboard name
        const keyboardMatch = content.match(/#include\s*[<"](.*?)[>"]/);
        if (keyboardMatch) {
            keymap.name = keyboardMatch[1].replace(/\.dtsi$/, '');
        }

        // Check for split keyboard indicators in comments or layout
        const isSplitFromContent = content.includes('split') || 
                                   content.includes('left half') || 
                                   content.includes('right half') ||
                                   content.includes('|   |') || // Common split layout comment pattern
                                   /\/\/.*\|.*\|.*\|.*\|.*\|.*\|.*\|.*\|/.test(content); // Split layout comments

        // Extract keymaps
        const keymapMatches = content.match(/keymap\s*{[\s\S]*?}/g);
        if (keymapMatches) {
            keymapMatches.forEach(match => {
                const layerMatches = match.match(/(\w+)\s*{([^}]*)}/g);
                if (layerMatches) {
                    layerMatches.forEach(layer => {
                        const layerName = layer.match(/(\w+)\s*{/)[1];
                        const bindings = layer.match(/bindings\s*=\s*<([^>]*)>/);
                        if (bindings) {
                            const keys = this.parseZmkBindings(bindings[1]);
                            keymap.layers.push({
                                name: layerName,
                                keys: keys
                            });
                        }
                    });
                }
            });
        }

        // Generate key positions based on layers
        if (keymap.layers.length > 0) {
            const firstLayerKeyCount = keymap.layers[0].keys.length;
            
            // For ZMK split keyboards, detect if this looks like a split based on key count and content
            if (isSplitFromContent || (firstLayerKeyCount >= 30 && firstLayerKeyCount <= 50)) {
                keymap.keys = this.generateSplitKeyPositions(firstLayerKeyCount);
                keymap.metadata.isSplit = true;
            } else {
                keymap.keys = this.generateKeyPositions(firstLayerKeyCount);
            }
        }

        return keymap;
    }

    /**
     * Parse QMK source files
     */
    async parseQmkSource(content, fileName) {
        const keymap = {
            type: 'QMK',
            name: fileName,
            layout: null,
            keys: [],
            encoders: [],
            trackballs: [],
            displays: [],
            layers: [],
            metadata: {}
        };

        // Extract keyboard name from config
        const keyboardMatch = content.match(/#define\s+KEYBOARD_NAME\s+"([^"]+)"/);
        if (keyboardMatch) {
            keymap.name = keyboardMatch[1];
        }

        // Extract layout macro
        const layoutMatch = content.match(/LAYOUT[^(]*\([^)]*\)/g);
        if (layoutMatch) {
            const layoutStr = layoutMatch[0];
            const keyMatches = layoutStr.match(/k\w\w/g);
            if (keyMatches) {
                keymap.keys = this.generateKeyPositions(keyMatches.length);
            }
        }

        // Extract keymaps
        const keymapMatches = content.match(/\[([^\]]+)\]\s*=\s*LAYOUT[^(]*\(([^)]*)\)/g);
        if (keymapMatches) {
            keymapMatches.forEach(match => {
                const layerMatch = match.match(/\[([^\]]+)\]/);
                const keysMatch = match.match(/LAYOUT[^(]*\(([^)]*)\)/);
                
                if (layerMatch && keysMatch) {
                    const layerName = layerMatch[1].trim();
                    const keys = this.parseQmkKeycodes(keysMatch[1]);
                    keymap.layers.push({
                        name: layerName,
                        keys: keys
                    });
                }
            });
        }

        return keymap;
    }

    /**
     * Parse binary firmware files (basic info extraction)
     */
    async parseBinaryFirmware(content, fileName) {
        // For binary files, we can only provide basic info
        // Real parsing would require complex reverse engineering
        
        return {
            type: fileName.endsWith('.uf2') ? 'ZMK' : 'QMK',
            name: fileName,
            layout: this.keyboardLayouts['60'], // Default assumption
            keys: this.generateKeyPositions(61), // Standard 60% layout
            encoders: [],
            trackballs: [],
            displays: [],
            layers: [
                { name: 'base', keys: new Array(61).fill('KC_NO') }
            ],
            metadata: {
                note: 'Binary firmware - limited parsing available'
            }
        };
    }

    /**
     * Detect firmware type from configuration
     */
    detectFirmwareType(config) {
        if (config.zmk || config.behaviors || config.keymap) return 'ZMK';
        if (config.qmk || config.keyboard || config.layout_aliases) return 'QMK';
        return 'Generic';
    }

    /**
     * Detect if keyboard is split from configuration
     */
    detectSplitKeyboard(config) {
        // Check for explicit split configuration
        if (config.split && config.split.enabled) return true;
        if (config.split === true) return true;
        
        // Check for split-specific features
        if (config.split && (config.split.handedness || config.split.soft_serial_pin)) return true;
        
        // Check for layout names that indicate split
        if (config.layout) {
            const layoutName = config.layout.toLowerCase ? config.layout.toLowerCase() : config.layout;
            if (typeof layoutName === 'string' && (
                layoutName.includes('split') || 
                layoutName.includes('corne') ||
                layoutName.includes('crkbd') ||
                layoutName.includes('kyria') ||
                layoutName.includes('lily58') ||
                layoutName.includes('iris')
            )) {
                return true;
            }
        }
        
        // Check for split layout patterns in layouts config
        if (config.layouts) {
            for (const layoutName in config.layouts) {
                if (layoutName.toLowerCase().includes('split')) {
                    return true;
                }
            }
        }
        
        // Check keyboard name for split indicators
        const keyboardName = (config.keyboard_name || config.keyboard || config.name || '').toLowerCase();
        if (keyboardName.includes('split') || 
            keyboardName.includes('corne') ||
            keyboardName.includes('rattusboard') ||
            keyboardName.includes('crkbd')) {
            return true;
        }
        
        return false;
    }

    /**
     * Extract keys from configuration
     */
    extractKeys(config) {
        if (config.keys) return config.keys;
        if (config.layout && config.layout.keys) return config.layout.keys;
        
        // Handle split keyboard layouts
        if (config.layouts) {
            for (const layoutName in config.layouts) {
                const layoutConfig = config.layouts[layoutName];
                if (layoutConfig.layout && Array.isArray(layoutConfig.layout)) {
                    const isSplit = this.detectSplitKeyboard(config);
                    return this.generateKeysFromLayout(layoutConfig.layout, isSplit);
                }
            }
        }
        
        if (config.matrix) {
            const isSplit = this.detectSplitKeyboard(config);
            const totalKeys = config.matrix.rows * config.matrix.cols;
            if (isSplit) {
                return this.generateSplitKeyPositions(totalKeys, config);
            }
            return this.generateKeyPositions(totalKeys);
        }
        
        // Check if this looks like a split keyboard and adjust default
        const isSplit = this.detectSplitKeyboard(config);
        if (isSplit) {
            return this.generateSplitKeyPositions(42, config); // Default split (like Corne)
        }
        
        return this.generateKeyPositions(61); // Default 60%
    }

    /**
     * Extract encoders from configuration
     */
    extractEncoders(config) {
        const encoders = [];
        if (config.encoders) {
            config.encoders.forEach((encoder, index) => {
                encoders.push({
                    id: index,
                    name: encoder.name || `Encoder ${index + 1}`,
                    pins: encoder.pins || [],
                    steps: encoder.steps || 20
                });
            });
        }
        return encoders;
    }

    /**
     * Extract trackballs from configuration
     */
    extractTrackballs(config) {
        const trackballs = [];
        if (config.trackballs || config.pointing_devices) {
            const devices = config.trackballs || config.pointing_devices;
            devices.forEach((device, index) => {
                trackballs.push({
                    id: index,
                    name: device.name || `Trackball ${index + 1}`,
                    type: device.type || 'trackball',
                    sensitivity: device.sensitivity || 1.0
                });
            });
        }
        return trackballs;
    }

    /**
     * Extract displays from configuration
     */
    extractDisplays(config) {
        const displays = [];
        if (config.displays || config.oled) {
            const displayConfigs = config.displays || [config.oled];
            displayConfigs.forEach((display, index) => {
                displays.push({
                    id: index,
                    name: display.name || `Display ${index + 1}`,
                    type: display.type || 'oled',
                    width: display.width || 128,
                    height: display.height || 32
                });
            });
        }
        return displays;
    }

    /**
     * Extract layers from configuration
     */
    extractLayers(config) {
        const layers = [];
        if (config.layers) {
            config.layers.forEach((layer, index) => {
                layers.push({
                    name: layer.name || `Layer ${index}`,
                    keys: layer.keys || []
                });
            });
        }
        return layers;
    }

    /**
     * Parse ZMK bindings
     */
    parseZmkBindings(bindingsStr) {
        const bindings = bindingsStr.trim().split(/\s+/);
        return bindings.filter(binding => binding.length > 0);
    }

    /**
     * Parse QMK keycodes
     */
    parseQmkKeycodes(keysStr) {
        const keys = keysStr.split(',').map(key => key.trim());
        return keys.filter(key => key.length > 0);
    }

    /**
     * Generate key positions for a given number of keys
     */
    generateKeyPositions(keyCount) {
        const keys = [];
        const layout = this.detectLayoutByKeyCount(keyCount);
        
        for (let i = 0; i < keyCount; i++) {
            const row = Math.floor(i / layout.cols);
            const col = i % layout.cols;
            
            keys.push({
                id: i,
                row: row,
                col: col,
                x: col * 50 + 10,
                y: row * 50 + 10,
                width: 45,
                height: 45,
                keycode: 'KC_NO'
            });
        }
        
        return keys;
    }

    /**
     * Generate key positions for split keyboards
     */
    generateSplitKeyPositions(keyCount, config = {}) {
        const keys = [];
        
        // Default split layout parameters (Corne-like)
        let leftKeys = Math.floor(keyCount / 2);
        let rightKeys = keyCount - leftKeys;
        
        // Check if we have explicit layout information
        if (config.layouts) {
            for (const layoutName in config.layouts) {
                const layoutConfig = config.layouts[layoutName];
                if (layoutConfig.layout && Array.isArray(layoutConfig.layout)) {
                    return this.generateKeysFromLayout(layoutConfig.layout, true);
                }
            }
        }
        
        // For typical split keyboards like Corne (3x6+3)
        const leftCols = 6;
        const rightCols = 6;
        const mainRows = 3;
        const thumbKeys = 3;
        const splitGap = 100; // Gap between halves
        
        let keyId = 0;
        
        // Generate left half keys
        for (let row = 0; row < mainRows; row++) {
            for (let col = 0; col < leftCols; col++) {
                keys.push({
                    id: keyId++,
                    row: row,
                    col: col,
                    x: col * 50 + 10,
                    y: row * 50 + 10,
                    width: 45,
                    height: 45,
                    keycode: 'KC_NO',
                    half: 'left'
                });
            }
        }
        
        // Left thumb cluster
        for (let i = 0; i < thumbKeys; i++) {
            keys.push({
                id: keyId++,
                row: mainRows,
                col: 3 + i, // Centered thumb cluster
                x: (3 + i) * 50 + 10,
                y: mainRows * 50 + 25, // Slightly lower
                width: 45,
                height: 45,
                keycode: 'KC_NO',
                half: 'left'
            });
        }
        
        // Generate right half keys
        for (let row = 0; row < mainRows; row++) {
            for (let col = 0; col < rightCols; col++) {
                keys.push({
                    id: keyId++,
                    row: row,
                    col: col,
                    x: col * 50 + 10 + (leftCols * 50) + splitGap,
                    y: row * 50 + 10,
                    width: 45,
                    height: 45,
                    keycode: 'KC_NO',
                    half: 'right'
                });
            }
        }
        
        // Right thumb cluster
        for (let i = 0; i < thumbKeys; i++) {
            keys.push({
                id: keyId++,
                row: mainRows,
                col: i,
                x: i * 50 + 10 + (leftCols * 50) + splitGap,
                y: mainRows * 50 + 25, // Slightly lower
                width: 45,
                height: 45,
                keycode: 'KC_NO',
                half: 'right'
            });
        }
        
        return keys;
    }

    /**
     * Generate keys from QMK/ZMK layout configuration
     */
    generateKeysFromLayout(layoutArray, isSplit = false) {
        const keys = [];
        const splitGap = isSplit ? 50 : 0;
        let rightHalfStartX = 0;
        
        // If split, find the gap in x coordinates to determine split point
        if (isSplit && layoutArray.length > 0) {
            const xCoords = layoutArray.map(key => key.x).sort((a, b) => a - b);
            
            // Find the largest gap in x coordinates
            let maxGap = 0;
            let gapPosition = 0;
            for (let i = 1; i < xCoords.length; i++) {
                const gap = xCoords[i] - xCoords[i-1];
                if (gap > maxGap) {
                    maxGap = gap;
                    gapPosition = xCoords[i];
                }
            }
            
            // If there's a significant gap, use it as the split point
            if (maxGap > 1.5) {
                rightHalfStartX = gapPosition;
            }
        }
        
        layoutArray.forEach((keyDef, index) => {
            const keyX = keyDef.x * 50 + 10;
            const keyY = keyDef.y * 50 + 10;
            
            // Determine which half this key belongs to
            let half = 'left';
            if (isSplit && keyDef.x >= rightHalfStartX) {
                half = 'right';
            }
            
            keys.push({
                id: index,
                row: keyDef.matrix ? keyDef.matrix[0] : Math.floor(keyDef.y),
                col: keyDef.matrix ? keyDef.matrix[1] : Math.floor(keyDef.x),
                x: keyX + (half === 'right' && isSplit ? splitGap : 0),
                y: keyY,
                width: (keyDef.w || 1) * 45,
                height: (keyDef.h || 1) * 45,
                keycode: keyDef.keycode || 'KC_NO',
                half: half
            });
        });
        
        return keys;
    }

    /**
     * Detect layout from key count
     */
    detectLayoutByKeyCount(keyCount) {
        if (keyCount <= 48) {
            // Could be ortho or split
            if (keyCount >= 36 && keyCount <= 42) {
                return this.keyboardLayouts.split; // Likely Corne-like split
            }
            return this.keyboardLayouts.ortho;
        }
        if (keyCount <= 61) return this.keyboardLayouts['60'];
        if (keyCount <= 68) return this.keyboardLayouts['65'];
        if (keyCount <= 84) return this.keyboardLayouts['75'];
        if (keyCount <= 87) return this.keyboardLayouts.tkl;
        return this.keyboardLayouts.full;
    }

    /**
     * Detect layout from configuration
     */
    detectLayoutFromConfig(config) {
        // First check for explicit split configuration
        if (this.detectSplitKeyboard(config)) {
            return this.keyboardLayouts.split;
        }
        
        if (config.layout) {
            const layoutName = config.layout.toLowerCase ? config.layout.toLowerCase() : 
                              (typeof config.layout === 'string' ? config.layout.toLowerCase() : '');
            for (const [key, layout] of Object.entries(this.keyboardLayouts)) {
                if (layoutName.includes(key) || layoutName.includes(layout.name.toLowerCase())) {
                    return layout;
                }
            }
        }
        
        // Check layouts object for split patterns
        if (config.layouts) {
            for (const layoutName in config.layouts) {
                if (layoutName.toLowerCase().includes('split')) {
                    return this.keyboardLayouts.split;
                }
            }
        }
        
        return null;
    }

    /**
     * Auto-detect layout from parsed data
     */
    detectLayout(parsedData) {
        // First check if metadata indicates split
        if (parsedData.metadata && parsedData.metadata.isSplit) {
            return this.keyboardLayouts.split;
        }
        
        // Check if any key has a 'half' property (indicates split)
        if (parsedData.keys && parsedData.keys.some(key => key.half)) {
            return this.keyboardLayouts.split;
        }
        
        // Check for ZMK split keyboards by key count and type
        if (parsedData.type === 'ZMK' && parsedData.keys && parsedData.keys.length > 0) {
            const keyCount = parsedData.keys.length;
            // Common ZMK split keyboard key counts
            if (keyCount >= 30 && keyCount <= 50) {
                return this.keyboardLayouts.split;
            }
        }
        
        if (parsedData.keys && parsedData.keys.length > 0) {
            return this.detectLayoutByKeyCount(parsedData.keys.length);
        }
        return this.keyboardLayouts['60']; // Default
    }
}