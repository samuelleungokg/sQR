// Content script for scanning QR codes on web pages
class QRScanner {
  constructor() {
    this.isScanning = false;
    this.canvas = null;
    this.ctx = null;
    this.activePopup = null;
    this.areaSelection = null;
    this.init();
  }

  init() {
    this.createCanvas();
    this.injectStyles();
    this.listenForMessages();
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .qr-popup {
        position: absolute;
        background: white;
        border: 2px solid #4CAF50;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 250px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        display: none;
      }
      
      .qr-popup.show {
        display: block;
        animation: qrPopupFadeIn 0.2s ease-out;
      }
      
      @keyframes qrPopupFadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      
      .qr-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid #eee;
      }
      
      .qr-popup-title {
        font-weight: 600;
        color: #333;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .qr-popup-close {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
      }
      
      .qr-popup-close:hover {
        background: #f5f5f5;
        color: #333;
      }
      
      .qr-popup-content {
        color: #444;
        word-break: break-all;
      }
      
      .qr-popup-content a {
        color: #2196F3;
        text-decoration: none;
      }
      
      .qr-popup-content a:hover {
        text-decoration: underline;
      }
      
      .qr-popup-type {
        background: #f0f8ff;
        color: #1976D2;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
        margin-top: 6px;
        display: inline-block;
        font-weight: 500;
      }

      .area-selection-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        z-index: 999999;
        cursor: crosshair;
        user-select: none;
      }

      .selection-box {
        position: absolute;
        border: 2px dashed #FF9800;
        background: rgba(255, 152, 0, 0.1);
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
      }

      .selection-instructions {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #FF9800;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000000;
        animation: instructionsFadeIn 0.3s ease-out;
      }

      @keyframes instructionsFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      .selection-cancel {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .selection-cancel:hover {
        background: #d32f2f;
      }

      .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000001;
        animation: toastSlideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        max-width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .toast.success {
        background: #4CAF50;
      }

      .toast.error {
        background: #f44336;
      }

      .toast.warning {
        background: #FF9800;
      }

      .toast.info {
        background: #2196F3;
      }

      @keyframes toastSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  scanExistingImages() {
    // Scan regular images
    const images = document.querySelectorAll('img');
    images.forEach(img => this.scanImage(img));
    
    // Scan canvas elements
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => this.scanCanvas(canvas));
    
    // Scan SVG elements
    const svgs = document.querySelectorAll('svg');
    svgs.forEach(svg => this.scanSVG(svg));
    
    // Scan elements with background images
    this.scanBackgroundImages();
  }

  setupObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Scan images
            const images = node.tagName === 'IMG' ? [node] : node.querySelectorAll('img');
            images.forEach(img => this.scanImage(img));
            
            // Scan canvas elements
            const canvases = node.tagName === 'CANVAS' ? [node] : node.querySelectorAll('canvas');
            canvases.forEach(canvas => this.scanCanvas(canvas));
            
            // Scan SVG elements
            const svgs = node.tagName === 'SVG' ? [node] : node.querySelectorAll('svg');
            svgs.forEach(svg => this.scanSVG(svg));
            
            // Check for background images on the new element and its children
            this.scanElementForBackgroundImages(node);
          }
        });
        
        // Also check for attribute changes that might affect background images
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          this.scanElementForBackgroundImages(mutation.target);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  scanImage(img) {
    if (!img.complete || img.naturalWidth === 0) {
      img.onload = () => this.processImage(img);
      return;
    }
    this.processImage(img);
  }

  processImage(img) {
    try {
      // Skip if already processed
      if (img.dataset.qrProcessed) return;
      
      this.canvas.width = img.naturalWidth;
      this.canvas.height = img.naturalHeight;
      this.ctx.drawImage(img, 0, 0);
      
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        this.handleQRCode(code.data, img);
      }
    } catch (error) {
      console.log('Error processing image:', error);
      // If cross-origin error, try alternative method
      if (error.name === 'SecurityError') {
        this.handleCORSImage(img);
      }
    }
  }

  scanCanvas(canvas) {
    try {
      // Skip if already processed
      if (canvas.dataset.qrProcessed) return;
      
      const context = canvas.getContext('2d');
      if (!context) return;
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        this.handleQRCode(code.data, canvas);
      }
    } catch (error) {
      console.log('Error processing canvas:', error);
    }
  }

  scanSVG(svg) {
    try {
      // Skip if already processed
      if (svg.dataset.qrProcessed) return;
      
      // Convert SVG to canvas for scanning
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        try {
          this.canvas.width = img.width || svg.clientWidth || 150;
          this.canvas.height = img.height || svg.clientHeight || 150;
          this.ctx.drawImage(img, 0, 0);
          
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            this.handleQRCode(code.data, svg);
          }
          URL.revokeObjectURL(url);
        } catch (error) {
          console.log('Error processing SVG:', error);
          URL.revokeObjectURL(url);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    } catch (error) {
      console.log('Error processing SVG:', error);
    }
  }

  scanBackgroundImages() {
    const elements = document.querySelectorAll('*');
    elements.forEach(element => this.scanElementForBackgroundImages(element));
  }

  scanElementForBackgroundImages(element) {
    try {
      // Skip if already processed
      if (element.dataset.qrBgProcessed) return;
      
      const style = window.getComputedStyle(element);
      const backgroundImage = style.backgroundImage;
      
      if (backgroundImage && backgroundImage !== 'none') {
        // Extract URL from background-image
        const urlMatch = backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          const imageUrl = urlMatch[1];
          this.loadAndScanBackgroundImage(imageUrl, element);
        }
      }
    } catch (error) {
      console.log('Error checking background image:', error);
    }
  }

  loadAndScanBackgroundImage(imageUrl, element) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          this.ctx.drawImage(img, 0, 0);
          
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            element.dataset.qrBgProcessed = 'true';
            this.handleQRCode(code.data, element);
          }
        } catch (error) {
          console.log('Error scanning background image:', error);
        }
      };
      
      img.onerror = () => {
        // Fallback: try without crossOrigin
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          try {
            this.canvas.width = fallbackImg.width;
            this.canvas.height = fallbackImg.height;
            this.ctx.drawImage(fallbackImg, 0, 0);
            
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
              element.dataset.qrBgProcessed = 'true';
              this.handleQRCode(code.data, element);
            }
          } catch (error) {
            console.log('Error scanning background image (fallback):', error);
          }
        };
        fallbackImg.src = imageUrl;
      };
      
      img.src = imageUrl;
    } catch (error) {
      console.log('Error loading background image:', error);
    }
  }

  handleCORSImage(img) {
    // For CORS images, we can't scan them directly, but we can still mark them
    // and provide a way for users to manually trigger scanning
    console.log('CORS-protected image detected, cannot scan automatically');
  }

  handleQRCode(data) {
    // Determine the content type
    let type = 'text';
    if (data.startsWith('http://') || data.startsWith('https://')) {
      type = 'url';
    } else if (data.startsWith('mailto:') || (data.includes('@') && data.includes('.'))) {
      type = 'email';
    } else if (data.startsWith('tel:')) {
      type = 'phone';
    }

    // Send the result to the popup for history storage
    chrome.runtime.sendMessage({
      action: 'qrFound',
      content: data,
      type: type
    });

    // Copy to clipboard
    navigator.clipboard.writeText(data).then(() => {
      // Handle based on content type
      if (type === 'url') {
        this.showToast('✅ URL copied and opening...', 'success', 2000);
        chrome.runtime.sendMessage({
          type: 'OPEN_QR_URL',
          data: data
        });
      } else if (type === 'email') {
        this.showToast('✅ Email address copied and opening mail client...', 'success', 2000);
        window.location.href = data.startsWith('mailto:') ? data : `mailto:${data}`;
      } else if (type === 'phone') {
        this.showToast('✅ Phone number copied and dialing...', 'success', 2000);
        window.location.href = data.startsWith('tel:') ? data : `tel:${data}`;
      } else {
        this.showToast('✅ Text copied to clipboard', 'success', 2000);
      }
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      this.showToast('❌ Failed to copy to clipboard', 'error', 2000);
    });
  }

  createPopup(data, img) {
    const popup = document.createElement('div');
    popup.className = 'qr-popup';
    popup.id = `qr-popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const type = this.getQRType(data);
    const truncatedData = data.length > 20 ? data.substring(0, 20) + '...' : data;
    const isUrl = this.isValidURL(data);
    
    popup.innerHTML = `
      <div class="qr-popup-header">
        <div class="qr-popup-title">QR Code</div>
        <button class="qr-popup-close" title="Close">✕</button>
      </div>
      <div class="qr-popup-content">
        ${isUrl ? `<a href="${data}" target="_blank">${truncatedData}</a>` : truncatedData}
      </div>
      <div class="qr-popup-type">${type}</div>
    `;
    
    // Add close button handler
    const closeBtn = popup.querySelector('.qr-popup-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePopup(popup);
    });
    
    // Add click handler for non-URL content
    if (!isUrl) {
      popup.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({
          type: 'OPEN_QR_URL',
          data: data
        });
      });
      popup.style.cursor = 'pointer';
      popup.title = 'Click to search';
    }
    
    document.body.appendChild(popup);
    return popup;
  }

  togglePopup(popup, img) {
    // Hide any other active popup
    if (this.activePopup && this.activePopup !== popup) {
      this.hidePopup(this.activePopup);
    }
    
    if (popup.classList.contains('show')) {
      this.hidePopup(popup);
    } else {
      this.showPopup(popup, img);
    }
  }

  showPopup(popup, img) {
    // Position popup next to the image
    this.positionPopup(popup, img);
    popup.classList.add('show');
    this.activePopup = popup;
    
    // Add outside click handler to close popup
    setTimeout(() => {
      const handler = this.outsideClickHandler.bind(this);
      document.addEventListener('click', handler, { once: true });
      // Also add a backup cleanup
      setTimeout(() => {
        document.removeEventListener('click', handler);
      }, 10000);
    }, 100);
  }

  hidePopup(popup) {
    popup.classList.remove('show');
    if (this.activePopup === popup) {
      this.activePopup = null;
    }
  }

  positionPopup(popup, img) {
    const imgRect = img.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Calculate position (try to place it to the right of the image)
    let left = imgRect.right + scrollLeft + 10;
    let top = imgRect.top + scrollTop;
    
    // If popup would go off screen to the right, place it to the left
    if (left + 250 > window.innerWidth + scrollLeft) {
      left = imgRect.left + scrollLeft - 260;
    }
    
    // If popup would go off screen to the left, center it over the image
    if (left < scrollLeft) {
      left = imgRect.left + scrollLeft + (imgRect.width - 250) / 2;
    }
    
    // Ensure popup doesn't go off screen vertically
    if (top + popup.offsetHeight > window.innerHeight + scrollTop) {
      top = imgRect.bottom + scrollTop - popup.offsetHeight;
    }
    
    popup.style.left = `${Math.max(scrollLeft + 10, left)}px`;
    popup.style.top = `${Math.max(scrollTop + 10, top)}px`;
  }

  outsideClickHandler(e) {
    if (this.activePopup && !this.activePopup.contains(e.target)) {
      // Check if click was on a QR code image
      const clickedImg = e.target.closest('img[data-qr-processed]');
      if (!clickedImg) {
        this.hidePopup(this.activePopup);
      }
    }
  }

  getQRType(data) {
    if (data.startsWith('http://') || data.startsWith('https://')) {
      return 'URL';
    } else if (data.startsWith('mailto:')) {
      return 'Email';
    } else if (data.startsWith('tel:')) {
      return 'Phone';
    } else if (data.startsWith('WIFI:')) {
      return 'WiFi';
    } else if (data.includes('@') && data.includes('.')) {
      return 'Email';
    } else {
      return 'Text';
    }
  }

  isValidURL(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  listenForMessages() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Content script received message:', request.type);
      
      if (request.type === 'START_AREA_SELECTION') {
        console.log('🎯 Starting area selection...');
        this.startAreaSelection();
        sendResponse({ success: true });
      } else if (request.type === 'CROP_AND_ANALYZE_AREA') {
        console.log('✂️ Cropping and analyzing area...');
        this.cropAndAnalyzeArea(request.imageData, request.area, request.deviceInfo, sendResponse);
        return true; // Keep message channel open for async response
      } else if (request.type === 'SHOW_TOAST') {
        this.showToast(request.message, request.toastType);
        sendResponse({ success: true });
      }
    });

    // Handle window resize to reposition active popup
    window.addEventListener('resize', () => {
      if (this.activePopup) {
        const img = document.querySelector(`img[data-qr-popup-id="${this.activePopup.id}"]`);
        if (img) {
          this.positionPopup(this.activePopup, img);
        }
      }
    });

    // Handle scroll to reposition active popup
    window.addEventListener('scroll', () => {
      if (this.activePopup) {
        const img = document.querySelector(`img[data-qr-popup-id="${this.activePopup.id}"]`);
        if (img) {
          this.positionPopup(this.activePopup, img);
        }
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  scanPage() {
    console.log('🔍 Starting comprehensive QR code scan...');
    let foundCount = 0;
    
    // Count existing QR codes
    foundCount += document.querySelectorAll('img[data-qr-processed]').length;
    foundCount += document.querySelectorAll('canvas[data-qr-processed]').length;
    foundCount += document.querySelectorAll('svg[data-qr-processed]').length;
    foundCount += document.querySelectorAll('[data-qr-bg-processed]').length;
    
    // Scan images
    const images = document.querySelectorAll('img');
    console.log(`📸 Scanning ${images.length} images...`);
    images.forEach(img => {
      if (!img.dataset.qrProcessed) {
        this.scanImage(img);
      }
    });
    
    // Scan canvas elements
    const canvases = document.querySelectorAll('canvas');
    console.log(`🎨 Scanning ${canvases.length} canvas elements...`);
    canvases.forEach(canvas => {
      if (!canvas.dataset.qrProcessed) {
        this.scanCanvas(canvas);
      }
    });
    
    // Scan SVG elements
    const svgs = document.querySelectorAll('svg');
    console.log(`📐 Scanning ${svgs.length} SVG elements...`);
    svgs.forEach(svg => {
      if (!svg.dataset.qrProcessed) {
        this.scanSVG(svg);
      }
    });
    
    // Scan background images
    console.log('🖼️ Scanning background images...');
    this.scanBackgroundImages();
    
    // Add retry mechanism for lazy-loaded images
    setTimeout(() => {
      this.retryFailedScans();
    }, 2000);

    console.log(`✅ Scan complete. Found ${foundCount} existing QR codes.`);
    chrome.runtime.sendMessage({
      type: 'SCAN_COMPLETE',
      foundCount: foundCount
    });
  }

  retryFailedScans() {
    console.log('🔄 Retrying failed scans...');
    
    // Retry images that might have loaded
    const unscannedImages = document.querySelectorAll('img:not([data-qr-processed])');
    unscannedImages.forEach(img => {
      if (img.complete && img.naturalWidth > 0) {
        this.scanImage(img);
      }
    });
    
    // Update count
    const totalFound = document.querySelectorAll('[data-qr-processed], [data-qr-bg-processed]').length;
    chrome.runtime.sendMessage({
      type: 'SCAN_COMPLETE',
      foundCount: totalFound
    });
  }

  analyzeScreenCapture(imageDataUrl, sendResponse) {
    console.log('📸 Analyzing screen capture for QR codes...');
    
    try {
      const img = new Image();
      img.onload = () => {
        try {
          // Resize canvas to match the image
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          
          // Draw the captured screen to canvas
          this.ctx.drawImage(img, 0, 0);
          
          // Get image data for QR scanning
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          
          console.log(`📸 Scanning ${this.canvas.width}x${this.canvas.height} screen capture...`);
          
          // Scan for QR codes
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          let foundCount = 0;
          
          if (code) {
            console.log('🎉 QR code found in screen capture:', code.data);
            
            // Create a virtual element to represent the screen capture QR
            const virtualElement = this.createVirtualQRElement(code, img.width, img.height);
            this.handleQRCode(code.data, virtualElement);
            foundCount = 1;
            
            // Also try to find the exact position on the page
            this.tryToLocateQROnPage(code.data);
          } else {
            console.log('📸 No QR codes found in screen capture');
            // Show toast for no QR found
            this.showToast('❌ No QR code detected in screen capture', 'error', 2500);
          }
          
          sendResponse({ 
            success: true, 
            foundCount: foundCount,
            qrData: code ? code.data : null
          });
        } catch (error) {
          console.error('Error analyzing screen capture:', error);
          sendResponse({ success: false, foundCount: 0 });
        }
      };
      
      img.onerror = () => {
        console.error('Failed to load screen capture image');
        sendResponse({ success: false, foundCount: 0 });
      };
      
      img.src = imageDataUrl;
    } catch (error) {
      console.error('Error setting up screen capture analysis:', error);
      sendResponse({ success: false, foundCount: 0 });
    }
  }

  createVirtualQRElement(qrCode, screenWidth, screenHeight) {
    // Create a virtual element to represent the QR code found in screen capture
    const virtualElement = document.createElement('div');
    virtualElement.id = 'screen-capture-qr-' + Date.now();
    virtualElement.dataset.qrProcessed = 'true';
    virtualElement.dataset.isVirtual = 'true';
    virtualElement.dataset.qrData = qrCode.data;
    
    // Position it in the center of the screen as a fallback
    virtualElement.style.position = 'fixed';
    virtualElement.style.top = '50%';
    virtualElement.style.left = '50%';
    virtualElement.style.transform = 'translate(-50%, -50%)';
    virtualElement.style.width = '150px';
    virtualElement.style.height = '150px';
    virtualElement.style.zIndex = '9999';
    virtualElement.style.pointerEvents = 'none';
    virtualElement.style.opacity = '0';
    
    // Add to page temporarily (for popup positioning)
    document.body.appendChild(virtualElement);
    
    // Remove after a delay
    setTimeout(() => {
      if (virtualElement.parentNode) {
        virtualElement.parentNode.removeChild(virtualElement);
      }
    }, 30000); // Remove after 30 seconds
    
    return virtualElement;
  }

  showToast(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  tryToLocateQROnPage(qrData) {
    // Try to find an existing element on the page that might contain this QR code
    console.log('🔍 Trying to locate QR code on page elements...');
    
    // Check all images for matching QR data
    const images = document.querySelectorAll('img');
    for (const img of images) {
      if (!img.dataset.qrProcessed) {
        // Quick scan to see if this image contains the same QR data
        this.quickScanImage(img, qrData);
      }
    }
    
    // Check canvas elements
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      if (!canvas.dataset.qrProcessed) {
        this.quickScanCanvas(canvas, qrData);
      }
    }
  }

  quickScanImage(img, targetData) {
    try {
      if (!img.complete || img.naturalWidth === 0) return;
      
      this.canvas.width = img.naturalWidth;
      this.canvas.height = img.naturalHeight;
      this.ctx.drawImage(img, 0, 0);
      
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data === targetData) {
        console.log('✅ Found matching QR code in page element!');
        this.handleQRCode(code.data, img);
      }
    } catch (error) {
      // Ignore errors in quick scan
    }
  }

  quickScanCanvas(canvas, targetData) {
    try {
      const context = canvas.getContext('2d');
      if (!context) return;
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data === targetData) {
        console.log('✅ Found matching QR code in canvas element!');
        this.handleQRCode(code.data, canvas);
      }
    } catch (error) {
      // Ignore errors in quick scan
    }
  }

  startAreaSelection() {
    console.log('🎯 Starting area selection mode...');
    
    // Remove any existing overlay
    this.cancelAreaSelection();
    
    // Show immediate feedback
    this.showToast('🎯 Area selection mode activated', 'info', 1500);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'area-selection-overlay';
    
    // Create instructions
    const instructions = document.createElement('div');
    instructions.className = 'selection-instructions';
    instructions.textContent = '🎯 Click and drag to select area containing QR code';
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'selection-cancel';
    cancelBtn.textContent = '✕ Cancel';
    cancelBtn.onclick = () => this.cancelAreaSelection();
    
    // Add to page
    document.body.appendChild(overlay);
    document.body.appendChild(instructions);
    document.body.appendChild(cancelBtn);
    
    // Set up selection logic
    this.areaSelection = {
      overlay: overlay,
      instructions: instructions,
      cancelBtn: cancelBtn,
      isSelecting: false,
      startX: 0,
      startY: 0,
      selectionBox: null
    };
    
    // Mouse events
    overlay.addEventListener('mousedown', this.startSelection.bind(this));
    overlay.addEventListener('mousemove', this.updateSelection.bind(this));
    overlay.addEventListener('mouseup', this.endSelection.bind(this));
    
    // Touch events for mobile
    overlay.addEventListener('touchstart', this.handleTouch.bind(this));
    overlay.addEventListener('touchmove', this.handleTouch.bind(this));
    overlay.addEventListener('touchend', this.handleTouch.bind(this));
    
    // Escape key to cancel
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.cancelAreaSelection();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  startSelection(e) {
    if (!this.areaSelection) return;
    
    this.areaSelection.isSelecting = true;
    this.areaSelection.startX = e.clientX;
    this.areaSelection.startY = e.clientY;
    
    // Create selection box
    const selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.left = e.clientX + 'px';
    selectionBox.style.top = e.clientY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    
    this.areaSelection.overlay.appendChild(selectionBox);
    this.areaSelection.selectionBox = selectionBox;
    
    // Update instructions
    this.areaSelection.instructions.textContent = '🎯 Drag to select area, release to scan';
  }

  updateSelection(e) {
    if (!this.areaSelection || !this.areaSelection.isSelecting || !this.areaSelection.selectionBox) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    const startX = this.areaSelection.startX;
    const startY = this.areaSelection.startY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    this.areaSelection.selectionBox.style.left = left + 'px';
    this.areaSelection.selectionBox.style.top = top + 'px';
    this.areaSelection.selectionBox.style.width = width + 'px';
    this.areaSelection.selectionBox.style.height = height + 'px';
  }

  endSelection(e) {
    if (!this.areaSelection || !this.areaSelection.isSelecting || !this.areaSelection.selectionBox) return;
    
    this.areaSelection.isSelecting = false;
    
    // Get selection bounds
    const rect = this.areaSelection.selectionBox.getBoundingClientRect();
    const selection = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
    
    console.log('🎯 Area selected:', selection);
    
    // Minimum size check
    if (selection.width < 20 || selection.height < 20) {
      console.log('❌ Selection too small:', selection);
      this.showToast('❌ Selection too small. Try selecting a larger area.', 'error', 2500);
      
      // Cancel current selection and clean up
      this.cancelAreaSelection();
      
      // Start a new selection after a short delay
      setTimeout(() => {
        this.startAreaSelection();
      }, 100);
      
      return;
    }
    
    // Update instructions
    this.areaSelection.instructions.textContent = '📸 Capturing selected area...';
    this.areaSelection.instructions.style.background = '#4CAF50';
    
    // Send area selection to background for capture
    console.log('🎯 Sending area for capture:', selection);
    console.log('📸 Starting screen capture and QR analysis for selected area...');
    
    // Include device pixel ratio and window size for better coordinate handling
    const deviceInfo = {
      devicePixelRatio: window.devicePixelRatio || 1,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    };
    console.log('📱 Device info:', deviceInfo);
    
    chrome.runtime.sendMessage({
      type: 'AREA_CAPTURE_SCAN',
      area: selection,
      deviceInfo: deviceInfo
    }, (response) => {
      console.log('🎯 Area capture response:', response);
      if (chrome.runtime.lastError) {
        console.error('❌ Area capture error:', chrome.runtime.lastError);
        this.showToast('❌ Failed to capture area', 'error');
      } else if (response && response.success) {
        console.log(`✅ Area scan completed! Found ${response.foundCount} QR code(s)`);
        if (response.qrData) {
          console.log('🎉 QR Code content:', response.qrData);
        }
      }
    });
    
    // Clean up after short delay
    setTimeout(() => {
      this.cancelAreaSelection();
    }, 1000);
  }

  handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0] || e.changedTouches[0];
    const mouseEvent = new MouseEvent(e.type.replace('touch', 'mouse'), {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
      cancelable: true
    });
    e.target.dispatchEvent(mouseEvent);
  }

  cancelAreaSelection() {
    if (!this.areaSelection) return;
    
    console.log('❌ Cancelling area selection');
    
    // Remove elements
    if (this.areaSelection.overlay) this.areaSelection.overlay.remove();
    if (this.areaSelection.instructions) this.areaSelection.instructions.remove();
    if (this.areaSelection.cancelBtn) this.areaSelection.cancelBtn.remove();
    
    // Remove event listener
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    
    this.areaSelection = null;
  }

  analyzeAreaCapture(imageDataUrl, area, sendResponse) {
    console.log('🎯 Analyzing area capture for QR codes...', area);
    
    try {
      const img = new Image();
      img.onload = () => {
        try {
          console.log('📸 Image loaded for analysis, size:', img.width, 'x', img.height);
          
          // Set canvas to match the image size
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          
          // Draw the captured area to canvas
          this.ctx.drawImage(img, 0, 0);
          
          // Get image data for QR scanning
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          
          console.log(`🎯 Scanning ${this.canvas.width}x${this.canvas.height} selected area...`);
          
          // Scan for QR codes with enhanced options
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth"
          });
          
          let foundCount = 0;
          
          if (code) {
            console.log('🎉 QR code found in selected area:', code.data);
            
            // Show success toast immediately
            this.showToast('✅ QR code detected!', 'success', 2000);
            
            // Create a virtual element positioned at the selected area
            const virtualElement = this.createAreaQRElement(code, area);
            this.handleQRCode(code.data, virtualElement);
            foundCount = 1;
            
            // Show popup immediately with QR content
            setTimeout(() => {
              const popup = this.createPopup(code.data, virtualElement);
              this.showPopup(popup, virtualElement);
              console.log('🎯 Popup displayed with QR content:', code.data.substring(0, 50) + '...');
            }, 800); // Shorter delay for faster feedback
            
          } else {
            console.log('🎯 No QR codes found in selected area');
            // Show toast for no QR found
            this.showToast('❌ No QR code detected in selected area', 'error', 3000);
          }
          
          sendResponse({ 
            success: true, 
            foundCount: foundCount,
            qrData: code ? code.data : null
          });
        } catch (error) {
          console.error('❌ Error analyzing area capture:', error);
          this.showToast('❌ Error analyzing captured area', 'error');
          sendResponse({ success: false, foundCount: 0 });
        }
      };
      
      img.onerror = () => {
        console.error('❌ Failed to load area capture image');
        this.showToast('❌ Failed to load captured image', 'error');
        sendResponse({ success: false, foundCount: 0 });
      };
      
      img.src = imageDataUrl;
    } catch (error) {
      console.error('❌ Error setting up area capture analysis:', error);
      this.showToast('❌ Error setting up analysis', 'error');
      sendResponse({ success: false, foundCount: 0 });
    }
  }

  createAreaQRElement(qrCode, area) {
    console.log('🎯 Creating virtual element for area QR at:', area);
    
    // Create a virtual element positioned at the selected area
    const virtualElement = document.createElement('div');
    virtualElement.id = 'area-capture-qr-' + Date.now();
    virtualElement.dataset.qrProcessed = 'true';
    virtualElement.dataset.isVirtual = 'true';
    virtualElement.dataset.qrData = qrCode.data;
    
    // Position it at the selected area (use absolute positioning for better popup placement)
    virtualElement.style.position = 'absolute';
    virtualElement.style.left = area.x + 'px';
    virtualElement.style.top = (area.y + window.scrollY) + 'px';
    virtualElement.style.width = area.width + 'px';
    virtualElement.style.height = area.height + 'px';
    virtualElement.style.zIndex = '9999';
    virtualElement.style.pointerEvents = 'none';
    virtualElement.style.opacity = '0';
    
    // Add a small visual indicator (for debugging)
    virtualElement.style.border = '2px solid #4CAF50';
    virtualElement.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
    
    console.log('🎯 Virtual element positioned at:', {
      left: virtualElement.style.left,
      top: virtualElement.style.top,
      width: virtualElement.style.width,
      height: virtualElement.style.height
    });
    
    // Add to page temporarily (for popup positioning)
    document.body.appendChild(virtualElement);
    
    // Remove after a delay
    setTimeout(() => {
      if (virtualElement.parentNode) {
        virtualElement.parentNode.removeChild(virtualElement);
        console.log('🎯 Virtual element cleaned up');
      }
    }, 30000); // Remove after 30 seconds
    
    return virtualElement;
  }

  cropAndAnalyzeArea(imageDataUrl, area, deviceInfo, sendResponse) {
    console.log('✂️ Starting crop and analysis...', { area, deviceInfo });
    
    try {
      const img = new Image();
      img.onload = () => {
        try {
          console.log('🖼️ Screenshot loaded, size:', img.width, 'x', img.height);
          
          // Apply device pixel ratio scaling if available
          let scaledArea = area;
          if (deviceInfo && deviceInfo.devicePixelRatio > 1) {
            console.log('📱 Applying device pixel ratio scaling:', deviceInfo.devicePixelRatio);
            scaledArea = {
              x: Math.round(area.x * deviceInfo.devicePixelRatio),
              y: Math.round(area.y * deviceInfo.devicePixelRatio),
              width: Math.round(area.width * deviceInfo.devicePixelRatio),
              height: Math.round(area.height * deviceInfo.devicePixelRatio)
            };
            console.log('🔧 Scaled area:', scaledArea);
          }
          
          // Validate crop coordinates
          if (scaledArea.x < 0 || scaledArea.y < 0 || 
              scaledArea.x + scaledArea.width > img.width || 
              scaledArea.y + scaledArea.height > img.height) {
            console.error('❌ Crop coordinates out of bounds:', {
              originalArea: area,
              scaledArea: scaledArea,
              imageSize: { width: img.width, height: img.height }
            });
            
            // Try to fix the coordinates
            console.log('🔧 Attempting to fix coordinates...');
            scaledArea = {
              x: Math.max(0, Math.min(scaledArea.x, img.width - 1)),
              y: Math.max(0, Math.min(scaledArea.y, img.height - 1)),
              width: Math.min(scaledArea.width, img.width - Math.max(0, scaledArea.x)),
              height: Math.min(scaledArea.height, img.height - Math.max(0, scaledArea.y))
            };
            
            if (scaledArea.width < 10 || scaledArea.height < 10) {
              console.error('❌ Area too small after fixing:', scaledArea);
              this.showToast('❌ Selected area is too small', 'error');
              sendResponse({ success: false, message: 'Area too small' });
              return;
            }
            
            console.log('✅ Using fixed coordinates:', scaledArea);
          }
          
          // Create a canvas for cropping
          const cropCanvas = document.createElement('canvas');
          const cropCtx = cropCanvas.getContext('2d');
          
          // Set canvas size to match the original (unscaled) selection size
          cropCanvas.width = area.width;
          cropCanvas.height = area.height;
          
          console.log('✂️ Cropping image...');
          
          // Draw the cropped portion
          cropCtx.drawImage(
            img,
            scaledArea.x,
            scaledArea.y,
            scaledArea.width,
            scaledArea.height,
            0,
            0,
            area.width,
            area.height
          );
          
          // Get the cropped image data for QR scanning
          const imageData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
          
          console.log('🔍 Scanning cropped area for QR codes...');
          
          // Scan for QR codes with enhanced options
          const codes = this.findAllQRCodes(imageData);
          
          if (codes.length > 0) {
            console.log(`🎉 Found ${codes.length} QR code(s):`, codes);
            
            if (codes.length === 1) {
              // Single QR code - trigger it directly
              this.showToast('✅ QR code detected!', 'success', 2000);
              this.handleQRCode(codes[0].data);
            } else {
              // Multiple QR codes - show selection popup
              this.showQRCodeSelectionPopup(codes, area);
            }
            
            sendResponse({
              success: true,
              foundCount: codes.length,
              qrData: codes.map(code => code.data)
            });
          } else {
            console.log('❌ No QR code found in cropped area');
            this.showToast('❌ No QR code detected in selected area', 'error', 3000);
            sendResponse({
              success: true,
              foundCount: 0,
              qrData: null
            });
          }
        } catch (error) {
          console.error('❌ Error processing cropped area:', error);
          this.showToast('❌ Error analyzing selected area', 'error');
          sendResponse({ success: false, message: 'Processing error' });
        }
      };
      
      img.onerror = () => {
        console.error('❌ Failed to load screenshot');
        this.showToast('❌ Failed to load screenshot', 'error');
        sendResponse({ success: false, message: 'Image load failed' });
      };
      
      img.src = imageDataUrl;
    } catch (error) {
      console.error('❌ Error in crop and analyze:', error);
      this.showToast('❌ Error processing selected area', 'error');
      sendResponse({ success: false, message: 'Processing error' });
    }
  }

  findAllQRCodes(imageData) {
    const codes = [];
    const maskedData = new Uint8ClampedArray(imageData.data);
    
    // Function to mask out a found QR code
    const maskQRCode = (code) => {
      // Get the QR code location points
      const topLeft = code.location.topLeftCorner;
      const topRight = code.location.topRightCorner;
      const bottomLeft = code.location.bottomLeftCorner;
      const bottomRight = code.location.bottomRightCorner;
      
      // Calculate bounding box with padding
      const padding = 10;
      const left = Math.max(0, Math.min(topLeft.x, bottomLeft.x) - padding);
      const right = Math.min(imageData.width, Math.max(topRight.x, bottomRight.x) + padding);
      const top = Math.max(0, Math.min(topLeft.y, topRight.y) - padding);
      const bottom = Math.min(imageData.height, Math.max(bottomLeft.y, bottomRight.y) + padding);
      
      // Fill the area with white
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const idx = (y * imageData.width + x) * 4;
          maskedData[idx] = 255;     // R
          maskedData[idx + 1] = 255; // G
          maskedData[idx + 2] = 255; // B
        }
      }
      
      console.log(`🎯 Masked out QR code at (${left},${top}) to (${right},${bottom})`);
    };
    
    // Function to scan with different thresholds
    const scanWithThreshold = (data, threshold = undefined) => {
      let scanData;
      
      if (threshold === undefined) {
        scanData = data;
      } else {
        scanData = new Uint8ClampedArray(data);
        for (let i = 0; i < scanData.length; i += 4) {
          const avg = (scanData[i] + scanData[i + 1] + scanData[i + 2]) / 3;
          const value = avg > threshold * 255 ? 255 : 0;
          scanData[i] = scanData[i + 1] = scanData[i + 2] = value;
        }
      }
      
      const code = jsQR(scanData, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth"
      });
      
      if (code && !codes.some(existing => existing.data === code.data)) {
        console.log(`🎯 Found new QR code${threshold ? ` with threshold ${threshold}` : ''}: ${code.data}`);
        codes.push(code);
        maskQRCode(code);
        return true;
      }
      
      return false;
    };
    
    // Keep scanning until no more QR codes are found
    let foundNew;
    const thresholds = [undefined, 0.3, 0.5, 0.7];
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops
    
    do {
      foundNew = false;
      attempts++;
      
      // Try each threshold
      for (const threshold of thresholds) {
        if (scanWithThreshold(maskedData, threshold)) {
          foundNew = true;
          break; // Found a new code, start over with masked image
        }
      }
      
      // Try inverted image if no codes found with normal thresholds
      if (!foundNew) {
        const invertedData = new Uint8ClampedArray(maskedData);
        for (let i = 0; i < invertedData.length; i += 4) {
          invertedData[i] = 255 - invertedData[i];
          invertedData[i + 1] = 255 - invertedData[i + 1];
          invertedData[i + 2] = 255 - invertedData[i + 2];
        }
        
        if (scanWithThreshold(invertedData)) {
          foundNew = true;
        }
      }
    } while (foundNew && attempts < maxAttempts);
    
    console.log(`✅ Found ${codes.length} unique QR codes in ${attempts} attempts`);
    return codes;
  }

  showQRCodeSelectionPopup(codes, area) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'qr-selection-popup';
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      padding: 24px;
      max-width: 400px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: qrPopupFadeIn 0.2s ease-out;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes qrPopupFadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    // Add title
    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: #333;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    `;
    title.textContent = `📱 Select QR Code (${codes.length} found)`;
    popup.appendChild(title);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: #666;
      padding: 4px;
      border-radius: 4px;
    `;
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => {
      overlay.remove();
      style.remove();
    };
    popup.appendChild(closeBtn);

    // Create list container
    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    `;

    // Add QR code options
    codes.forEach((code, index) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #eee;
      `;
      
      const type = this.getQRType(code.data);
      const displayData = code.data.length > 30 ? code.data.substring(0, 30) + '...' : code.data;
      
      item.innerHTML = `
        <div style="font-size: 13px; color: #333; margin-bottom: 4px;">${displayData}</div>
        <div style="font-size: 11px; color: #666; background: #fff; padding: 2px 6px; border-radius: 3px; display: inline-block;">${type}</div>
      `;

      item.onmouseover = () => {
        item.style.background = '#f0f0f0';
        item.style.borderColor = '#ddd';
      };
      item.onmouseout = () => {
        item.style.background = '#f8f9fa';
        item.style.borderColor = '#eee';
      };
      
      item.onclick = () => {
        this.handleQRCode(code.data);
        overlay.remove();
        style.remove();
        // Close any existing popups
        if (this.activePopup) {
          this.hidePopup(this.activePopup);
        }
      };

      list.appendChild(item);
    });

    popup.appendChild(list);
    document.body.appendChild(popup);

    // Add popup to overlay
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add click outside handler
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        style.remove();
      }
    });
  }

  cleanup() {
    // Remove all QR popups
    const popups = document.querySelectorAll('.qr-popup');
    popups.forEach(popup => popup.remove());
    this.activePopup = null;
    
    // Clear processing flags for potential re-scanning
    document.querySelectorAll('[data-qr-processed]').forEach(el => {
      delete el.dataset.qrProcessed;
    });
    document.querySelectorAll('[data-qr-bg-processed]').forEach(el => {
      delete el.dataset.qrBgProcessed;
    });
  }

  // Add lazy loading detection
  setupLazyLoadingDetection() {
    // Use Intersection Observer to detect when images come into view
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.tagName === 'IMG' && !img.dataset.qrProcessed) {
              // Wait a bit for the image to load
              setTimeout(() => {
                if (img.complete && img.naturalWidth > 0) {
                  this.scanImage(img);
                }
              }, 500);
            }
          }
        });
      });
      
      // Observe all images
      document.querySelectorAll('img').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }
}

// Initialize scanner when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new QRScanner());
} else {
  new QRScanner();
} 