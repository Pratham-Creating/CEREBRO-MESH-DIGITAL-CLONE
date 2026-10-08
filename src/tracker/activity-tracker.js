import crypto from 'node:crypto';

function fingerprint(snapshot) {
  return [snapshot.appName || '', snapshot.processId || '', snapshot.windowTitle || ''].join('|');
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export class ActivityTracker {
  constructor({ repository, sampler, pollIntervalMs, clipboardCapture, excludedProcessNames, logger = console }) {
    this.repository = repository;
    this.sampler = sampler;
    this.pollIntervalMs = pollIntervalMs;
    this.clipboardCapture = clipboardCapture;
    this.excludedProcessNames = excludedProcessNames;
    this.logger = logger;
    this.timer = null;
    this.running = false;
    this.lastWindowFingerprint = null;
    this.currentSessionId = null;
    this.lastClipboardHash = null;
    this.lastNetworkHash = null;
    this.lastIdle = null;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this.tick();
    this.timer = setInterval(() => this.tick().catch((error) => this.logger.error('tracker tick failed', error)), this.pollIntervalMs);
  }

  async stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.currentSessionId) {
      await this.repository.closeWindowSession(this.currentSessionId, new Date());
      this.currentSessionId = null;
    }
  }

  async tick() {
    if (!this.running) return;
    const raw = await this.sampler();
    const at = new Date();
    const snapshot = { ...raw, at };
    const privateApp = raw.appName && this.excludedProcessNames.has(raw.appName.toLowerCase());
    await this.captureWindow(snapshot, privateApp);
    await this.captureIdle(snapshot, privateApp);
    await this.captureClipboard(snapshot, privateApp);
    await this.captureNetwork(snapshot, privateApp);
  }

  async captureWindow(snapshot, privateApp) {
    if (!snapshot.appName) return;
    const key = fingerprint(snapshot);
    if (key === this.lastWindowFingerprint) return;
    if (this.currentSessionId) await this.repository.closeWindowSession(this.currentSessionId, snapshot.at);
    this.lastWindowFingerprint = key;
    this.currentSessionId = await this.repository.openWindowSession({
      ...snapshot,
      windowTitle: privateApp ? '[excluded application]' : snapshot.windowTitle,
    });
    await this.repository.recordEvent({
      occurredAt: snapshot.at,
      type: 'window_focus',
      appName: snapshot.appName,
      windowTitle: privateApp ? '[excluded application]' : snapshot.windowTitle,
      processId: snapshot.processId,
      data: { source: 'foreground-window', excluded: Boolean(privateApp) },
    });
  }

  async captureIdle(snapshot, privateApp) {
    const isIdle = Number(snapshot.idleMs || 0) >= 60_000;
    if (isIdle === this.lastIdle) return;
    this.lastIdle = isIdle;
    await this.repository.recordEvent({
      occurredAt: snapshot.at,
      type: isIdle ? 'idle_started' : 'idle_ended',
      appName: snapshot.appName || null,
      windowTitle: privateApp ? '[excluded application]' : snapshot.windowTitle || null,
      processId: snapshot.processId || null,
      data: { idleMs: Number(snapshot.idleMs || 0) },
    });
  }

  async captureNetwork(snapshot, privateApp) {
    if (privateApp || !snapshot.network || snapshot.network.length === 0) return;
    
    const netHash = hash(JSON.stringify(snapshot.network));
    if (netHash === this.lastNetworkHash) return;
    this.lastNetworkHash = netHash;
    
    await this.repository.recordEvent({
      occurredAt: snapshot.at,
      type: 'network_activity',
      appName: snapshot.appName || null,
      windowTitle: snapshot.windowTitle || null,
      processId: snapshot.processId || null,
      data: { connections: snapshot.network }
    });
  }

  async captureClipboard(snapshot, privateApp) {
    if (this.clipboardCapture === 'none' || privateApp || !snapshot.clipboard || snapshot.clipboard.kind !== 'text') return;
    const text = String(snapshot.clipboard.text || '');
    const contentHash = hash(text);
    if (contentHash === this.lastClipboardHash) return;
    this.lastClipboardHash = contentHash;
    const data = { kind: 'text', length: text.length, sha256: contentHash };
    if (this.clipboardCapture === 'text') data.text = text.slice(0, 10_000);
    await this.repository.recordEvent({
      occurredAt: snapshot.at,
      type: 'clipboard_changed',
      appName: snapshot.appName || null,
      windowTitle: snapshot.windowTitle || null,
      processId: snapshot.processId || null,
      data,
    });
  }
}
