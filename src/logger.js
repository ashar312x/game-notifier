const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const LOG_FILE = path.join('D:\\Projects\\game-notifier', 'debug.log');
const MAX_BUFFER = 200;

const emitter = new EventEmitter();
const recentLines = [];

// Clear log on each startup
try { fs.writeFileSync(LOG_FILE, `=== Game Notifier started at ${new Date().toISOString()} ===\n`); } catch {}

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
  recentLines.push(line);
  if (recentLines.length > MAX_BUFFER) recentLines.shift();
  emitter.emit('line', line);
}

module.exports = { log, LOG_FILE, emitter, recentLines };
