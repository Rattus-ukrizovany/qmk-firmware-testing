# 🔧 Virtual Keyboard Firmware Tester

A web-based virtual workspace for testing QMK and ZMK keyboard firmware. Upload your firmware files and test every key, encoder, trackball, and display component in an interactive GUI environment.

## ✨ Features

- **Universal Firmware Support**: Compatible with QMK (.json, .c, .h, .hex) and ZMK (.keymap, .uf2) firmware files
- **Interactive Key Testing**: Visual keyboard layout with click-to-test functionality
- **Advanced Components**: Support for encoders, trackballs, and displays
- **Real-time Feedback**: Immediate visual feedback and comprehensive test logging
- **Export Results**: Generate detailed test reports in JSON format
- **Drag & Drop**: Easy firmware file upload with drag and drop support
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Option 1: Direct Usage (Recommended)
1. Open `index.html` in your web browser
2. Drag and drop your firmware file or click to browse
3. Start testing your keyboard layout interactively

### Option 2: Local Server
```bash
# Clone or download this repository
git clone https://github.com/Rattus-ukrizovany/qmk-firmware-testing.git
cd qmk-firmware-testing

# Start a simple HTTP server
python -m http.server 8000
# OR
npx serve .

# Open http://localhost:8000 in your browser
```

## 📝 How to Use

### 1. Upload Firmware
- **Drag & Drop**: Simply drag your firmware file onto the upload area
- **Browse**: Click the upload area to select files from your computer
- **Supported Formats**: 
  - JSON configuration files (`.json`)
  - QMK source files (`.c`, `.h`)
  - ZMK keymap files (`.keymap`)
  - Compiled firmware (`.hex`, `.uf2`)

### 2. Test Your Keyboard
- **Click Keys**: Click on any key in the virtual keyboard to test it
- **Visual Feedback**: 
  - Gray = Untested
  - Yellow = Hover/Active
  - Red = Currently pressed
  - Green = Successfully tested
- **Real Keyboard**: Type on your actual keyboard to test keys (if connected)

### 3. Test Additional Components

#### Encoders
- Click the rotation buttons (↶ ↷) to simulate encoder rotation
- Click the center button (●) to simulate encoder press
- Watch for visual feedback and log entries

#### Trackballs
- Move your mouse over the trackball area to simulate movement
- Real-time position tracking and sensitivity testing
- Visual cursor shows current position

#### Displays
- Click "Test Display" to run display functionality tests
- Simulated screen output with test patterns
- Support for OLED and LCD displays

### 4. Monitor Progress
- **Statistics**: Track tested vs. total keys
- **Test Log**: Real-time logging of all test activities
- **Progress Indicator**: Visual progress tracking

### 5. Export Results
- Click "Export Results" to download a comprehensive test report
- JSON format with detailed key-by-key results
- Includes timestamps, firmware info, and test statistics

## 📁 Example Firmware Files

The `examples/` directory contains sample firmware files for testing:

- `60-percent-keyboard.json` - Standard 60% keyboard layout
- `split-keyboard-zmk.keymap` - ZMK split keyboard configuration  
- `advanced-keyboard.json` - Full-featured keyboard with encoders, trackball, and displays

## 🎛️ Controls

| Control | Action |
|---------|--------|
| **Reset Test** | Mark all keys as untested |
| **Toggle Labels** | Show/hide key labels and codes |
| **Export Results** | Download test results as JSON |

## 🔧 Technical Details

### Supported Firmware Types
- **QMK**: JSON configs, C/H source files, compiled HEX files
- **ZMK**: Keymap files, compiled UF2 files
- **Generic**: Basic JSON format for custom keyboards

### Key Features
- **Smart Layout Detection**: Automatically detects keyboard layout from firmware
- **Multi-layer Support**: Handle multiple keyboard layers and functions
- **Component Detection**: Automatically identifies encoders, trackballs, displays
- **Browser Compatibility**: Works in all modern web browsers
- **No Installation Required**: Pure web-based solution

### File Format Support

#### JSON Configuration Format
```json
{
  "keyboard": "Your Keyboard Name",
  "type": "QMK|ZMK|Generic",
  "layout": { "name": "60%", "rows": 5, "cols": 14 },
  "keys": [
    {
      "id": 0,
      "row": 0,
      "col": 0, 
      "x": 10,
      "y": 10,
      "width": 45,
      "height": 45,
      "keycode": "KC_ESC"
    }
  ],
  "encoders": [...],
  "trackballs": [...],
  "displays": [...]
}
```

## 🐛 Troubleshooting

### Common Issues

**File not loading:**
- Check file format is supported
- Verify JSON syntax if using JSON format
- Try with example files first

**Keys not displaying correctly:**
- Check if layout information is present in firmware
- Verify key position coordinates
- Try toggling labels on/off

**Components not detected:**
- Ensure firmware file includes component definitions
- Check console for parsing errors
- Verify component configuration format

**Browser compatibility:**
- Use a modern web browser (Chrome, Firefox, Safari, Edge)
- Enable JavaScript
- Allow file access permissions

## 🤝 Contributing

Contributions are welcome! Here are ways you can help:

- **Add firmware format support**: Extend parser for new firmware types
- **Improve layouts**: Add more keyboard layout templates
- **Bug fixes**: Report and fix issues
- **Documentation**: Improve guides and examples
- **Testing**: Test with various firmware files

## 📄 License

This project is open source and available under the MIT License.

## 🔗 Related Projects

- [QMK Firmware](https://github.com/qmk/qmk_firmware) - Open source keyboard firmware
- [ZMK Firmware](https://github.com/zmkfirmware/zmk) - Modern keyboard firmware
- [VIA](https://www.caniusevia.com/) - Visual keyboard layout editor

---

**Happy Testing!** 🎉

If you find this tool useful, please star the repository and share it with the mechanical keyboard community!