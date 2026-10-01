const { redact } = require('./redact');
const log = (level, message, data) => {
  if (level === 'DEBUG' && process.env.NODE_ENV === 'production') return;
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, message: redact(message), ...(data === undefined ? {} : { data: redact(data) }) }) + '\n';
  (level === 'ERROR' ? process.stderr : process.stdout).write(line);
};
module.exports = Object.fromEntries(['error', 'warn', 'info', 'debug'].map(level => [level, (message, data) => log(level.toUpperCase(), message, data)]));
