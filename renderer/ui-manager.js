// ui-manager.js - Handles UI rendering and updates

class UIManager {
  constructor(fileManager, transferManager) {
    this.fileManager = fileManager;
    this.transferManager = transferManager;
    this.selectedFiles = new Set();

    // DOM elements
    this.fileList = document.getElementById("fileList");
    this.loadingState = document.getElementById("loadingState");
    this.pathInput = document.getElementById("pathInput");
    this.currentPathEl = document.getElementById("currentPath");
    this.itemCountEl = document.getElementById("itemCount");
    this.selectedCountEl = document.getElementById("selectedCount");
    this.transferList = document.getElementById("transferList");

    // Buttons
    this.backBtn = document.getElementById("backBtn");
    this.forwardBtn = document.getElementById("forwardBtn");
    this.upBtn = document.getElementById("upBtn");
    this.downloadBtn = document.getElementById("downloadBtn");
    this.deleteBtn = document.getElementById("deleteBtn");
  }

  // Format file size
  formatSize(bytes) {
    if (bytes === 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
  }

  // Format date
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  // Render file list
  renderFiles() {
    const files = this.fileManager.getFiles();
    this.loadingState.classList.add("hidden");

    if (files.length === 0) {
      this.fileList.innerHTML = `
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

    this.fileList.innerHTML = sorted.map(file => {
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
        <div class="file-item ${this.selectedFiles.has(file.name) ? 'selected' : ''}" data-name="${file.name}" data-type="${file.type}" data-size="${file.size || 0}">
          <div class="file-icon ${isFolder ? 'folder' : 'file'}">
            ${icon}
          </div>
          <div class="file-name">${file.name}</div>
          <div class="file-size">${isFolder ? "—" : this.formatSize(file.size)}</div>
          <div class="file-modified">${this.formatDate(file.modifyTime)}</div>
          <div class="file-permissions">${file.rights?.user || "---"}</div>
        </div>
      `;
    }).join("");

    // Update status
    this.updateStatus();

    // Add click handlers
    this.attachFileHandlers();
  }

  // Attach file click handlers
  attachFileHandlers() {
    document.querySelectorAll(".file-item").forEach(item => {
      // Single click to select
      item.addEventListener("click", (e) => {
        const name = item.dataset.name;

        if (e.metaKey || e.ctrlKey) {
          // Multi-select
          if (this.selectedFiles.has(name)) {
            this.selectedFiles.delete(name);
            item.classList.remove("selected");
          } else {
            this.selectedFiles.add(name);
            item.classList.add("selected");
          }
        } else {
          // Single select
          document.querySelectorAll(".file-item.selected").forEach(el => {
            el.classList.remove("selected");
          });
          this.selectedFiles.clear();
          this.selectedFiles.add(name);
          item.classList.add("selected");
        }

        this.updateStatus();
        this.updateActionButtons();
      });

      // Double click to open folder or edit file
      item.addEventListener("dblclick", () => {
        const name = item.dataset.name;
        const type = item.dataset.type;

        if (type === "d") {
          // Navigate to folder
          const newPath = this.fileManager.navigateTo(this.fileManager.getFullPath(name));
          this.updatePathDisplay(newPath);
          this.fileManager.loadDirectory(newPath);
          this.updateNavButtons();
        } else {
          // Edit file
          this.editFile(name);
        }
      });
    });
  }

  // Update status bar
  updateStatus() {
    const files = this.fileManager.getFiles();
    const folderCount = files.filter(f => f.type === "d").length;
    const fileCount = files.filter(f => f.type !== "d").length;

    this.itemCountEl.textContent = `${folderCount} folders, ${fileCount} files`;
    this.selectedCountEl.textContent = `${this.selectedFiles.size} selected`;
  }

  // Update action buttons
  updateActionButtons() {
    const hasSelection = this.selectedFiles.size > 0;
    this.downloadBtn.disabled = !hasSelection;
    this.deleteBtn.disabled = !hasSelection;
  }

  // Update path display
  updatePathDisplay(path) {
    this.pathInput.value = path;
    this.currentPathEl.textContent = path;
  }

  // Update navigation buttons
  updateNavButtons() {
    this.backBtn.disabled = !this.fileManager.canGoBack();
    this.forwardBtn.disabled = !this.fileManager.canGoForward();
    this.upBtn.disabled = !this.fileManager.canGoUp();
  }

  // Render transfers
  renderTransfers() {
    const transfers = this.transferManager.getTransfers();

    if (transfers.length === 0) {
      this.transferList.innerHTML = '<div class="transfer-empty">No active transfers</div>';
      return;
    }

    this.transferList.innerHTML = transfers.map(transfer => {
      const isComplete = transfer.progress >= 100;
      const progressClass = isComplete ? "complete" : "";
      const statusText = isComplete
        ? "Complete"
        : `${this.formatSize(transfer.size * transfer.progress / 100)} / ${this.formatSize(transfer.size)}`;

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
        this.transferManager.cancelTransfer(id);
        this.renderTransfers();
      });
    });
  }

  // Show loading state
  showLoading() {
    this.loadingState.classList.remove("hidden");
    this.fileList.innerHTML = "";
    this.fileList.appendChild(this.loadingState);
  }

  // Clear selection
  clearSelection() {
    this.selectedFiles.clear();
    document.querySelectorAll(".file-item.selected").forEach(el => {
      el.classList.remove("selected");
    });
    this.updateStatus();
    this.updateActionButtons();
  }

  // Get selected files
  getSelectedFiles() {
    return Array.from(this.selectedFiles);
  }

  // Edit file (placeholder for editor manager)
  editFile(name) {
    // This will be implemented in editor-manager.js
    console.log(`Editing file: ${name}`);
  }
}

export default UIManager;