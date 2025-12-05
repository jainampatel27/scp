// file-manager.js - Handles file navigation and listing

class FileManager {
  constructor() {
    this.currentPath = "/";
    this.files = [];
    this.history = ["/"];
    this.historyIndex = 0;
    this.sessionId = null;
    this.connectionInfo = null;
  }

  // Set session ID
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  // Get session ID
  getSessionId() {
    return this.sessionId;
  }

  // Set connection info
  setConnectionInfo(info) {
    this.connectionInfo = info;
  }

  // Get connection info
  getConnectionInfo() {
    return this.connectionInfo;
  }

  // Navigate to a path
  navigateTo(path) {
    // Normalize path
    path = path.replace(/\/+/g, "/");
    if (path !== "/" && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    this.currentPath = path;

    // Update history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(path);
    this.historyIndex = this.history.length - 1;

    return path;
  }

  // Go back in history
  goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentPath = this.history[this.historyIndex];
      return this.currentPath;
    }
    return null;
  }

  // Go forward in history
  goForward() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.currentPath = this.history[this.historyIndex];
      return this.currentPath;
    }
    return null;
  }

  // Go up one directory
  goUp() {
    if (this.currentPath !== "/") {
      const parentPath = this.currentPath.split("/").slice(0, -1).join("/") || "/";
      return this.navigateTo(parentPath);
    }
    return null;
  }

  // Load directory contents
  loadDirectory(path) {
    this.files = []; // Clear current files
    window.api.listDirectory({ path, sessionId: this.sessionId });
  }

  // Set files data
  setFiles(files) {
    this.files = files;
  }

  // Get current path
  getCurrentPath() {
    return this.currentPath;
  }

  // Get files
  getFiles() {
    return this.files;
  }

  // Check if can go back/forward/up
  canGoBack() {
    return this.historyIndex > 0;
  }

  canGoForward() {
    return this.historyIndex < this.history.length - 1;
  }

  canGoUp() {
    return this.currentPath !== "/";
  }

  // Get file by name
  getFileByName(name) {
    return this.files.find(file => file.name === name);
  }

  // Get full path for file
  getFullPath(name) {
    return this.currentPath === "/" ? `/${name}` : `${this.currentPath}/${name}`;
  }

  // Get state for tab saving
  getState() {
    return {
      currentPath: this.currentPath,
      files: [...this.files],
      history: [...this.history],
      historyIndex: this.historyIndex,
      sessionId: this.sessionId,
      connectionInfo: this.connectionInfo
    };
  }

  // Restore state from tab
  restoreState(state) {
    if (!state) return;
    this.currentPath = state.currentPath || "/";
    this.files = state.files || [];
    this.history = state.history || ["/"];
    this.historyIndex = state.historyIndex || 0;
    this.sessionId = state.sessionId;
    this.connectionInfo = state.connectionInfo;
  }
}

export default FileManager;