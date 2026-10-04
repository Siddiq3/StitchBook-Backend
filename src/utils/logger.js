const { redact } = require('./redact');

const LEVELS = Object.freeze({ ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 });

const configuredLevel = () => {
  const fallback = process.env.NODE_ENV === 'production' ? 'WARN' : 'INFO';
  const requested = String(process.env.LOG_LEVEL || fallback).trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, requested) ? requested : fallback;
};

const log = (level, message, data) => {
  if (LEVELS[level] > LEVELS[configuredLevel()]) return;

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message: redact(message),
    ...(data === undefined ? {} : { data: redact(data) }),
  }) + '\n';

  (level === 'ERROR' ? process.stderr : process.stdout).write(line);
};

module.exports = Object.fromEntries(
  ['error', 'warn', 'info', 'debug'].map((level) => [
    level,
    (message, data) => log(level.toUpperCase(), message, data),
  ])
);
