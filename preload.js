const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Check if server is reachable (TCP connectivity check)
  checkConnectivity: (config) => {
    ipcRenderer.send("check-connectivity", config);
  },
  onConnectivityResult: (callback) => {
    ipcRenderer.on("connectivity-result", (event, data) => {
      callback(data);
    });
  },
  
  // SFTP connect and list files
  sftpConnectAndList: (config) => {
    ipcRenderer.send("sftp-connect-and-list", config);
  },
  onSftpListResult: (callback) => {
    ipcRenderer.on("sftp-list-result", (event, data) => {
      callback(data);
    });
  },
  
  // Navigate to file browser
  navigateToBrowser: (data) => {
    ipcRenderer.send("navigate-to-browser", data);
  },
  
  // List directory (with session support)
  listDirectory: (pathOrData) => {
    const data = typeof pathOrData === 'object' ? pathOrData : { path: pathOrData };
    ipcRenderer.send("list-directory", data);
  },
  onListResult: (callback) => {
    ipcRenderer.on("list-result", (event, data) => {
      callback(data);
    });
  },
  
  // Disconnect (with optional session ID)
  disconnect: (sessionId) => {
    ipcRenderer.send("disconnect", sessionId);
  },
  onSessionDisconnected: (callback) => {
    ipcRenderer.on("session-disconnected", (event, data) => {
      callback(data);
    });
  },
  
  // Get connection info (with optional session ID)
  getConnectionInfo: (sessionId) => {
    return ipcRenderer.invoke("get-connection-info", sessionId);
  },
  
  // Get all sessions
  getAllSessions: () => {
    return ipcRenderer.invoke("get-all-sessions");
  },
  
  // Select files to upload
  selectFilesToUpload: () => {
    return ipcRenderer.invoke("select-files-to-upload");
  },
  
  // Upload file (with session support)
  uploadFile: (config) => {
    ipcRenderer.send("upload-file", config);
  },
  
  // Download file (with session support)
  downloadFile: (config) => {
    ipcRenderer.send("download-file", config);
  },
  
  // Select download folder
  selectDownloadFolder: () => {
    return ipcRenderer.invoke("select-download-folder");
  },
  
  // Cancel transfer (with session support)
  cancelTransfer: (data) => {
    ipcRenderer.send("cancel-transfer", data);
  },
  
  // Transfer events
  onTransferProgress: (callback) => {
    ipcRenderer.on("transfer-progress", (event, data) => {
      callback(data);
    });
  },
  onTransferComplete: (callback) => {
    ipcRenderer.on("transfer-complete", (event, data) => {
      callback(data);
    });
  },
  onTransferError: (callback) => {
    ipcRenderer.on("transfer-error", (event, data) => {
      callback(data);
    });
  },
  
  // Create folder (with session support)
  createFolder: (pathOrData) => {
    const data = typeof pathOrData === 'object' ? pathOrData : { path: pathOrData };
    return ipcRenderer.invoke("create-folder", data);
  },
  
  // Create file (with session support)
  createFile: (pathOrData) => {
    const data = typeof pathOrData === 'object' ? pathOrData : { path: pathOrData };
    return ipcRenderer.invoke("create-file", data);
  },
  
  // Delete items (with session support)
  deleteItems: (pathsOrData) => {
    const data = Array.isArray(pathsOrData) ? { paths: pathsOrData } : pathsOrData;
    return ipcRenderer.invoke("delete-items", data);
  },

  // Read file content (with session support)
  readFile: (pathOrData) => {
    const data = typeof pathOrData === 'object' ? pathOrData : { path: pathOrData };
    return ipcRenderer.invoke("read-file", data);
  },

  // Write file content (with session support)
  writeFile: (pathOrData, content) => {
    const data = typeof pathOrData === 'object' ? pathOrData : { path: pathOrData, content };
    return ipcRenderer.invoke("write-file", data);
  },

  // Open file in new editor window
  openFileInEditor: (fileInfo) => {
    ipcRenderer.send("open-file-in-editor", fileInfo);
  },

  // Get editor file info (for editor window)
  getEditorFileInfo: () => {
    return ipcRenderer.invoke("get-editor-file-info");
  }
});
