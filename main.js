const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");
const Client = require("ssh2-sftp-client");

let mainWindow;
let editorWindows = new Map(); // Track editor windows

// Multi-session management
let sessions = new Map(); // sessionId -> { sftp, connectionInfo, activeTransfers }
let sessionIdCounter = 0;

function createWindow() {
  // Determine icon path based on platform
  const iconPath = process.platform === 'darwin' 
    ? path.join(__dirname, 'logo', 'logo.icns')
    : path.join(__dirname, 'logo', 'logo.png');
  
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    vibrancy: "dark",
    backgroundColor: "#1a1a2e",
    icon: iconPath, // Use the correct icon for platform
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
  const { host, port, sessionId } = config;
  const startTime = Date.now();
  
  const socket = new net.Socket();
  const timeout = 5000; // 5 second timeout
  
  socket.setTimeout(timeout);
  
  socket.on("connect", () => {
    const latency = Date.now() - startTime;
    socket.destroy();
    event.sender.send("connectivity-result", { ok: true, latency, sessionId });
  });
  
  socket.on("timeout", () => {
    socket.destroy();
    event.sender.send("connectivity-result", { ok: false, error: "Connection timed out", sessionId });
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
    
    event.sender.send("connectivity-result", { ok: false, error: errorMessage, sessionId });
  });
  
  try {
    socket.connect(port, host);
  } catch (err) {
    event.sender.send("connectivity-result", { ok: false, error: err.message, sessionId });
  }
});

// Handle SFTP connect + list root (creates a new session)
ipcMain.on("sftp-connect-and-list", async (event, config) => {
  const sessionId = config.sessionId || ++sessionIdCounter;
  
  try {
    // Create new SFTP client for this session
    const sftp = new Client();
    
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    });
    
    // Store connection info (including password for sudo operations)
    const connectionInfo = {
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
    
    // Store the session
    sessions.set(sessionId, {
      sftp,
      connectionInfo: { ...connectionInfo, homePath },
      activeTransfers: new Map()
    });
    
    event.sender.send("sftp-list-result", { ok: true, files, homePath, sessionId });
  } catch (err) {
    let errorMessage = err.message;
    
    if (err.message.includes("authentication") || err.message.includes("Auth")) {
      errorMessage = "Invalid username or password";
    } else if (err.message.includes("timeout")) {
      errorMessage = "Connection timed out";
    }
    
    event.sender.send("sftp-list-result", { ok: false, error: errorMessage, sessionId });
  }
});

// Navigate to browser page
ipcMain.on("navigate-to-browser", (event, data) => {
  // data can be { homePath, sessionId } or just homePath for backward compatibility
  const homePath = typeof data === 'object' ? data.homePath : data;
  const sessionId = typeof data === 'object' ? data.sessionId : null;
  
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.connectionInfo.homePath = homePath || "/";
  }
  
  mainWindow.loadFile("pages/browser.html");
});

// List directory (for specific session)
ipcMain.on("list-directory", async (event, data) => {
  const { path: dirPath, sessionId } = typeof data === 'object' ? data : { path: data, sessionId: null };
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    event.sender.send("list-result", { ok: false, error: "No active session", sessionId });
    return;
  }
  
  try {
    const files = await session.sftp.list(dirPath || "/");
    event.sender.send("list-result", { ok: true, files, sessionId });
  } catch (err) {
    event.sender.send("list-result", { ok: false, error: err.message, sessionId });
  }
});

// Disconnect specific session
ipcMain.on("disconnect", async (event, sessionId) => {
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    try {
      await session.sftp.end();
    } catch (e) {
      // Ignore
    }
    sessions.delete(sessionId);
    event.sender.send("session-disconnected", { sessionId });
  } else {
    // Disconnect all sessions (backward compatibility)
    for (const [id, session] of sessions) {
      try {
        await session.sftp.end();
      } catch (e) {
        // Ignore
      }
    }
    sessions.clear();
    mainWindow.loadFile("pages/connect.html");
  }
});

// Get connection info for specific session
ipcMain.handle("get-connection-info", (event, sessionId) => {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId).connectionInfo;
  }
  // Return first session info for backward compatibility
  const firstSession = sessions.values().next().value;
  return firstSession ? firstSession.connectionInfo : null;
});

// Get all sessions info
ipcMain.handle("get-all-sessions", () => {
  const sessionsInfo = [];
  for (const [id, session] of sessions) {
    sessionsInfo.push({
      sessionId: id,
      ...session.connectionInfo
    });
  }
  return sessionsInfo;
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

// Upload file (with session support)
ipcMain.on("upload-file", async (event, config) => {
  const { transferId, localPath, remotePath, size, sessionId } = config;
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    event.sender.send("transfer-error", { transferId, error: "No active session", sessionId });
    return;
  }
  
  try {
    // Track the transfer
    session.activeTransfers.set(transferId, { cancelled: false });
    
    // Use fastPut for better performance with progress
    await session.sftp.fastPut(localPath, remotePath, {
      step: (transferred, chunk, total) => {
        const progress = Math.round((transferred / total) * 100);
        
        if (!session.activeTransfers.get(transferId)?.cancelled) {
          event.sender.send("transfer-progress", { transferId, progress, sessionId });
        }
      }
    });
    
    if (!session.activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-complete", { transferId, sessionId });
    }
    
    session.activeTransfers.delete(transferId);
  } catch (err) {
    if (!session.activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-error", { transferId, error: err.message, sessionId });
    }
    session.activeTransfers.delete(transferId);
  }
});

// Download file (with session support)
ipcMain.on("download-file", async (event, config) => {
  const { transferId, remotePath, localPath, size, sessionId } = config;
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    event.sender.send("transfer-error", { transferId, error: "No active session", sessionId });
    return;
  }
  
  try {
    // Track the transfer
    session.activeTransfers.set(transferId, { cancelled: false });
    
    // Use fastGet for better performance with progress
    await session.sftp.fastGet(remotePath, localPath, {
      step: (transferred, chunk, total) => {
        const progress = Math.round((transferred / total) * 100);
        
        if (!session.activeTransfers.get(transferId)?.cancelled) {
          event.sender.send("transfer-progress", { transferId, progress, sessionId });
        }
      }
    });
    
    if (!session.activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-complete", { transferId, sessionId });
    }
    
    session.activeTransfers.delete(transferId);
  } catch (err) {
    if (!session.activeTransfers.get(transferId)?.cancelled) {
      event.sender.send("transfer-error", { transferId, error: err.message, sessionId });
    }
    session.activeTransfers.delete(transferId);
  }
});

// Cancel transfer (with session support)
ipcMain.on("cancel-transfer", (event, data) => {
  const { transferId, sessionId } = typeof data === 'object' ? data : { transferId: data, sessionId: null };
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (session) {
    const transfer = session.activeTransfers.get(transferId);
    if (transfer) {
      transfer.cancelled = true;
    }
  }
});

// Create folder (with session support)
ipcMain.handle("create-folder", async (event, data) => {
  const { path: folderPath, sessionId } = typeof data === 'object' ? data : { path: data, sessionId: null };
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    return { ok: false, error: "No active session" };
  }
  
  try {
    await session.sftp.mkdir(folderPath, true); // recursive = true
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Create file (empty file, with session support)
ipcMain.handle("create-file", async (event, data) => {
  const { path: filePath, sessionId } = typeof data === 'object' ? data : { path: data, sessionId: null };
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    return { ok: false, error: "No active session" };
  }
  
  try {
    // Create an empty file by putting an empty buffer
    await session.sftp.put(Buffer.from(""), filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Delete items (with session support)
ipcMain.handle("delete-items", async (event, data) => {
  const { paths, sessionId } = data.paths ? data : { paths: data, sessionId: null };
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    return [{ ok: false, error: "No active session" }];
  }
  
  const results = [];
  
  for (const item of paths) {
    try {
      if (item.type === "d") {
        // It's a directory - use rmdir with recursive
        await session.sftp.rmdir(item.path, true);
      } else {
        // It's a file
        await session.sftp.delete(item.path);
      }
      results.push({ path: item.path, ok: true });
    } catch (err) {
      results.push({ path: item.path, ok: false, error: err.message });
    }
  }
  
  return results;
});

// Read file content (with session support)
ipcMain.handle("read-file", async (event, data) => {
  const { path: filePath, sessionId } = typeof data === 'object' ? data : { path: data, sessionId: null };
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    throw new Error("No active session");
  }
  
  try {
    const buffer = await session.sftp.get(filePath);
    return buffer.toString('utf8');
  } catch (err) {
    throw new Error(err.message);
  }
});

// Write file content (with session support)
ipcMain.handle("write-file", async (event, data) => {
  const { path: filePath, content, sessionId } = typeof data === 'object' && data.path ? data : { path: data, content: arguments[2], sessionId: null };
  const session = sessionId ? sessions.get(sessionId) : sessions.values().next().value;
  
  if (!session) {
    throw new Error("No active session");
  }
  
  try {
    await session.sftp.put(Buffer.from(data.content || content, 'utf8'), filePath);
    return { ok: true };
  } catch (err) {
    throw new Error(err.message);
  }
});

// Open file in new editor window
ipcMain.on("open-file-in-editor", (event, fileInfo) => {
  createEditorWindow(fileInfo);
});

// Create editor window
function createEditorWindow(fileInfo) {
  const iconPath = process.platform === 'darwin' 
    ? path.join(__dirname, 'logo', 'logo.icns')
    : path.join(__dirname, 'logo', 'logo.png');
  
  const editorWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: "hiddenInset",
    vibrancy: "dark",
    backgroundColor: "#1a1a2e",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Store file info for this window
  const windowId = editorWindow.id;
  editorWindows.set(windowId, fileInfo);

  editorWindow.loadFile("pages/editor.html");

  editorWindow.on("closed", () => {
    editorWindows.delete(windowId);
  });

  return editorWindow;
}

// Get editor file info for the requesting window
ipcMain.handle("get-editor-file-info", (event) => {
  const windowId = BrowserWindow.fromWebContents(event.sender).id;
  return editorWindows.get(windowId) || null;
});

app.whenReady().then(() => {
  // On macOS set the dock icon from the project's logo (development/default)
  // BrowserWindow's `icon` option is not used by macOS for the titlebar/dock icon.
  if (process.platform === 'darwin') {
    try {
      const { nativeImage } = require('electron');
      const iconPath = path.join(__dirname, 'logo','logo.icns');
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        app.dock.setIcon(icon);
      }
    } catch (e) {
      // Ignore any errors setting the dock icon during development
    }
  }
  createWindow();
});

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
