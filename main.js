const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');

// Keep single instance
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let tray = null;
let settingsWin = null;
let config, gameMonitor, automator;

// Track cooldowns: gameName → last notified timestamp
const cooldowns = new Map();

function createSettingsWindow() {
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: false,
    title: 'Game Notifier — Settings',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  settingsWin.on('closed', () => { settingsWin = null; });
}

function buildTrayMenu() {
  const enabled = config.get('enabled');
  return Menu.buildFromTemplate([
    { label: '🎮 Game Notifier', enabled: false },
    { type: 'separator' },
    {
      label: enabled ? '✅ Enabled' : '⬜ Disabled',
      click: () => {
        config.set('enabled', !config.get('enabled'));
        tray.setContextMenu(buildTrayMenu());
      },
    },
    { label: 'Settings…', click: createSettingsWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

async function handleGameStarted(game) {
  if (!config.get('enabled')) return;

  const cooldownMs = (config.get('cooldownMinutes') || 30) * 60 * 1000;
  const lastNotified = cooldowns.get(game.name) || 0;
  if (Date.now() - lastNotified < cooldownMs) return;

  cooldowns.set(game.name, Date.now());

  const template = config.get('messageTemplate') || 'Hey I am playing {game}, do you guys wanna hop in? 🎮';
  const message = template.replace(/{game}/gi, game.name);
  const groupName = config.get('groupName') || 'Game on';

  // Desktop notification so the user knows what's happening
  new Notification({
    title: 'Game Notifier',
    body: `Sending WhatsApp notification for ${game.name}…`,
    icon: path.join(__dirname, 'assets', 'icon.png'),
  }).show();

  try {
    await automator.sendMessage(groupName, message);
    new Notification({
      title: 'Game Notifier',
      body: `✅ Message sent to "${groupName}"`,
      icon: path.join(__dirname, 'assets', 'icon.png'),
    }).show();
  } catch (err) {
    console.error('WhatsApp automation failed:', err.message);
    new Notification({
      title: 'Game Notifier — Error',
      body: `Failed to send message: ${err.message}`,
      icon: path.join(__dirname, 'assets', 'icon.png'),
    }).show();
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────

ipcMain.handle('config:get-all', () => config.all());

ipcMain.handle('config:save', (_e, partial) => {
  config.update(partial);
  if (tray) tray.setContextMenu(buildTrayMenu());
  return { ok: true };
});

ipcMain.handle('test:send', async (_e, { groupName, message }) => {
  try {
    await automator.sendMessage(groupName, message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Lazy-require after app is ready so configManager can call app.getPath()
  config = require('./src/configManager');
  gameMonitor = require('./src/gameMonitor');
  automator = require('./src/whatsappAutomator');

  config.load();

  // Tray icon
  let icon;
  try {
    icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Game Notifier');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', createSettingsWindow);

  // Start monitoring
  gameMonitor.on('gameStarted', handleGameStarted);
  gameMonitor.start();

  // Open settings on first launch if group is still default
  if (config.get('groupName') === 'Game on') {
    createSettingsWindow();
  }
});

app.on('second-instance', () => {
  createSettingsWindow();
});

// Prevent app from quitting when all windows are closed (stay in tray)
app.on('window-all-closed', (e) => {
  e.preventDefault();
});
