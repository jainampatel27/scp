// DOM Elements
const hostInput = document.getElementById("host");
const portInput = document.getElementById("port");
const userInput = document.getElementById("username");
const passInput = document.getElementById("password");

// Sections
const serverSection = document.getElementById("serverSection");
const authSection = document.getElementById("authSection");

// Status Elements
const serverStatus = document.getElementById("serverStatus");
const authStatus = document.getElementById("authStatus");
const connectedHostEl = document.getElementById("connectedHost");

// Buttons
const checkConnectivityBtn = document.getElementById("checkConnectivityBtn");
const connectBtn = document.getElementById("connectBtn");
const backBtn = document.getElementById("backBtn");
const changeServerBtn = document.getElementById("changeServer");

// Step Indicators
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const stepLine = document.getElementById("stepLine");

// Session List
const sessionList = document.getElementById("sessionList");

// State
let currentHost = "";
let currentPort = 22;

// Load saved sessions from localStorage
function loadSavedSessions() {
  const sessions = JSON.parse(localStorage.getItem("sftpSessions") || "[]");
  
  if (sessions.length === 0) {
    sessionList.innerHTML = '<div class="empty-sessions">No saved sessions yet</div>';
    return;
  }
  
  sessionList.innerHTML = sessions.map((session, index) => `
    <div class="session-item" data-index="${index}">
      <div class="session-icon">
        <svg viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H8V5h7v2z"/>
        </svg>
      </div>
      <div class="session-info">
        <div class="session-name">${session.name || session.host}</div>
        <div class="session-host">${session.username}@${session.host}:${session.port}</div>
      </div>
      <svg class="session-arrow" viewBox="0 0 24 24">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
      </svg>
    </div>
  `).join("");
  
  // Add click handlers
  document.querySelectorAll(".session-item").forEach(item => {
    item.addEventListener("click", () => {
      const index = parseInt(item.dataset.index);
      const session = sessions[index];
      hostInput.value = session.host;
      portInput.value = session.port;
      userInput.value = session.username || "";
      checkConnectivity();
    });
  });
}

// Show status message
function showStatus(element, type, message) {
  element.className = `status-message ${type}`;
  
  let icon = "";
  if (type === "checking") {
    icon = '<div class="spinner"></div>';
  } else if (type === "success") {
    icon = '<svg class="status-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
  } else if (type === "error") {
    icon = '<svg class="status-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
  }
  
  element.innerHTML = `${icon}<span>${message}</span>`;
}

// Hide status message
function hideStatus(element) {
  element.className = "status-message hidden";
}

// Update step indicators
function setStep(step) {
  if (step === 1) {
    step1.className = "step active";
    step2.className = "step inactive";
    stepLine.className = "step-line";
    serverSection.classList.remove("hidden");
    authSection.classList.add("hidden");
  } else if (step === 2) {
    step1.className = "step completed";
    step1.innerHTML = '<svg style="width:16px;height:16px;fill:white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    step2.className = "step active";
    stepLine.className = "step-line active";
    serverSection.classList.add("hidden");
    authSection.classList.remove("hidden");
    connectedHostEl.textContent = `${currentHost}:${currentPort}`;
    userInput.focus();
  }
}

// Check connectivity
async function checkConnectivity() {
  const host = hostInput.value.trim();
  const port = Number(portInput.value.trim()) || 22;
  
  if (!host) {
    showStatus(serverStatus, "error", "Please enter a host or IP address");
    return;
  }
  
  currentHost = host;
  currentPort = port;
  
  showStatus(serverStatus, "checking", `Checking connectivity to ${host}:${port}...`);
  checkConnectivityBtn.disabled = true;
  
  window.api.checkConnectivity({ host, port });
}

// Check connectivity button
checkConnectivityBtn.addEventListener("click", checkConnectivity);

// Handle Enter key on host input
hostInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    checkConnectivity();
  }
});

// Back button
backBtn.addEventListener("click", () => {
  hideStatus(authStatus);
  step1.innerHTML = "1";
  setStep(1);
});

// Change server link
changeServerBtn.addEventListener("click", () => {
  hideStatus(authStatus);
  step1.innerHTML = "1";
  setStep(1);
});

// Connect button
connectBtn.addEventListener("click", () => {
  const username = userInput.value.trim();
  const password = passInput.value;
  
  if (!username) {
    showStatus(authStatus, "error", "Please enter a username");
    return;
  }
  
  if (!password) {
    showStatus(authStatus, "error", "Please enter a password");
    return;
  }
  
  const config = {
    host: currentHost,
    port: currentPort,
    username,
    password,
    path: "/"
  };
  
  showStatus(authStatus, "checking", "Authenticating and connecting...");
  connectBtn.disabled = true;
  
  window.api.sftpConnectAndList(config);
});

// Handle Enter key on password input
passInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    connectBtn.click();
  }
});

// Handle connectivity check result
window.api.onConnectivityResult((data) => {
  checkConnectivityBtn.disabled = false;
  
  if (data.ok) {
    showStatus(serverStatus, "success", `Server is reachable (${data.latency}ms)`);
    setTimeout(() => {
      hideStatus(serverStatus);
      setStep(2);
    }, 800);
  } else {
    showStatus(serverStatus, "error", `Connection failed: ${data.error}`);
  }
});

// Handle SFTP connection result
window.api.onSftpListResult((data) => {
  connectBtn.disabled = false;
  
  if (!data.ok) {
    showStatus(authStatus, "error", `Authentication failed: ${data.error}`);
    return;
  }
  
  // Save session
  saveSession(currentHost, currentPort, userInput.value.trim());
  
  showStatus(authStatus, "success", "Connected successfully! Opening file browser...");
  
  // Navigate to file browser with home path
  setTimeout(() => {
    window.api.navigateToBrowser(data.homePath || "/");
  }, 500);
});

// Save session to localStorage
function saveSession(host, port, username) {
  const sessions = JSON.parse(localStorage.getItem("sftpSessions") || "[]");
  
  // Check if session already exists
  const existingIndex = sessions.findIndex(s => s.host === host && s.port === port);
  
  const session = {
    host,
    port,
    username,
    name: host,
    lastUsed: Date.now()
  };
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session);
  }
  
  // Keep only last 5 sessions
  localStorage.setItem("sftpSessions", JSON.stringify(sessions.slice(0, 5)));
}

// Initialize
loadSavedSessions();
