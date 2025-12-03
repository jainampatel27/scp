const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");
const Client = require("ssh2-sftp-client");

let mainWindow;
let sftp = new Client();
let connectionInfo = null;
let activeTransfers = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    vibrancy: "dark",
    backgroundColor: "#1a1a2e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Start with connect page
  mainWindow.loadFile("pages/connect.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Check TCP connectivity to server
ipcMain.on("check-connectivity", async (event, config) => {
  const { host, port } = config;
  const startTime = Date.now();
  
  const socket = new net.Socket();
  const timeout = 5000; // 5 second timeout
  
  socket.setTimeout(timeout);
  
  socket.on("connect", () => {
    const latency = Date.now() - startTime;
    socket.destroy();
    event.sender.send("connectivity-result", { ok: true, latency });
  });
  
  socket.on("timeout", () => {
    socket.destroy();
    event.sender.send("connectivity-result", { ok: false, error: "Connection timed out" });
  });
  
  socket.on("error", (err) => {
    socket.destroy();
    let errorMessage = err.message;
    
    if (err.code === "ENOTFOUND") {
      errorMessage = "Host not found. Please check the address.";
    } else if (err.code === "ECONNREFUSED") {
      errorMessage = "Connection refused. Server may not be running SSH.";
    } else if (err.code === "ENETUNREACH") {
      errorMessage = "Network unreachable. Check your internet connection.";
    }
    
    event.sender.send("connectivity-result", { ok: false, error: errorMessage });
  });
  
  try {
    socket.connect(port, host);
  } catch (err) {
    event.sender.send("connectivity-result", { ok: false, error: err.message });
  }
});

// Handle SFTP connect + list root
ipcMain.on("sftp-connect-and-list", async (event, config) => {
  try {
    // Disconnect previous connection if any
    try {
      await sftp.end();
    } catch (e) {
      // Ignore errors on disconnect
    }
    
    // Create new client
    sftp = new Client();
    
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    });
    
    // Store connection info (including password for sudo operations)
    connectionInfo = {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password
    };
    
    // Try to get user's home directory, fallback to /
    let homePath = "/";
    try {
      homePath = await sftp.cwd();
    } catch (e) {
      // If cwd() fails, try common home path
      try {
        const testPath = `/home/${config.username}`;
        await sftp.list(testPath);
        homePath = testPath;
      } catch (e2) {
        // Stay at root
        homePath = "/";
      }
    }
    
    const files = await sftp.list(homePath);
    event.sender.send("sftp-list-result", { ok: true, files, homePath });
  } catch (err) {
    let errorMessage = err.message;
    
    if (err.message.includes("authentication") || err.message.includes("Auth")) {
      errorMessage = "Invalid username or password";
    } else if (err.message.includes("timeout")) {
      errorMessage = "Connection timed out";
    }
    
    event.sender.send("sftp-list-result", { ok: false, error: errorMessage });
  }
});

// Navigate to browser page
ipcMain.on("navigate-to-browser", (event, homePath) => {
  // Store the home path for the browser to use
  connectionInfo.homePath = homePath || "/";
  mainWindow.loadFile("pages/browser.html");
});

// List directory
ipcMain.on("list-directory", async (event, dirPath) => {
  try {
    const files = await sftp.list(dirPath || "/");
    event.sender.send("list-result", { ok: true, files });
  } catch (err) {
    event.sender.send("list-result", { ok: false, error: err.message });
  }
});

// Disconnect
ipcMain.on("disconnect", async () => {
  try {
    await sftp.end();
  } catch (e) {
    // Ignore
  }
  connectionInfo = null;
  mainWindow.loadFile("pages/connect.html");
});

// Get connection info
ipcMain.handle("get-connection-info", () => {
  return connectionInfo;
});

// Select download folder
ipcMain.handle("select-download-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Select Download Location"
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Select files to upload
ipcMain.handle("select-files-to-upload", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    title: "Select Files to Upload"
  });
  
  if (result.canceled) {
    return null;
  }
  
  // Get file info for each selected file
  const files = result.filePaths.map(filePath => {
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size
    };
  });
  
  return files;
});

// Upload file
ipcMain.on("upload-file", async (event, config) => {
  const { transferId, localPath, remotePath, size } = config;
  
  try {
    // Track the transfer
    activeTransfers.set(transferId, { cancelled: false });
    
    // Use fastPut for better performance with progress
    await sftp.fastPut(localPath, remotePath, {
      step: (transferred, chunk, total) => {
        const progress = Math.round((transferred / total) * 100);
        
        if (!activeTransfers.get(transferId)?.cancelled) {
          event.sender.send("transfer-progress", { transferId, progress });
        }
      }
    });
    
    if (!activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-complete", { transferId });
    }
    
    activeTransfers.delete(transferId);
  } catch (err) {
    if (!activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-error", { transferId, error: err.message });
    }
    activeTransfers.delete(transferId);
  }
});

// Download file
ipcMain.on("download-file", async (event, config) => {
  const { transferId, remotePath, localPath, size } = config;
  
  try {
    // Track the transfer
    activeTransfers.set(transferId, { cancelled: false });
    
    // Use fastGet for better performance with progress
    await sftp.fastGet(remotePath, localPath, {
      step: (transferred, chunk, total) => {
        const progress = Math.round((transferred / total) * 100);
        
        if (!activeTransfers.get(transferId)?.cancelled) {
          event.sender.send("transfer-progress", { transferId, progress });
        }
      }
    });
    
    if (!activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-complete", { transferId });
    }
    
    activeTransfers.delete(transferId);
  } catch (err) {
    if (!activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-error", { transferId, error: err.message });
    }
    activeTransfers.delete(transferId);
  }
});

// Cancel transfer
ipcMain.on("cancel-transfer", (event, transferId) => {
  const transfer = activeTransfers.get(transferId);
  if (transfer) {
    transfer.cancelled = true;
  }
});

// Create folder
ipcMain.handle("create-folder", async (event, folderPath) => {
  try {
    await sftp.mkdir(folderPath, true); // recursive = true
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Create file (empty file)
ipcMain.handle("create-file", async (event, filePath) => {
  try {
    // Create an empty file by putting an empty buffer
    await sftp.put(Buffer.from(""), filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Delete items
ipcMain.handle("delete-items", async (event, paths) => {
  const results = [];
  
  for (const item of paths) {
    try {
      if (item.type === "d") {
        // It's a directory - use rmdir with recursive
        await sftp.rmdir(item.path, true);
      } else {
        // It's a file
        await sftp.delete(item.path);
      }
      results.push({ path: item.path, ok: true });
    } catch (err) {
      results.push({ path: item.path, ok: false, error: err.message });
    }
  }
  
  return results;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
