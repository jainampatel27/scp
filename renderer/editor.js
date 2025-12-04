// Editor Page Script

// DOM Elements
const editor = document.getElementById("editor");
const lineNumbers = document.getElementById("lineNumbers");
const fileNameEl = document.getElementById("fileName");
const filePathEl = document.getElementById("filePath");
const fileInfoEl = document.getElementById("fileInfo");
const modifiedIndicator = document.getElementById("modifiedIndicator");
const saveBtn = document.getElementById("saveBtn");
const cursorPosition = document.getElementById("cursorPosition");

// State
let filePath = "";
let originalContent = "";
let isModified = false;
let isSaving = false;

// Initialize
async function init() {
  // Get file info from main process
  const fileInfo = await window.api.getEditorFileInfo();
  
  if (!fileInfo) {
    editor.value = "Error: No file information provided";
    editor.classList.add("error");
    return;
  }
  
  filePath = fileInfo.path;
  fileNameEl.textContent = fileInfo.name;
  filePathEl.textContent = filePath;
  
  // Load file content
  loadFileContent();
}

// Load file content
async function loadFileContent() {
  editor.classList.add("loading");
  editor.value = "Loading...";
  
  try {
    const content = await window.api.readFile(filePath);
    originalContent = content;
    editor.value = content;
    editor.classList.remove("loading");
    
    // Update file info
    const lines = content.split("\n").length;
    const size = new Blob([content]).size;
    fileInfoEl.textContent = `${lines} lines, ${formatSize(size)}`;
    
    // Update line numbers
    updateLineNumbers();
    
    // Reset modified state
    setModified(false);
  } catch (err) {
    editor.value = `Error loading file: ${err.message}`;
    editor.classList.remove("loading");
    editor.classList.add("error");
  }
}

// Format file size
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

// Update line numbers
function updateLineNumbers() {
  const lines = editor.value.split("\n");
  const lineCount = lines.length;
  
  let html = "";
  for (let i = 1; i <= lineCount; i++) {
    html += `<div class="line-number">${i}</div>`;
  }
  
  lineNumbers.innerHTML = html;
}

// Set modified state
function setModified(modified) {
  isModified = modified;
  
  if (modified) {
    modifiedIndicator.classList.remove("hidden");
    document.title = `• ${fileNameEl.textContent}`;
  } else {
    modifiedIndicator.classList.add("hidden");
    document.title = fileNameEl.textContent;
  }
}

// Save file
async function saveFile() {
  if (isSaving || !isModified) return;
  
  isSaving = true;
  saveBtn.disabled = true;
  saveBtn.classList.add("saving");
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
    </svg>
    Saving...
  `;
  
  try {
    await window.api.writeFile(filePath, editor.value);
    originalContent = editor.value;
    setModified(false);
    
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
      Saved!
    `;
    
    setTimeout(() => {
      saveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
        </svg>
        Save
      `;
      saveBtn.classList.remove("saving");
    }, 1500);
  } catch (err) {
    alert(`Error saving file: ${err.message}`);
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
      </svg>
      Save
    `;
    saveBtn.classList.remove("saving");
  }
  
  isSaving = false;
  saveBtn.disabled = false;
}

// Update cursor position
function updateCursorPosition() {
  const text = editor.value.substring(0, editor.selectionStart);
  const lines = text.split("\n");
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  
  cursorPosition.textContent = `Ln ${line}, Col ${col}`;
}

// Sync scroll between line numbers and editor
function syncScroll() {
  lineNumbers.scrollTop = editor.scrollTop;
}

// Event Listeners

// Editor input
editor.addEventListener("input", () => {
  updateLineNumbers();
  
  if (editor.value !== originalContent) {
    setModified(true);
  } else {
    setModified(false);
  }
});

// Cursor position update
editor.addEventListener("click", updateCursorPosition);
editor.addEventListener("keyup", updateCursorPosition);
editor.addEventListener("select", updateCursorPosition);

// Scroll sync
editor.addEventListener("scroll", syncScroll);

// Save button
saveBtn.addEventListener("click", saveFile);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Cmd/Ctrl + S to save
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveFile();
  }
  
  // Tab to insert spaces/tab
  if (e.key === "Tab" && document.activeElement === editor) {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    
    editor.value = editor.value.substring(0, start) + "\t" + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 1;
    
    updateLineNumbers();
    setModified(true);
  }
});

// Warn before closing if modified
window.addEventListener("beforeunload", (e) => {
  if (isModified) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// Initialize
init();
