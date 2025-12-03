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
  navigateToBrowser: (homePath) => {
    ipcRenderer.send("navigate-to-browser", homePath);
  },
  
  // List directory
  listDirectory: (path) => {
    ipcRenderer.send("list-directory", path);
  },
  onListResult: (callback) => {
    ipcRenderer.on("list-result", (event, data) => {
      callback(data);
    });
  },
  
  // Disconnect
  disconnect: () => {
    ipcRenderer.send("disconnect");
  },
  
  // Get connection info
  getConnectionInfo: () => {
    return ipcRenderer.invoke("get-connection-info");
  },
  
  // Select files to upload
  selectFilesToUpload: () => {
    return ipcRenderer.invoke("select-files-to-upload");
  },
  
  // Upload file
  uploadFile: (config) => {
    ipcRenderer.send("upload-file", config);
  },
  
  // Download file
  downloadFile: (config) => {
    ipcRenderer.send("download-file", config);
  },
  
  // Select download folder
  selectDownloadFolder: () => {
    return ipcRenderer.invoke("select-download-folder");
  },
  
  // Cancel transfer
  cancelTransfer: (transferId) => {
    ipcRenderer.send("cancel-transfer", transferId);
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
  
  // Create folder
  createFolder: (folderPath) => {
    return ipcRenderer.invoke("create-folder", folderPath);
  },
  
  // Create file
  createFile: (filePath) => {
    return ipcRenderer.invoke("create-file", filePath);
  },
  
  // Delete items
  deleteItems: (paths) => {
    return ipcRenderer.invoke("delete-items", paths);
  }
});
