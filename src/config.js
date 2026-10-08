import 'dotenv/config';

function list(value = '') {
  return value.split(';').map((item) => item.trim()).filter(Boolean);
}

const clipboardCapture = process.env.CLIPBOARD_CAPTURE || 'metadata';
if (!['none', 'metadata', 'text'].includes(clipboardCapture)) {
  throw new Error('CLIPBOARD_CAPTURE must be none, metadata, or text');
}

export const config = {
  port: Number(process.env.PORT || 3210),
  pollIntervalMs: Math.max(Number(process.env.POLL_INTERVAL_MS || 2000), 500),
  watchPaths: list(process.env.WATCH_PATHS),
  clipboardCapture,
  excludedProcessNames: new Set(list(process.env.EXCLUDED_PROCESS_NAMES).map((name) => name.toLowerCase())),
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE || 'activity_tracker',
    user: process.env.MYSQL_USER || 'activity_app',
    password: process.env.MYSQL_PASSWORD || '',
  },
  geminiApiKey: process.env.GEMINI_API_KEY,
};
