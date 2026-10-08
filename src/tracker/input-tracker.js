import { uIOhook } from 'uiohook-napi';

export class InputTracker {
  constructor({ repository, logger = console }) {
    this.repository = repository;
    this.logger = logger;
    this.eventsBuffer = [];
    this.flushInterval = null;
    this.lastMouseMove = 0;
  }

  start() {
    uIOhook.on('keydown', (e) => this.bufferEvent({ type: 'keydown', keycode: e.keycode, time: Date.now() }));
    uIOhook.on('keyup', (e) => this.bufferEvent({ type: 'keyup', keycode: e.keycode, time: Date.now() }));
    uIOhook.on('mousedown', (e) => this.bufferEvent({ type: 'mousedown', button: e.button, x: e.x, y: e.y, time: Date.now() }));
    uIOhook.on('mouseup', (e) => this.bufferEvent({ type: 'mouseup', button: e.button, x: e.x, y: e.y, time: Date.now() }));
    uIOhook.on('mousemove', (e) => {
      const last = this.lastMouseMove;
      if (!last || (Date.now() - last > 100)) { // 100ms throttle
        this.bufferEvent({ type: 'mousemove', x: e.x, y: e.y, time: Date.now() });
        this.lastMouseMove = Date.now();
      }
    });

    uIOhook.start();
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  bufferEvent(evt) {
    this.eventsBuffer.push(evt);
  }

  async flush() {
    if (this.eventsBuffer.length === 0) return;
    const batch = [...this.eventsBuffer];
    this.eventsBuffer = [];
    try {
      await this.repository.recordEvent({
        occurredAt: new Date(),
        type: 'input_batch',
        data: batch
      });
    } catch (e) {
      this.logger.error('Failed to save input batch', e);
    }
  }

  async stop() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    uIOhook.stop();
    await this.flush();
  }
}
