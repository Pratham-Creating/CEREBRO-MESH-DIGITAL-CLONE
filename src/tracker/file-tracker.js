import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';

export function createFileTracker({ paths, repository, logger = console }) {
  let watcher = null;
  const ignoredRoots = [
    path.resolve(process.cwd(), 'node_modules'),
    path.resolve(process.cwd(), 'work'),
  ].map((item) => item.toLowerCase());

  function shouldIgnore(filePath) {
    const normalized = path.resolve(filePath).toLowerCase();
    return ignoredRoots.some((root) => normalized === root || normalized.startsWith(`${root}${path.sep}`));
  }

  return {
    async start() {
      if (!paths.length) return;
      watcher = chokidar.watch(paths, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
        ignored: (filePath) => shouldIgnore(filePath) || filePath.includes(`${path.sep}.git${path.sep}`),
      });
      const handle = async (action, filePath) => {
        try {
          const resolvedPath = path.resolve(filePath);
          const extension = path.extname(filePath).toLowerCase() || null;
          let content = null;
          if (action !== 'deleted') {
            try {
              const stat = await fs.stat(resolvedPath);
              if (stat.isFile() && stat.size < 1024 * 1024) { // Only read files < 1MB
                // Try reading as utf8, it might be binary but JSON stringify will handle it (or corrupt it, which is fine for simple text extraction)
                content = await fs.readFile(resolvedPath, 'utf8');
              }
            } catch (e) { /* ignore read errors */ }
          }
          
          await repository.recordEvent({
            occurredAt: new Date(), type: `file_${action}`, appName: null, windowTitle: null, processId: null,
            data: { path: resolvedPath, extension, content },
          });
        } catch (error) { logger.error('file event write failed', error); }
      };
      watcher.on('add', (filePath) => handle('created', filePath));
      watcher.on('change', (filePath) => handle('modified', filePath));
      watcher.on('unlink', (filePath) => handle('deleted', filePath));
      watcher.on('error', (error) => logger.error('file watcher failed', error));
    },
    async stop() { if (watcher) await watcher.close(); watcher = null; },
  };
}
