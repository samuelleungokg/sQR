// Popup script for QR scanner extension
class QRPopup {
  constructor() {
    this.areaScanBtn = document.getElementById('areaScanBtn');
    this.status = document.getElementById('status');
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.areaScanBtn.addEventListener('click', () => this.selectAreaScan());
  }

  async selectAreaScan() {
    this.setScanningState('Starting area selection...');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script BEFORE closing popup
      chrome.tabs.sendMessage(tab.id, { type: 'START_AREA_SELECTION' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Could not start area selection:', chrome.runtime.lastError);
          this.showError('Could not start area selection. Make sure you\'re on a web page.');
          this.resetScanningState();
        } else {
          console.log('✅ Area selection started successfully');
          // Close popup after successful message
          window.close();
        }
      });
    } catch (error) {
      this.showError('Error starting area selection');
      this.resetScanningState();
    }
  }

  setScanningState(message = 'Starting...') {
    this.areaScanBtn.disabled = true;
    this.areaScanBtn.innerHTML = `<div class="loading"><div class="spinner"></div>${message}</div>`;
    this.status.className = 'status';
    this.status.innerHTML = `<p>${message}</p>`;
  }

  resetScanningState() {
    this.areaScanBtn.disabled = false;
    this.areaScanBtn.innerHTML = '<span>🎯</span><span>Select Area to Scan</span>';
  }

  showError(message) {
    this.status.className = 'status error';
    this.status.innerHTML = `<p>${message}</p>`;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Tab Switching
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');

      // Load history if history tab is selected
      if (tab.dataset.tab === 'history') {
        loadHistory();
      }
    });
  });

  // History Management
  function loadHistory() {
    chrome.storage.local.get(['qrHistory'], (result) => {
      const history = result.qrHistory || [];
      const historyList = document.getElementById('history-list');
      
      if (history.length === 0) {
        historyList.innerHTML = `
          <div class="history-item">
            <div class="content">No scan history yet</div>
          </div>
        `;
        return;
      }

      historyList.innerHTML = history.map(item => `
        <div class="history-item" data-content="${encodeURIComponent(item.content)}" data-type="${item.type}">
          <span class="type ${item.type}">${item.type}</span>
          <div class="content">${item.content}</div>
          <div class="timestamp">${new Date(item.timestamp).toLocaleString()}</div>
        </div>
      `).join('');

      // Add click handlers for copying
      document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', async () => {
          const content = decodeURIComponent(item.dataset.content);
          const type = item.dataset.type.toLowerCase();
          
          try {
            // Copy to clipboard
            await navigator.clipboard.writeText(content);
            
            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              // Only show toast for text items
              if (type === 'text') {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'SHOW_TOAST',
                  message: '✅ Copied to clipboard!',
                  toastType: 'success'
                });
              }

              // Handle special types
              if (type === 'url') {
                chrome.runtime.sendMessage({
                  type: 'OPEN_QR_URL',
                  data: content
                });
              } else if (type === 'email') {
                window.open(content.startsWith('mailto:') ? content : `mailto:${content}`);
              } else if (type === 'phone') {
                window.open(content.startsWith('tel:') ? content : `tel:${content}`);
              }
            }
          } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            if (tab) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'SHOW_TOAST',
                message: '❌ Failed to copy to clipboard',
                toastType: 'error'
              });
            }
          }
        });
      });
    });
  }

  // Area Selection Button
  const areaScanBtn = document.getElementById('areaScanBtn');
  areaScanBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startAreaSelection' });
    // Close the popup window
    window.close();
  });

  // Listen for scan results
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'qrFound') {
      const { content, type } = message;
      
      // Save to history
      chrome.storage.local.get(['qrHistory'], (result) => {
        const history = result.qrHistory || [];
        history.unshift({
          content,
          type,
          timestamp: Date.now()
        });
        
        // Keep only last 50 items
        if (history.length > 50) {
          history.pop();
        }
        
        chrome.storage.local.set({ qrHistory: history });
      });

      // Handle the result based on type
      handleQRContent(content, type);
    }
  });

  function handleQRContent(content, type) {
    // Copy to clipboard
    navigator.clipboard.writeText(content);

    // Show result based on type
    const results = document.getElementById('results');
    results.innerHTML = `
      <div class="history-item">
        <span class="type ${type}">${type}</span>
        <div class="content">${content}</div>
      </div>
    `;

    // Show status message
    const status = document.getElementById('status');
    status.innerHTML = '<p>✅ QR code scanned and copied to clipboard!</p>';
  }
}); 