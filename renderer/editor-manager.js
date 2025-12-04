// editor-manager.js - Handles file editing functionality

class EditorManager {
  constructor(fileManager, transferManager, uiManager) {
    this.fileManager = fileManager;
    this.transferManager = transferManager;
    this.uiManager = uiManager;
  }

  // Open editor for a file in a new window
  openEditor(fileName) {
    const filePath = this.fileManager.getFullPath(fileName);
    
    // Open file in new editor window
    window.api.openFileInEditor({
      name: fileName,
      path: filePath
    });
  }
}

export default EditorManager;