const api = window.electronAPI;
let games = [];

// ── DOM refs ─────────────────────────────────────────────────────────────
const enabledToggle       = document.getElementById('enabledToggle');
const groupName           = document.getElementById('groupName');
const messageTemplate     = document.getElementById('messageTemplate');
const cooldownMinutes     = document.getElementById('cooldownMinutes');
const notificationDelaySecs = document.getElementById('notificationDelaySecs');
const gamesList           = document.getElementById('gamesList');
const newGameName         = document.getElementById('newGameName');
const newGameExe          = document.getElementById('newGameExe');
const addGameBtn          = document.getElementById('addGameBtn');
const saveBtn             = document.getElementById('saveBtn');
const testBtn             = document.getElementById('testBtn');
const statusMsg           = document.getElementById('statusMsg');

// ── Load config ───────────────────────────────────────────────────────────
async function loadConfig() {
  const cfg = await api.getConfig();
  enabledToggle.checked       = cfg.enabled;
  groupName.value             = cfg.groupName || '';
  messageTemplate.value       = cfg.messageTemplate || '';
  cooldownMinutes.value       = cfg.cooldownMinutes ?? 30;
  notificationDelaySecs.value = cfg.notificationDelaySecs ?? 10;
  games = cfg.games || [];
  renderGamesList();
}

// ── Games list rendering ──────────────────────────────────────────────────
function renderGamesList() {
  gamesList.innerHTML = '';
  games.forEach((g, i) => {
    const item = document.createElement('div');
    item.className = 'game-item';
    item.innerHTML = `
      <span class="game-name">${escHtml(g.name)}</span>
      <span class="game-exe">${escHtml(g.executable)}</span>
      <button class="remove-btn" data-index="${i}" title="Remove">✕</button>
    `;
    gamesList.appendChild(item);
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

gamesList.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-btn');
  if (!btn) return;
  const idx = parseInt(btn.dataset.index, 10);
  games.splice(idx, 1);
  renderGamesList();
});

addGameBtn.addEventListener('click', () => {
  const name = newGameName.value.trim();
  const exe  = newGameExe.value.trim();
  if (!name || !exe) {
    showStatus('Enter both a game name and executable filename.', true);
    return;
  }
  if (games.some(g => g.executable.toLowerCase() === exe.toLowerCase())) {
    showStatus('That executable is already in the list.', true);
    return;
  }
  games.push({ name, executable: exe });
  renderGamesList();
  newGameName.value = '';
  newGameExe.value  = '';
  showStatus(`Added ${name}.`);
});

// Allow pressing Enter in the exe field to add
newGameExe.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addGameBtn.click();
});

// ── Save ──────────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  const cfg = {
    enabled:              enabledToggle.checked,
    groupName:            groupName.value.trim(),
    messageTemplate:      messageTemplate.value.trim(),
    cooldownMinutes:      parseInt(cooldownMinutes.value, 10) || 30,
    notificationDelaySecs: parseInt(notificationDelaySecs.value, 10) || 10,
    games,
  };

  if (!cfg.groupName) {
    showStatus('Group name cannot be empty.', true);
    return;
  }
  if (!cfg.messageTemplate.includes('{game}')) {
    showStatus('Tip: use {game} in the template to include the game name.', false);
  }

  const result = await api.saveConfig(cfg);
  if (result.ok) showStatus('Settings saved!');
  else showStatus('Failed to save.', true);
});

// ── Test send ─────────────────────────────────────────────────────────────
testBtn.addEventListener('click', async () => {
  const group   = groupName.value.trim() || 'Game on';
  const template = messageTemplate.value.trim() || 'Hey I am playing {game}, do you guys wanna hop in? 🎮';
  const message = template.replace(/{game}/gi, 'Test Game');

  testBtn.disabled = true;
  testBtn.textContent = 'Sending…';
  showStatus('Opening WhatsApp…');

  const result = await api.testSend({ groupName: group, message });

  testBtn.disabled = false;
  testBtn.textContent = 'Send Test Message';

  if (result.ok) {
    showStatus('Test message sent successfully!');
  } else {
    showStatus(`Error: ${result.error}`, true);
  }
});

// ── Status helper ─────────────────────────────────────────────────────────
let statusTimer = null;
function showStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg' + (isError ? ' error' : '');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusMsg.textContent = ''; }, 5000);
}

// ── Init ──────────────────────────────────────────────────────────────────
loadConfig();
