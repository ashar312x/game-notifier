const { exec } = require('child_process');
const EventEmitter = require('events');
const config = require('./configManager');

const POLL_INTERVAL_MS = 5000;

class GameMonitor extends EventEmitter {
  constructor() {
    super();
    this.activeGames = new Map();   // executable → { name, detectedAt, notified }
    this.timer = null;
    this.initialized = false;
  }

  start() {
    this._poll(true);
    this.timer = setInterval(() => this._poll(false), POLL_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _poll(isInit) {
    exec('tasklist /FO CSV /NH', (err, stdout) => {
      if (err) return;

      const running = this._parseTasklist(stdout);
      const games = config.get('games') || [];

      // Detect games that just started
      for (const game of games) {
        const exe = game.executable.toLowerCase();
        const isRunning = running.has(exe);
        const wasActive = this.activeGames.has(exe);

        if (isRunning && !wasActive) {
          const entry = { name: game.name, detectedAt: Date.now(), notified: false };
          this.activeGames.set(exe, entry);

          if (!isInit) {
            const delaySecs = config.get('notificationDelaySecs') || 10;
            setTimeout(() => {
              // Re-check the game is still running before notifying
              if (this.activeGames.has(exe) && !this.activeGames.get(exe).notified) {
                this.activeGames.get(exe).notified = true;
                this.emit('gameStarted', { executable: exe, name: game.name });
              }
            }, delaySecs * 1000);
          }
        }

        if (!isRunning && wasActive) {
          this.activeGames.delete(exe);
          this.emit('gameStopped', { executable: exe, name: game.name });
        }
      }

      this.initialized = true;
    });
  }

  _parseTasklist(output) {
    const map = new Map();
    for (const line of output.trim().split('\n')) {
      const match = line.match(/^"([^"]+)"/);
      if (match) map.set(match[1].toLowerCase(), true);
    }
    return map;
  }
}

module.exports = new GameMonitor();
