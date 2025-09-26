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
            
            return {
                type: this.detectFirmwareType(config),
                name: config.keyboard || config.name || fileName,
                layout: config.layout || this.detectLayoutFromConfig(config),
                keys: this.extractKeys(config),
                encoders: this.extractEncoders(config),
                trackballs: this.extractTrackballs(config),
                displays: this.extractDisplays(config),
                layers: this.extractLayers(config),
                metadata: {
                    version: config.version,
                    author: config.author,
                    description: config.description
                }
            };
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
            keymap.keys = this.generateKeyPositions(keymap.layers[0].keys.length);
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
     * Extract keys from configuration
     */
    extractKeys(config) {
        if (config.keys) return config.keys;
        if (config.layout && config.layout.keys) return config.layout.keys;
        if (config.matrix) {
            return this.generateKeyPositions(config.matrix.rows * config.matrix.cols);
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
     * Detect layout from key count
     */
    detectLayoutByKeyCount(keyCount) {
        if (keyCount <= 48) return this.keyboardLayouts.ortho;
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
        if (config.layout) {
            const layoutName = config.layout.toLowerCase();
            for (const [key, layout] of Object.entries(this.keyboardLayouts)) {
                if (layoutName.includes(key) || layoutName.includes(layout.name.toLowerCase())) {
                    return layout;
                }
            }
        }
        return null;
    }

    /**
     * Auto-detect layout from parsed data
     */
    detectLayout(parsedData) {
        if (parsedData.keys && parsedData.keys.length > 0) {
            return this.detectLayoutByKeyCount(parsedData.keys.length);
        }
        return this.keyboardLayouts['60']; // Default
    }
}