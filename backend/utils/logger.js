const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logStream = fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' });

function logError(context, error) {
    const msg = `[${new Date().toISOString()}] [${context}] ${error.message}\n${error.stack || ''}\n`;
    console.error(msg.trim());
    logStream.write(msg);
}

function logInfo(message) {
    const msg = `[${new Date().toISOString()}] [INFO] ${message}\n`;
    console.log(msg.trim());
    logStream.write(msg);
}

process.on('exit', () => logStream.end());
process.on('SIGINT', () => { logStream.end(); process.exit(0); });

module.exports = { logError, logInfo };
