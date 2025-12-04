// DOM Elements
const fileList = document.getElementById("fileList");
const loadingState = document.getElementById("loadingState");
const pathInput = document.getElementById("pathInput");
const currentPathEl = document.getElementById("currentPath");
const itemCountEl = document.getElementById("itemCount");
const selectedCountEl = document.getElementById("selectedCount");
const serverInfoEl = document.getElementById("serverInfo");
const connectionLabel = document.getElementById("connectionLabel");
const filePanel = document.getElementById("filePanel");
const dropOverlay = document.getElementById("dropOverlay");
const fileInput = document.getElementById("fileInput");

// Transfer Panel Elements
const transferPanel = document.getElementById("transferPanel");
const transferList = document.getElementById("transferList");
const transferToggle = document.getElementById("transferToggle");

// Navigation buttons
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const upBtn = document.getElementById("upBtn");
const refreshBtn = document.getElementById("refreshBtn");
const goBtn = document.getElementById("goBtn");

// Action buttons
const disconnectBtn = document.getElementById("disconnectBtn");
const newFolderBtn = document.getElementById("newFolderBtn");
const uploadBtn = document.getElementById("uploadBtn");
const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");

// State
let currentPath = "/";
let files = [];
let selectedFiles = new Set();
let history = ["/"];
let historyIndex = 0;
let transfers = new Map();
let transferIdCounter = 0;

// Format file size
function formatSize(bytes) {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// Render file list
function renderFiles(fileData) {
  files = fileData;
  loadingState.classList.add("hidden");
  
  if (files.length === 0) {
    fileList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
        <span>This folder is empty</span>
      </div>
    `;
    return;
  }
  
  // Sort: folders first, then files, alphabetically
  const sorted = [...files].sort((a, b) => {
    if (a.type === "d" && b.type !== "d") return -1;
    if (a.type !== "d" && b.type === "d") return 1;
    return a.name.localeCompare(b.name);
  });
  
  fileList.innerHTML = sorted.map(file => {
    const isFolder = file.type === "d";
    const icon = isFolder ? `
      <svg viewBox="0 0 24 24">
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
      </svg>
    ` : `
      <svg viewBox="0 0 24 24">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
      </svg>
    `;
    
    return `
      <div class="file-item" data-name="${file.name}" data-type="${file.type}" data-size="${file.size || 0}">
        <div class="file-icon ${isFolder ? 'folder' : 'file'}">
          ${icon}
        </div>
        <div class="file-name">${file.name}</div>
        <div class="file-size">${isFolder ? "—" : formatSize(file.size)}</div>
        <div class="file-modified">${formatDate(file.modifyTime)}</div>
        <div class="file-permissions">${file.rights?.user || "---"}</div>
      </div>
    `;
  }).join("");
  
  // Update status
  updateStatus();
  
  // Add click handlers
  attachFileHandlers();
}

// Attach file click handlers
function attachFileHandlers() {
  document.querySelectorAll(".file-item").forEach(item => {
    // Single click to select
    item.addEventListener("click", (e) => {
      const name = item.dataset.name;
      
      if (e.metaKey || e.ctrlKey) {
        // Multi-select
        if (selectedFiles.has(name)) {
          selectedFiles.delete(name);
          item.classList.remove("selected");
        } else {
          selectedFiles.add(name);
          item.classList.add("selected");
        }
      } else {
        // Single select
        document.querySelectorAll(".file-item.selected").forEach(el => {
          el.classList.remove("selected");
        });
        selectedFiles.clear();
        selectedFiles.add(name);
        item.classList.add("selected");
      }
      
      updateStatus();
      updateActionButtons();
    });
    
    // Double click to open folder or file
    item.addEventListener("dblclick", () => {
      const name = item.dataset.name;
      const type = item.dataset.type;
      
      if (type === "d") {
        // It's a folder - navigate into it
        navigateTo(currentPath === "/" ? `/${name}` : `${currentPath}/${name}`);
      } else {
        // It's a file - open in new editor window
        const filePath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
        window.api.openFileInEditor({
          name: name,
          path: filePath
        });
      }
    });
  });
}

// Update status bar
function updateStatus() {
  const folderCount = files.filter(f => f.type === "d").length;
  const fileCount = files.filter(f => f.type !== "d").length;
  
  itemCountEl.textContent = `${folderCount} folders, ${fileCount} files`;
  selectedCountEl.textContent = `${selectedFiles.size} selected`;
}

// Update action buttons
function updateActionButtons() {
  const hasSelection = selectedFiles.size > 0;
  downloadBtn.disabled = !hasSelection;
  deleteBtn.disabled = !hasSelection;
}

// Navigate to path
function navigateTo(path) {
  // Normalize path
  path = path.replace(/\/+/g, "/");
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  
  currentPath = path;
  pathInput.value = path;
  currentPathEl.textContent = path;
  
  // Update history
  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  history.push(path);
  historyIndex = history.length - 1;
  
  updateNavButtons();
  loadDirectory(path);
}

// Load directory
function loadDirectory(path) {
  selectedFiles.clear();
  loadingState.classList.remove("hidden");
  fileList.innerHTML = "";
  fileList.appendChild(loadingState);
  
  window.api.listDirectory(path);
}

// Update navigation buttons
function updateNavButtons() {
  backBtn.disabled = historyIndex <= 0;
  forwardBtn.disabled = historyIndex >= history.length - 1;
  upBtn.disabled = currentPath === "/";
}

// Navigation handlers
backBtn.addEventListener("click", () => {
  if (historyIndex > 0) {
    historyIndex--;
    const path = history[historyIndex];
    currentPath = path;
    pathInput.value = path;
    currentPathEl.textContent = path;
    updateNavButtons();
    loadDirectory(path);
  }
});

forwardBtn.addEventListener("click", () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    const path = history[historyIndex];
    currentPath = path;
    pathInput.value = path;
    currentPathEl.textContent = path;
    updateNavButtons();
    loadDirectory(path);
  }
});

upBtn.addEventListener("click", () => {
  if (currentPath !== "/") {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    navigateTo(parentPath);
  }
});

refreshBtn.addEventListener("click", () => {
  loadDirectory(currentPath);
});

goBtn.addEventListener("click", () => {
  const path = pathInput.value.trim() || "/";
  navigateTo(path);
});

pathInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    goBtn.click();
  }
});

// Disconnect handler
disconnectBtn.addEventListener("click", () => {
  window.api.disconnect();
});

// ==========================================
// UPLOAD FUNCTIONALITY
// ==========================================

// Upload button click handler
uploadBtn.addEventListener("click", () => {
  window.api.selectFilesToUpload().then(files => {
    if (files && files.length > 0) {
      files.forEach(file => {
        const transferId = ++transferIdCounter;
        const remotePath = currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
        
        // Add to transfers
        transfers.set(transferId, {
          id: transferId,
          name: file.name,
          type: "upload",
          size: file.size,
          progress: 0,
          status: "uploading"
        });
        
        renderTransfers();
        
        // Start upload
        window.api.uploadFile({
          transferId,
          localPath: file.path,
          remotePath,
          size: file.size
        });
      });
    }
  });
});

// File input change handler (not used anymore, keeping for backup)
fileInput.addEventListener("change", (e) => {
  // Reset input
  fileInput.value = "";
});

// Upload files from drag & drop
function uploadFilesFromDrop(filePaths) {
  filePaths.forEach(fileInfo => {
    const transferId = ++transferIdCounter;
    const remotePath = currentPath === "/" ? `/${fileInfo.name}` : `${currentPath}/${fileInfo.name}`;
    
    // Add to transfers
    transfers.set(transferId, {
      id: transferId,
      name: fileInfo.name,
      type: "upload",
      size: fileInfo.size,
      progress: 0,
      status: "uploading"
    });
    
    renderTransfers();
    
    // Start upload
    window.api.uploadFile({
      transferId,
      localPath: fileInfo.path,
      remotePath,
      size: fileInfo.size
    });
  });
}

// ==========================================
// DOWNLOAD FUNCTIONALITY
// ==========================================

// Download button click handler
downloadBtn.addEventListener("click", () => {
  if (selectedFiles.size === 0) return;
  
  // Get selected file items (not folders)
  const filesToDownload = [];
  selectedFiles.forEach(name => {
    const fileItem = document.querySelector(`.file-item[data-name="${name}"]`);
    if (fileItem && fileItem.dataset.type !== "d") {
      filesToDownload.push({
        name,
        size: parseInt(fileItem.dataset.size) || 0
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
        const transferId = ++transferIdCounter;
        const remotePath = currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
        const localPath = `${folderPath}/${file.name}`;
        
        // Add to transfers
        transfers.set(transferId, {
          id: transferId,
          name: file.name,
          type: "download",
          size: file.size,
          progress: 0,
          status: "downloading"
        });
        
        renderTransfers();
        
        // Start download
        window.api.downloadFile({
          transferId,
          remotePath,
          localPath,
          size: file.size
        });
      });
    }
  });
});

// ==========================================
// DRAG & DROP FUNCTIONALITY
// ==========================================

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
      uploadFilesFromDrop(filePaths);
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

// ==========================================
// TRANSFER PANEL
// ==========================================

// Toggle transfer panel
transferToggle.addEventListener("click", () => {
  transferPanel.classList.toggle("collapsed");
});

// Render transfers
function renderTransfers() {
  if (transfers.size === 0) {
    transferList.innerHTML = '<div class="transfer-empty">No active transfers</div>';
    return;
  }
  
  transferList.innerHTML = Array.from(transfers.values()).map(transfer => {
    const isComplete = transfer.progress >= 100;
    const progressClass = isComplete ? "complete" : "";
    const statusText = isComplete 
      ? "Complete" 
      : `${formatSize(transfer.size * transfer.progress / 100)} / ${formatSize(transfer.size)}`;
    
    return `
      <div class="transfer-item" data-id="${transfer.id}">
        <div class="transfer-icon ${transfer.type}">
          <svg viewBox="0 0 24 24">
            ${transfer.type === "upload" 
              ? '<path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>'
              : '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>'
            }
          </svg>
        </div>
        <div class="transfer-info">
          <div class="transfer-name">${transfer.name}</div>
          <div class="transfer-progress-bar">
            <div class="transfer-progress-fill ${progressClass}" style="width: ${transfer.progress}%"></div>
          </div>
          <div class="transfer-status">${statusText}</div>
        </div>
        ${!isComplete ? `
          <button class="transfer-cancel" data-id="${transfer.id}">
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;
  }).join("");
  
  // Add cancel handlers
  document.querySelectorAll(".transfer-cancel").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      window.api.cancelTransfer(id);
      transfers.delete(id);
      renderTransfers();
    });
  });
}

// ==========================================
// API EVENT LISTENERS
// ==========================================

// Listen for file list results
window.api.onListResult((data) => {
  if (data.ok) {
    renderFiles(data.files);
  } else {
    loadingState.classList.add("hidden");
    fileList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>Error: ${data.error}</span>
      </div>
    `;
  }
});

// Listen for transfer progress
window.api.onTransferProgress((data) => {
  const transfer = transfers.get(data.transferId);
  if (transfer) {
    transfer.progress = data.progress;
    renderTransfers();
  }
});

// Listen for transfer complete
window.api.onTransferComplete((data) => {
  const transfer = transfers.get(data.transferId);
  if (transfer) {
    transfer.progress = 100;
    transfer.status = "complete";
    renderTransfers();
    
    // Refresh directory if upload
    if (transfer.type === "upload") {
      loadDirectory(currentPath);
    }
    
    // Remove from transfers after 3 seconds
    setTimeout(() => {
      transfers.delete(data.transferId);
      renderTransfers();
    }, 3000);
  }
});

// Listen for transfer error
window.api.onTransferError((data) => {
  const transfer = transfers.get(data.transferId);
  if (transfer) {
    transfer.status = "error";
    transfers.delete(data.transferId);
    renderTransfers();
    alert(`Transfer failed: ${data.error}`);
  }
});

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize
window.api.getConnectionInfo().then(info => {
  if (info) {
    serverInfoEl.textContent = `${info.username}@${info.host}:${info.port}`;
    connectionLabel.textContent = `Connected to ${info.host}`;
    
    // Load the home directory instead of root
    const startPath = info.homePath || "/";
    currentPath = startPath;
    pathInput.value = startPath;
    currentPathEl.textContent = startPath;
    history = [startPath];
    historyIndex = 0;
    
    loadDirectory(startPath);
  } else {
    // No connection info, load root
    loadDirectory("/");
  }
});

// ==========================================
// NEW ITEM MODAL (FILE / FOLDER)
// ==========================================

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
newFolderBtn.addEventListener("click", () => {
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
  
  const fullPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
  
  try {
    let result;
    if (newItemType === "folder") {
      result = await window.api.createFolder(fullPath);
    } else {
      result = await window.api.createFile(fullPath);
    }
    
    if (result.ok) {
      closeNewItemModal();
      loadDirectory(currentPath); // Refresh to show new item
    } else {
      alert(`Failed to create ${newItemType}: ${result.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
  
  createItemBtn.disabled = false;
  createItemBtn.textContent = "Create";
}

// ==========================================
// DELETE FUNCTIONALITY
// ==========================================

const deleteModal = document.getElementById("deleteModal");
const deleteModalClose = document.getElementById("deleteModalClose");
const deleteMessage = document.getElementById("deleteMessage");
const deleteItemsList = document.getElementById("deleteItemsList");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

let itemsToDelete = [];

// Open delete modal
deleteBtn.addEventListener("click", () => {
  if (selectedFiles.size === 0) return;
  
  // Build list of items to delete
  itemsToDelete = [];
  selectedFiles.forEach(name => {
    const fileItem = document.querySelector(`.file-item[data-name="${name}"]`);
    if (fileItem) {
      itemsToDelete.push({
        name,
        type: fileItem.dataset.type,
        path: currentPath === "/" ? `/${name}` : `${currentPath}/${name}`
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
    const results = await window.api.deleteItems(itemsToDelete);
    
    // Check for errors
    const errors = results.filter(r => !r.ok);
    
    if (errors.length > 0) {
      alert(`Some items could not be deleted:\n${errors.map(e => `${e.path}: ${e.error}`).join("\n")}`);
    }
    
    closeDeleteModal();
    selectedFiles.clear();
    loadDirectory(currentPath);
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
  
  confirmDeleteBtn.disabled = false;
  confirmDeleteBtn.textContent = "Delete";
});

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================

document.addEventListener("keydown", (e) => {
  // Don't trigger if typing in an input
  if (e.target.tagName === "INPUT") return;
  
  // Delete key or Backspace to delete selected items
  if ((e.key === "Delete" || e.key === "Backspace") && selectedFiles.size > 0) {
    e.preventDefault();
    deleteBtn.click();
  }
  
  // Cmd/Ctrl + N to create new
  if ((e.metaKey || e.ctrlKey) && e.key === "n") {
    e.preventDefault();
    newFolderBtn.click();
  }
  
  // Escape to close modals
  if (e.key === "Escape") {
    if (newItemModal.classList.contains("active")) {
      closeNewItemModal();
    }
    if (deleteModal.classList.contains("active")) {
      closeDeleteModal();
    }
  }
});
