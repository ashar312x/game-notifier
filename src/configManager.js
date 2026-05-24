const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_GAMES = [
  { executable: 'cs2.exe', name: 'Counter-Strike 2' },
  { executable: 'csgo.exe', name: 'CS:GO' },
  { executable: 'VALORANT-Win64-Shipping.exe', name: 'Valorant' },
  { executable: 'FortniteClient-Win64-Shipping.exe', name: 'Fortnite' },
  { executable: 'GTA5.exe', name: 'GTA V' },
  { executable: 'r5apex.exe', name: 'Apex Legends' },
  { executable: 'League of Legends.exe', name: 'League of Legends' },
  { executable: 'dota2.exe', name: 'Dota 2' },
  { executable: 'RainbowSix.exe', name: 'Rainbow Six Siege' },
  { executable: 'TslGame.exe', name: 'PUBG' },
  { executable: 'RocketLeague.exe', name: 'Rocket League' },
  { executable: 'Overwatch.exe', name: 'Overwatch 2' },
  { executable: 'EscapeFromTarkov.exe', name: 'Escape from Tarkov' },
  { executable: 'Warzone.exe', name: 'Call of Duty: Warzone' },
  { executable: 'destiny2.exe', name: 'Destiny 2' },
  { executable: 'eldenring.exe', name: 'Elden Ring' },
  { executable: 'Cyberpunk2077.exe', name: 'Cyberpunk 2077' },
  { executable: 'minecraft.exe', name: 'Minecraft' },
  { executable: 'javaw.exe', name: 'Minecraft (Java)' },
];

const DEFAULTS = {
  enabled: true,
  groupName: 'Game on',
  messageTemplate: 'Hey I am playing {game}, do you guys wanna hop in? 🎮',
  cooldownMinutes: 30,
  notificationDelaySecs: 10,
  games: DEFAULT_GAMES,
};

class ConfigManager {
  constructor() {
    this._configPath = null;
    this._data = null;
  }

  get configPath() {
    if (!this._configPath) {
      this._configPath = path.join(app.getPath('userData'), 'config.json');
    }
    return this._configPath;
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        this._data = { ...DEFAULTS, ...JSON.parse(raw) };
      } else {
        this._data = { ...DEFAULTS };
        this.save();
      }
    } catch {
      this._data = { ...DEFAULTS };
    }
    return this._data;
  }

  get(key) {
    if (!this._data) this.load();
    return this._data[key];
  }

  set(key, value) {
    if (!this._data) this.load();
    this._data[key] = value;
    this.save();
  }

  update(partial) {
    if (!this._data) this.load();
    Object.assign(this._data, partial);
    this.save();
  }

  all() {
    if (!this._data) this.load();
    return { ...this._data };
  }

  save() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this._data, null, 2), 'utf8');
  }
}

module.exports = new ConfigManager();
