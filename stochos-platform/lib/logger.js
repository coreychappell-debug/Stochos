const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'observability.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeLog(level, message, meta = {}) {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({
    timestamp,
    level,
    message,
    ...meta
  });

  // Write to Node.js server console with formatting
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [${level}] ${message}`, meta);
  } else if (level === 'WARN') {
    console.warn(`[${timestamp}] [${level}] ${message}`, meta);
  } else {
    console.log(`[${timestamp}] [${level}] ${message}`, meta);
  }

  // Append to the local log file
  try {
    fs.appendFileSync(LOG_FILE, logEntry + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

module.exports = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
};
