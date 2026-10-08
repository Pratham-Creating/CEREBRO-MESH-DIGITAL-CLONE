import screenshot from 'screenshot-desktop';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export class ScreenshotTracker {
  constructor({ repository, intervalMs = 10000, outDir, logger = console }) {
    this.repository = repository;
    this.intervalMs = intervalMs;
    this.outDir = outDir;
    this.logger = logger;
    this.timer = null;
    this.lastHash = null;
  }

  async start() {
    await fs.mkdir(this.outDir, { recursive: true });
    this.timer = setInterval(() => this.capture(), this.intervalMs);
  }

  async capture() {
    try {
      const imgBuffer = await screenshot();
      const hash = crypto.createHash('sha256').update(imgBuffer).digest('hex');

      if (hash === this.lastHash) {
        return; // Screen hasn't changed
      }
      this.lastHash = hash;

      const timestamp = new Date();
      const filename = `screen_${timestamp.getTime()}.png`;
      const filePath = path.join(this.outDir, filename);
      
      await fs.writeFile(filePath, imgBuffer);
      
      await this.repository.recordEvent({
        occurredAt: timestamp,
        type: 'screenshot',
        data: { path: filePath }
      });
    } catch (e) {
      this.logger.error('Screenshot failed', e.message);
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
  }
}
