# sQR - Chrome Extension

A Chrome extension that allows you to scan QR codes on web pages by selecting an area. It stores your scan history and lets you quickly copy previously scanned content.

![20250718-183257](https://github.com/user-attachments/assets/d04c006c-e558-4d1f-a0b3-e5c952ba29df)


## Features

- 🎯 **Area Selection Scanning**: Draw selection boxes around specific QR codes for targeted detection
- 📝 **Scan History**: Keeps track of your last 50 scanned QR codes
- 📋 **Quick Copy**: Click any history item to copy its content to clipboard
- 🔍 **Smart Recognition**: Automatically detects different types of QR codes:
  - URLs: Opens in new tab when clicked
  - Emails: Opens mail client when clicked
  - Phone numbers: Opens dialer when clicked
  - Text: Shows "Copied" notification when clicked

## How to Load the Extension in Chrome

### Step 1: Enable Developer Mode
1. Open Chrome and go to `chrome://extensions/`
2. Toggle on **"Developer mode"** in the top-right corner

### Step 2: Load the Extension
1. Click **"Load unpacked"** button
2. Navigate to and select the `sQR` folder
3. The extension should now appear in your extensions list

### Step 3: Pin the Extension (Optional)
1. Click the puzzle piece icon (🧩) in Chrome's toolbar
2. Find "sQR" and click the pin icon to keep it visible

## How to Use

### Scanning QR Codes
1. Click the sQR extension icon in your toolbar
2. Click "Select Area to Scan"
3. Draw a selection box around the QR code you want to scan
4. The content will be automatically copied and saved to history

### Using Scan History
1. Open the extension popup
2. Click the "History" tab
3. Click any item to copy its content:
   - URLs will open in a new tab
   - Emails will open your mail client
   - Phone numbers will open your dialer
   - Text content will be copied with a "Copied" notification

## Extension Permissions

- **activeTab**: Required to scan QR codes on the current page
- **storage**: Used to store scan history
- **desktopCapture**: Required for area selection scanning
- **scripting**: Required for content script injection
- **clipboardWrite**: Required for copying QR code content

## Technical Details

### File Structure
```
sQR/
├── manifest.json          # Extension configuration
├── content_script.js      # Handles QR scanning and area selection
├── background.js         # Manages history and browser actions
├── popup.html           # Extension popup with scan/history tabs
├── popup.js            # Popup functionality
├── popup.css           # Popup styling
├── lib/
│   └── jsqr.js        # QR code detection library
└── icons/             # Extension icons
```

### Core Components
- **Content Script**: Handles area selection and QR code detection
- **Background Script**: Manages scan history and browser actions
- **Popup Interface**: Provides scanning controls and history access

## Troubleshooting

### QR Codes Not Detected
- Make sure QR codes are clear and not too small
- Try adjusting your selection area
- Ensure the QR code is fully visible in the selection

### History Not Updating
- Make sure you have successfully scanned a QR code
- Check that you're using a supported Chromium-based browser
- Try refreshing the extension popup

## Support

If you encounter any issues:
1. Check the Chrome Developer Console for errors
2. Ensure you're using the latest version of Chrome
3. Try disabling and re-enabling the extension

## License

This project is open source. Feel free to modify and distribute. 
