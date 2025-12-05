// Tab Manager - Handles multi-tab, multi-session functionality

class TabManager {
  constructor() {
    this.tabs = new Map(); // tabId -> { sessionId, fileManagerState, transferManagerState }
    this.activeTabId = null;
    this.tabIdCounter = 0;
    
    this.tabList = null;
    this.newTabBtn = null;
    this.initialized = false;
  }
  
  init() {
    if (this.initialized) return;
    
    this.tabList = document.getElementById("tabList");
    this.newTabBtn = document.getElementById("newTabBtn");
    
    if (!this.tabList || !this.newTabBtn) {
      console.error("Tab elements not found");
      return;
    }
    
    this.initEventListeners();
    this.initialized = true;
  }
  
  initEventListeners() {
    this.newTabBtn.addEventListener("click", () => {
      this.showNewConnectionModal();
    });
    
    // Listen for session disconnected events
    window.api.onSessionDisconnected((data) => {
      this.handleSessionDisconnected(data.sessionId);
    });
  }
  
  // Create a new tab with a session
  createTab(sessionId, connectionInfo) {
    const tabId = ++this.tabIdCounter;
    
    const tabState = {
      sessionId,
      connectionInfo,
      fileManagerState: {
        currentPath: connectionInfo.homePath || "/",
        history: [connectionInfo.homePath || "/"],
        historyIndex: 0,
        files: [],
        sessionId,
        connectionInfo
      },
      transferManagerState: {
        transfers: new Map()
      },
      selectedFiles: new Set()
    };
    
    this.tabs.set(tabId, tabState);
    this.renderTab(tabId, connectionInfo);
    this.switchToTab(tabId);
    
    return tabId;
  }
  
  // Render a tab element
  renderTab(tabId, connectionInfo) {
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.tabId = tabId;
    
    const label = connectionInfo.username + "@" + connectionInfo.host;
    
    tab.innerHTML = `
      <div class="tab-icon">
        <svg viewBox="0 0 24 24">
          <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z"/>
        </svg>
      </div>
      <span class="tab-label" title="${label}">${label}</span>
      <button class="tab-close" title="Close Tab">
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;
    
    // Tab click to switch
    tab.addEventListener("click", (e) => {
      if (!e.target.closest(".tab-close")) {
        this.switchToTab(tabId);
      }
    });
    
    // Close button
    tab.querySelector(".tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeTab(tabId);
    });
    
    this.tabList.appendChild(tab);
  }
  
  // Switch to a tab
  switchToTab(tabId) {
    if (!this.tabs.has(tabId)) return;
    
    // Save current tab state before switching
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      // State will be saved via saveActiveTabState call
    }
    
    // Update active state in UI
    document.querySelectorAll(".tab").forEach(tab => {
      tab.classList.remove("active");
      if (parseInt(tab.dataset.tabId) === tabId) {
        tab.classList.add("active");
      }
    });
    
    this.activeTabId = tabId;
    
    // Emit event for main-browser.js to handle
    const event = new CustomEvent("tabChanged", { 
      detail: { tabId, state: this.tabs.get(tabId) }
    });
    document.dispatchEvent(event);
  }
  
  // Close a tab
  closeTab(tabId) {
    const tabState = this.tabs.get(tabId);
    if (!tabState) return;
    
    // Disconnect the session
    window.api.disconnect(tabState.sessionId);
    
    // Remove tab from DOM
    const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabEl) {
      tabEl.remove();
    }
    
    // Remove from map
    this.tabs.delete(tabId);
    
    // If this was the active tab, switch to another
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.switchToTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        // No tabs left, go back to connect page
        this.activeTabId = null;
        window.api.disconnect(); // This will navigate to connect page
      }
    }
  }
  
  // Handle session disconnected from backend
  handleSessionDisconnected(sessionId) {
    for (const [tabId, state] of this.tabs) {
      if (state.sessionId === sessionId) {
        const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tabEl) {
          tabEl.classList.add("disconnected");
        }
      }
    }
  }
  
  // Get active tab state
  getActiveTabState() {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId);
  }
  
  // Save active tab state
  saveActiveTabState(fileManagerState, transferManagerState, selectedFiles) {
    if (!this.activeTabId) return;
    const state = this.tabs.get(this.activeTabId);
    if (state) {
      state.fileManagerState = fileManagerState;
      state.transferManagerState = transferManagerState;
      state.selectedFiles = selectedFiles;
    }
  }
  
  // Update active tab state partially
  updateActiveTabState(updates) {
    if (!this.activeTabId) return;
    const state = this.tabs.get(this.activeTabId);
    if (state) {
      Object.assign(state, updates);
    }
  }
  
  // Show new connection modal
  showNewConnectionModal() {
    const modal = document.getElementById("newConnectionModal");
    if (modal) {
      modal.classList.add("show");
      
      // Focus on host input
      const hostInput = document.getElementById("newConnHost");
      if (hostInput) {
        hostInput.focus();
      }
    }
  }
  
  // Hide new connection modal
  hideNewConnectionModal() {
    const modal = document.getElementById("newConnectionModal");
    if (modal) {
      modal.classList.remove("show");
    }
  }
  
  // Initialize from existing sessions
  async initFromSessions() {
    const sessions = await window.api.getAllSessions();
    
    if (sessions.length === 0) {
      // Show the new connection modal if no sessions
      this.showNewConnectionModal();
      return false;
    }
    
    // Create tabs for existing sessions
    for (const session of sessions) {
      this.createTab(session.sessionId, session);
    }
    
    return true;
  }
  
  // Get tab count
  getTabCount() {
    return this.tabs.size;
  }
  
  // Get active tab ID
  getActiveTabId() {
    return this.activeTabId;
  }
}

// Export singleton
export const tabManager = new TabManager();
