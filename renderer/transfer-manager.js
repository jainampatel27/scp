// transfer-manager.js - Handles file transfers (upload/download)

class TransferManager {
  constructor() {
    this.transfers = new Map();
    this.transferIdCounter = 0;
  }

  // Start file upload
  uploadFile(localPath, remotePath, size, name) {
    const transferId = ++this.transferIdCounter;

    // Add to transfers
    this.transfers.set(transferId, {
      id: transferId,
      name: name || localPath.split('/').pop(),
      type: "upload",
      size: size,
      progress: 0,
      status: "uploading"
    });

    // Start upload
    window.api.uploadFile({
      transferId,
      localPath,
      remotePath,
      size
    });

    return transferId;
  }

  // Start file download
  downloadFile(remotePath, localPath, size, name) {
    const transferId = ++this.transferIdCounter;

    // Add to transfers
    this.transfers.set(transferId, {
      id: transferId,
      name: name,
      type: "download",
      size: size,
      progress: 0,
      status: "downloading"
    });

    // Start download
    window.api.downloadFile({
      transferId,
      remotePath,
      localPath,
      size
    });

    return transferId;
  }

  // Cancel transfer
  cancelTransfer(transferId) {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      window.api.cancelTransfer(transferId);
      this.transfers.delete(transferId);
    }
  }

  // Update transfer progress
  updateProgress(transferId, progress) {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.progress = progress;
      if (progress >= 100) {
        transfer.status = "complete";
        // Auto-remove after 3 seconds
        setTimeout(() => {
          this.transfers.delete(transferId);
        }, 3000);
      }
    }
  }

  // Handle transfer error
  handleError(transferId, error) {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.status = "error";
      this.transfers.delete(transferId);
      alert(`Transfer failed: ${error}`);
    }
  }

  // Get all transfers
  getTransfers() {
    return Array.from(this.transfers.values());
  }

  // Check if has active transfers
  hasActiveTransfers() {
    return this.transfers.size > 0;
  }
}

export default TransferManager;