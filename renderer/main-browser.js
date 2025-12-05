// main-browser.js - Main entry point for browser page

import FileManager from './file-manager.js';
import TransferManager from './transfer-manager.js';
import UIManager from './ui-manager.js';
import EditorManager from './editor-manager.js';
import { tabManager } from './tab-manager.js';

// Initialize managers
let fileManager = new FileManager();
let transferManager = new TransferManager();
let uiManager = new UIManager(fileManager, transferManager);
let editorManager = new EditorManager(fileManager, transferManager, uiManager);

// Set editor manager in UI manager
uiManager.editFile = (name) => editorManager.openEditor(name);

// State
let selectedFiles = new Set();

// Initialize tab manager
tabManager.init();

// Listen for tab changes
document.addEventListener("tabChanged", (e) => {
  const { tabId, state } = e.detail;
  
  // Restore state from tab
  if (state.fileManagerState) {
    fileManager.restoreState(state.fileManagerState);
  }
  
  // Update UI
  const info = state.connectionInfo;
  if (info) {
    document.getElementById("serverInfo").textContent = `${info.username}@${info.host}:${info.port}`;
    document.getElementById("connectionLabel").textContent = `Connected to ${info.host}`;
  }
  
  uiManager.updatePathDisplay(fileManager.getCurrentPath());
  uiManager.updateNavButtons();
  uiManager.showLoading();
  fileManager.loadDirectory(fileManager.getCurrentPath());
});

// Save current tab state before actions
function saveCurrentTabState() {
  if (tabManager.getActiveTabId()) {
    tabManager.saveActiveTabState(
      fileManager.getState(),
      { transfers: new Map(transferManager.transfers) },
      new Set(uiManager.getSelectedFiles())
    );
  }
}

// Navigation handlers
document.getElementById("backBtn").addEventListener("click", () => {
  const path = fileManager.goBack();
  if (path) {
    uiManager.updatePathDisplay(path);
    uiManager.updateNavButtons();
    uiManager.showLoading();
    fileManager.loadDirectory(path);
  }
});

document.getElementById("forwardBtn").addEventListener("click", () => {
  const path = fileManager.goForward();
  if (path) {
    uiManager.updatePathDisplay(path);
    uiManager.updateNavButtons();
    uiManager.showLoading();
    fileManager.loadDirectory(path);
  }
});

document.getElementById("upBtn").addEventListener("click", () => {
  const path = fileManager.goUp();
  if (path) {
    uiManager.updatePathDisplay(path);
    uiManager.updateNavButtons();
    uiManager.showLoading();
    fileManager.loadDirectory(path);
  }
});

document.getElementById("refreshBtn").addEventListener("click", () => {
  uiManager.showLoading();
  fileManager.loadDirectory(fileManager.getCurrentPath());
});

document.getElementById("goBtn").addEventListener("click", () => {
  const path = document.getElementById("pathInput").value.trim() || "/";
  const newPath = fileManager.navigateTo(path);
  uiManager.updatePathDisplay(newPath);
  uiManager.updateNavButtons();
  uiManager.showLoading();
  fileManager.loadDirectory(newPath);
});

document.getElementById("pathInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("goBtn").click();
  }
});

// Disconnect handler - now closes current tab or disconnects completely
document.getElementById("disconnectBtn").addEventListener("click", () => {
  if (tabManager.getTabCount() > 1) {
    // If there are multiple tabs, just close the current one
    tabManager.closeTab(tabManager.getActiveTabId());
  } else {
    // If this is the last tab, disconnect completely
    window.api.disconnect();
  }
});

// Upload functionality
document.getElementById("uploadBtn").addEventListener("click", () => {
  window.api.selectFilesToUpload().then(files => {
    if (files && files.length > 0) {
      files.forEach(file => {
        transferManager.uploadFile(
          file.path, 
          fileManager.getFullPath(file.name), 
          file.size, 
          file.name,
          fileManager.getSessionId()
        );
      });
      uiManager.renderTransfers();
      saveCurrentTabState();
    }
  });
});

// Download functionality
document.getElementById("downloadBtn").addEventListener("click", () => {
  const selected = uiManager.getSelectedFiles();
  if (selected.length === 0) return;

  // Get selected file items (not folders)
  const filesToDownload = [];
  selected.forEach(name => {
    const file = fileManager.getFileByName(name);
    if (file && file.type !== "d") {
      filesToDownload.push({
        name,
        size: file.size || 0
      });
    }
  });

  if (filesToDownload.length === 0) {
    alert("Please select files to download (not folders)");
    return;
  }

  // Ask for download location
  window.api.selectDownloadFolder().then(folderPath => {
    if (folderPath) {
      filesToDownload.forEach(file => {
        const remotePath = fileManager.getFullPath(file.name);
        const localPath = `${folderPath}/${file.name}`;
        transferManager.downloadFile(
          remotePath, 
          localPath, 
          file.size, 
          file.name,
          fileManager.getSessionId()
        );
      });
      uiManager.renderTransfers();
      saveCurrentTabState();
    }
  });
});

// Drag & drop functionality
const filePanel = document.getElementById("filePanel");
const dropOverlay = document.getElementById("dropOverlay");
let dragCounter = 0;

filePanel.addEventListener("dragenter", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;
  dropOverlay.classList.add("active");
});

filePanel.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter--;
  if (dragCounter === 0) {
    dropOverlay.classList.remove("active");
  }
});

filePanel.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

filePanel.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;
  dropOverlay.classList.remove("active");

  // Get file paths from the dropped files
  const droppedFiles = Array.from(e.dataTransfer.files);
  if (droppedFiles.length > 0) {
    // Extract paths using webkitGetAsEntry or path property
    const filePaths = droppedFiles.map(file => ({
      name: file.name,
      path: file.path, // Electron adds this property
      size: file.size
    })).filter(f => f.path); // Filter out any without path

    if (filePaths.length > 0) {
      filePaths.forEach(file => {
        transferManager.uploadFile(
          file.path, 
          fileManager.getFullPath(file.name), 
          file.size, 
          file.name,
          fileManager.getSessionId()
        );
      });
      uiManager.renderTransfers();
      saveCurrentTabState();
    } else {
      // Fallback: use dialog to select files if path not available
      alert("Please use the upload button to select files.");
    }
  }
});

// Prevent default drag behavior on window
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
});

// New item modal functionality
const newItemModal = document.getElementById("newItemModal");
const modalClose = document.getElementById("modalClose");
const typeSelector = document.getElementById("typeSelector");
const nameInputGroup = document.getElementById("nameInputGroup");
const modalFooter = document.getElementById("modalFooter");
const newItemName = document.getElementById("newItemName");
const nameLabel = document.getElementById("nameLabel");
const extensionHint = document.getElementById("extensionHint");
const backToTypeBtn = document.getElementById("backToTypeBtn");
const createItemBtn = document.getElementById("createItemBtn");
const modalTitle = document.getElementById("modalTitle");

let newItemType = null;

// Open modal when clicking new folder button
document.getElementById("newFolderBtn").addEventListener("click", () => {
  openNewItemModal();
});

function openNewItemModal() {
  newItemType = null;
  typeSelector.style.display = "grid";
  nameInputGroup.style.display = "none";
  modalFooter.style.display = "none";
  modalTitle.textContent = "Create New";
  newItemName.value = "";

  // Reset type selection
  document.querySelectorAll(".type-option").forEach(opt => {
    opt.classList.remove("selected");
  });

  newItemModal.classList.add("active");
}

function closeNewItemModal() {
  newItemModal.classList.remove("active");
}

// Close modal
modalClose.addEventListener("click", closeNewItemModal);
newItemModal.addEventListener("click", (e) => {
  if (e.target === newItemModal) {
    closeNewItemModal();
  }
});

// Type selection
document.querySelectorAll(".type-option").forEach(btn => {
  btn.addEventListener("click", () => {
    newItemType = btn.dataset.type;

    // Update UI
    document.querySelectorAll(".type-option").forEach(opt => {
      opt.classList.remove("selected");
    });
    btn.classList.add("selected");

    // Show name input
    setTimeout(() => {
      typeSelector.style.display = "none";
      nameInputGroup.style.display = "flex";
      modalFooter.style.display = "flex";

      if (newItemType === "folder") {
        modalTitle.textContent = "New Folder";
        nameLabel.textContent = "Folder Name";
        newItemName.placeholder = "My Folder";
        extensionHint.textContent = "";
      } else {
        modalTitle.textContent = "New File";
        nameLabel.textContent = "File Name";
        newItemName.placeholder = "filename.txt";
        extensionHint.textContent = "Include the file extension (e.g., .txt, .js, .py)";
      }

      newItemName.focus();
    }, 150);
  });
});

// Back button
backToTypeBtn.addEventListener("click", () => {
  typeSelector.style.display = "grid";
  nameInputGroup.style.display = "none";
  modalFooter.style.display = "none";
  modalTitle.textContent = "Create New";
  newItemType = null;

  document.querySelectorAll(".type-option").forEach(opt => {
    opt.classList.remove("selected");
  });
});

// Create button
createItemBtn.addEventListener("click", createNewItem);

// Enter key in input
newItemName.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    createNewItem();
  }
});

async function createNewItem() {
  const name = newItemName.value.trim();

  if (!name) {
    newItemName.focus();
    return;
  }

  // Validate name
  if (name.includes("/") || name.includes("\\")) {
    alert("Name cannot contain / or \\ characters");
    return;
  }

  createItemBtn.disabled = true;
  createItemBtn.textContent = "Creating...";

  const fullPath = fileManager.getFullPath(name);
  const sessionId = fileManager.getSessionId();

  try {
    let result;
    if (newItemType === "folder") {
      result = await window.api.createFolder({ path: fullPath, sessionId });
    } else {
      result = await window.api.createFile({ path: fullPath, sessionId });
    }

    if (result.ok) {
      closeNewItemModal();
      uiManager.showLoading();
      fileManager.loadDirectory(fileManager.getCurrentPath()); // Refresh to show new item
    } else {
      alert(`Failed to create ${newItemType}: ${result.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }

  createItemBtn.disabled = false;
  createItemBtn.textContent = "Create";
}

// Delete functionality
const deleteModal = document.getElementById("deleteModal");
const deleteModalClose = document.getElementById("deleteModalClose");
const deleteMessage = document.getElementById("deleteMessage");
const deleteItemsList = document.getElementById("deleteItemsList");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

let itemsToDelete = [];

// Open delete modal
document.getElementById("deleteBtn").addEventListener("click", () => {
  const selected = uiManager.getSelectedFiles();
  if (selected.length === 0) return;

  // Build list of items to delete
  itemsToDelete = [];
  selected.forEach(name => {
    const file = fileManager.getFileByName(name);
    if (file) {
      itemsToDelete.push({
        name,
        type: file.type,
        path: fileManager.getFullPath(name)
      });
    }
  });

  if (itemsToDelete.length === 0) return;

  // Update modal content
  if (itemsToDelete.length === 1) {
    deleteMessage.textContent = `Are you sure you want to delete "${itemsToDelete[0].name}"?`;
  } else {
    deleteMessage.textContent = `Are you sure you want to delete ${itemsToDelete.length} items?`;
  }

  // Show items list
  deleteItemsList.innerHTML = itemsToDelete.map(item => {
    const isFolder = item.type === "d";
    return `
      <div class="delete-item ${isFolder ? 'folder' : 'file'}">
        <svg viewBox="0 0 24 24">
          ${isFolder
            ? '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>'
            : '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>'
          }
        </svg>
        <span>${item.name}</span>
      </div>
    `;
  }).join("");

  deleteModal.classList.add("active");
});

// Close delete modal
function closeDeleteModal() {
  deleteModal.classList.remove("active");
  itemsToDelete = [];
}

deleteModalClose.addEventListener("click", closeDeleteModal);
cancelDeleteBtn.addEventListener("click", closeDeleteModal);
deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    closeDeleteModal();
  }
});

// Confirm delete
confirmDeleteBtn.addEventListener("click", async () => {
  if (itemsToDelete.length === 0) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";

  try {
    const results = await window.api.deleteItems({ 
      paths: itemsToDelete, 
      sessionId: fileManager.getSessionId() 
    });

    // Check for errors
    const errors = results.filter(r => !r.ok);

    if (errors.length > 0) {
      alert(`Some items could not be deleted:\n${errors.map(e => `${e.path}: ${e.error}`).join("\n")}`);
    }

    closeDeleteModal();
    uiManager.clearSelection();
    uiManager.showLoading();
    fileManager.loadDirectory(fileManager.getCurrentPath());
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }

  confirmDeleteBtn.disabled = false;
  confirmDeleteBtn.textContent = "Delete";
});

// API event listeners
window.api.onListResult((data) => {
  // Only process if it's for the current session
  const currentSessionId = fileManager.getSessionId();
  if (data.sessionId && data.sessionId !== currentSessionId) {
    return; // Ignore results for other sessions
  }
  
  if (data.ok) {
    fileManager.setFiles(data.files);
    uiManager.renderFiles();
    saveCurrentTabState();
  } else {
    uiManager.loadingState.classList.add("hidden");
    uiManager.fileList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>Error: ${data.error}</span>
      </div>
    `;
  }
});

// Transfer events
window.api.onTransferProgress((data) => {
  transferManager.updateProgress(data.transferId, data.progress);
  uiManager.renderTransfers();
});

window.api.onTransferComplete((data) => {
  transferManager.updateProgress(data.transferId, 100);
  uiManager.renderTransfers();

  // Refresh directory if upload (for the current session only)
  const transfer = transferManager.transfers.get(data.transferId);
  if (transfer?.type === "upload") {
    if (!data.sessionId || data.sessionId === fileManager.getSessionId()) {
      fileManager.loadDirectory(fileManager.getCurrentPath());
    }
  }
  saveCurrentTabState();
});

window.api.onTransferError((data) => {
  transferManager.handleError(data.transferId, data.error);
  uiManager.renderTransfers();
  saveCurrentTabState();
});

// Initialization - use tab manager
async function initializeBrowser() {
  const hasExistingSessions = await tabManager.initFromSessions();
  
  // If we have tabs, the tabChanged event will handle loading
  // If no sessions exist, we should show the new connection modal
  // which is handled by tabManager.initFromSessions()
}

// Start initialization
initializeBrowser();

// ==========================================
// NEW CONNECTION MODAL (for new tabs)
// ==========================================

const newConnectionModal = document.getElementById("newConnectionModal");
const newConnModalClose = document.getElementById("newConnModalClose");
const newConnHost = document.getElementById("newConnHost");
const newConnPort = document.getElementById("newConnPort");
const newConnUsername = document.getElementById("newConnUsername");
const newConnPassword = document.getElementById("newConnPassword");
const newConnStatus = document.getElementById("newConnStatus");
const newConnCancelBtn = document.getElementById("newConnCancelBtn");
const newConnConnectBtn = document.getElementById("newConnConnectBtn");

function closeNewConnectionModal() {
  newConnectionModal.classList.remove("show");
  newConnStatus.textContent = "";
  newConnStatus.className = "conn-status";
}

// Close modal handlers
newConnModalClose?.addEventListener("click", closeNewConnectionModal);
newConnCancelBtn?.addEventListener("click", closeNewConnectionModal);
newConnectionModal?.addEventListener("click", (e) => {
  if (e.target === newConnectionModal) {
    closeNewConnectionModal();
  }
});

// Connect button handler
newConnConnectBtn?.addEventListener("click", async () => {
  const host = newConnHost.value.trim();
  const port = parseInt(newConnPort.value) || 22;
  const username = newConnUsername.value.trim();
  const password = newConnPassword.value;
  
  if (!host || !username) {
    newConnStatus.textContent = "Please enter host and username";
    newConnStatus.className = "conn-status error";
    return;
  }
  
  newConnConnectBtn.disabled = true;
  newConnConnectBtn.textContent = "Connecting...";
  newConnStatus.textContent = "Establishing connection...";
  newConnStatus.className = "conn-status";
  
  // Connect to new session
  window.api.sftpConnectAndList({
    host,
    port,
    username,
    password
  });
});

// Listen for new connection result
window.api.onSftpListResult((data) => {
  if (data.ok && data.sessionId) {
    // Connection successful - create new tab
    const connectionInfo = {
      host: newConnHost.value.trim(),
      port: parseInt(newConnPort.value) || 22,
      username: newConnUsername.value.trim(),
      homePath: data.homePath
    };
    
    tabManager.createTab(data.sessionId, connectionInfo);
    closeNewConnectionModal();
    
    // Clear form for next use
    newConnHost.value = "";
    newConnPort.value = "22";
    newConnUsername.value = "";
    newConnPassword.value = "";
  } else if (!data.ok && newConnectionModal.classList.contains("show")) {
    // Connection failed
    newConnStatus.textContent = data.error || "Connection failed";
    newConnStatus.className = "conn-status error";
  }
  
  newConnConnectBtn.disabled = false;
  newConnConnectBtn.textContent = "Connect";
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Don't trigger if typing in an input
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  // Delete key or Backspace to delete selected items
  if ((e.key === "Delete" || e.key === "Backspace") && uiManager.getSelectedFiles().length > 0) {
    e.preventDefault();
    document.getElementById("deleteBtn").click();
  }

  // Cmd/Ctrl + N to create new
  if ((e.metaKey || e.ctrlKey) && e.key === "n") {
    e.preventDefault();
    document.getElementById("newFolderBtn").click();
  }

  // Cmd/Ctrl + T to create new tab
  if ((e.metaKey || e.ctrlKey) && e.key === "t") {
    e.preventDefault();
    tabManager.showNewConnectionModal();
  }

  // Escape to close modals
  if (e.key === "Escape") {
    if (newItemModal.classList.contains("active")) {
      closeNewItemModal();
    }
    if (deleteModal.classList.contains("active")) {
      closeDeleteModal();
    }
    if (newConnectionModal.classList.contains("show")) {
      closeNewConnectionModal();
    }
  }
});