// Background service worker for handling QR code actions
class QRBackgroundHandler {
  constructor() {
    this.setupMessageListener();
    this.setupActionClickListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'startAreaSelection':
          this.startAreaSelection();
          break;
        case 'qrFound':
          // Store in history and notify popup
          this.handleQRFound(request.content, request.type);
          break;
      }

      switch (request.type) {
        case 'QR_CODE_FOUND':
          this.handleQRCodeFound(request.data, sender.tab);
          break;
        case 'OPEN_QR_URL':
          this.openURL(request.data);
          break;
        case 'SCAN_COMPLETE':
          this.updateBadge(request.foundCount);
          break;
        case 'SCREEN_CAPTURE_SCAN':
          this.handleScreenCapture(sender, sendResponse);
          return true; // Keep message channel open for async response
        case 'AREA_CAPTURE_SCAN':
          this.handleAreaCapture(sender, sendResponse, request.area, request.deviceInfo);
          return true; // Keep message channel open for async response
      }
    });
  }

  async handleQRFound(content, type) {
    // Get existing history
    const result = await chrome.storage.local.get(['qrHistory']);
    const history = result.qrHistory || [];

    // Add new item to the beginning
    history.unshift({
      content,
      type,
      timestamp: Date.now()
    });

    // Keep only last 50 items
    if (history.length > 50) {
      history.pop();
    }

    // Save updated history
    await chrome.storage.local.set({ qrHistory: history });

    // Notify any open popups
    chrome.runtime.sendMessage({
      action: 'qrFound',
      content,
      type
    });
  }

  async startAreaSelection() {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('No active tab found');
        return;
      }

      // Send message to content script to start area selection
      chrome.tabs.sendMessage(tab.id, { type: 'START_AREA_SELECTION' });
    } catch (error) {
      console.error('Failed to start area selection:', error);
    }
  }

  setupActionClickListener() {
    chrome.action.onClicked.addListener((tab) => {
      this.scanCurrentTab(tab.id);
    });
  }

  showToastOnTab(tabId, message, type = 'info') {
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_TOAST',
      message: message,
      toastType: type
    });
  }

  handleQRCodeFound(data, tab) {
    if (this.isValidURL(data)) {
      this.openURL(data);
    } else {
      // For non-URL content, open a Google search
      const searchURL = `https://www.google.com/search?q=${encodeURIComponent(data)}`;
      this.openURL(searchURL);
    }
  }

  openURL(url) {
    chrome.tabs.create({ url: url });
  }

  isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  scanCurrentTab(tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' });
  }

  updateBadge(count) {
    chrome.action.setBadgeText({
      text: count > 0 ? '•' : ''
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#4CAF50'
    });
  }

  async handleScreenCapture(sender, sendResponse) {
    try {
      console.log('📸 Starting screen capture scan...');
      
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        sendResponse({ success: false, message: 'No active tab found' });
        return;
      }

      // Capture the visible area of the tab
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Screen capture failed:', chrome.runtime.lastError);
          sendResponse({ success: false, message: 'Failed to capture screen' });
          return;
        }

        console.log('📸 Screen captured, sending to content script...');
        
        // Send the captured image to the content script for QR analysis
        chrome.tabs.sendMessage(tab.id, {
          type: 'ANALYZE_SCREEN_CAPTURE',
          imageData: dataUrl
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send image to content script:', chrome.runtime.lastError);
            sendResponse({ success: false, message: 'Failed to analyze capture' });
          } else {
            const foundCount = response ? response.foundCount : 0;
            sendResponse({ 
              success: true, 
              message: `Screen capture scan completed! Found ${foundCount} QR code(s)`,
              foundCount: foundCount,
              qrData: response.qrData || null
            });
          }
        });
      });
    } catch (error) {
      console.error('Screen capture error:', error);
      sendResponse({ success: false, message: 'Screen capture failed' });
    }
  }

  async handleAreaCapture(sender, sendResponse, area, deviceInfo = null) {
    try {
      console.log('🎯 Starting area capture scan...', area);
      console.log('📱 Device info received:', deviceInfo);
      
      // Validate area dimensions
      if (!area || area.width < 10 || area.height < 10) {
        console.error('❌ Invalid area dimensions:', area);
        sendResponse({ success: false, message: 'Invalid selection area' });
        return;
      }
      
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('❌ No active tab found');
        sendResponse({ success: false, message: 'No active tab found' });
        return;
      }

      console.log('📸 Capturing visible tab for area scan...');
      
      // Capture the visible area of the tab
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Area capture failed:', chrome.runtime.lastError);
          sendResponse({ success: false, message: 'Failed to capture screen' });
          return;
        }

        console.log('✅ Screen captured, sending to content script for cropping...');
        
        // Send the full screenshot to content script for cropping and analysis
        chrome.tabs.sendMessage(tab.id, {
          type: 'CROP_AND_ANALYZE_AREA',
          imageData: dataUrl,
          area: area,
          deviceInfo: deviceInfo
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Failed to send to content script:', chrome.runtime.lastError);
            sendResponse({ success: false, message: 'Failed to analyze capture' });
          } else {
            console.log('✅ Area analysis complete:', response);
            const foundCount = response ? response.foundCount : 0;
            sendResponse({ 
              success: true, 
              message: `Area scan completed! Found ${foundCount} QR code(s)`,
              foundCount: foundCount,
              qrData: response && response.qrData ? response.qrData : null
            });
          }
        });
      });
    } catch (error) {
      console.error('❌ Area capture error:', error);
      sendResponse({ success: false, message: 'Area capture failed' });
    }
  }
}

// Initialize background handler
new QRBackgroundHandler(); 