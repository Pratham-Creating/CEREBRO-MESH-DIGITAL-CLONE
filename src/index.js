import { config } from './config.js';
import { createDatabase } from './db/database.js';
import { createRepository } from './db/repository.js';
import { createServer } from './server.js';
import { ActivityTracker } from './tracker/activity-tracker.js';
import { createFileTracker } from './tracker/file-tracker.js';
import { createSystemSampler } from './tracker/system-sampler.js';
import { InputTracker } from './tracker/input-tracker.js';
import { ScreenshotTracker } from './tracker/screenshot-tracker.js';
import path from 'node:path';

const db = createDatabase();
const repository = createRepository(db);
await db.migrate();

const tracker = new ActivityTracker({
  repository, sampler: createSystemSampler(), pollIntervalMs: config.pollIntervalMs,
  clipboardCapture: config.clipboardCapture, excludedProcessNames: config.excludedProcessNames,
});
const fileTracker = createFileTracker({ paths: config.watchPaths, repository });
const inputTracker = new InputTracker({ repository });
const screenshotTracker = new ScreenshotTracker({ 
  repository, 
  intervalMs: 10000, 
  outDir: path.resolve(process.cwd(), 'screenshots') 
});

await tracker.start();
await fileTracker.start();
await inputTracker.start();
await screenshotTracker.start();

const server = createServer({ db, config, repository, trackerStatus: () => ({
  running: tracker.running, pollIntervalMs: config.pollIntervalMs, clipboardCapture: config.clipboardCapture,
  watchedPaths: config.watchPaths.length,
}) });
server.listen(config.port, '127.0.0.1', () => {
  console.log(`Activity Tracker running at http://127.0.0.1:${config.port}`);
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: stopping activity tracker`);
  server.close();
  await Promise.allSettled([tracker.stop(), fileTracker.stop(), inputTracker.stop(), screenshotTracker.stop()]);
  await db.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
