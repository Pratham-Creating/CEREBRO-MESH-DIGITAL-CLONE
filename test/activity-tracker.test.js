import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityTracker } from '../src/tracker/activity-tracker.js';

function createRepository() {
  const events = [];
  const sessions = [];
  return {
    events, sessions,
    async recordEvent(event) { events.push(event); },
    async openWindowSession(snapshot) { sessions.push({ ...snapshot, id: sessions.length + 1 }); return sessions.length; },
    async closeWindowSession(id, endedAt) { sessions.find((session) => session.id === id).endedAt = endedAt; },
  };
}

test('records a window change and does not duplicate an unchanged snapshot', async () => {
  const repository = createRepository();
  const snapshots = [
    { appName: 'Code.exe', processId: 1, windowTitle: 'app.js', idleMs: 0, clipboard: { kind: 'empty' } },
    { appName: 'Code.exe', processId: 1, windowTitle: 'app.js', idleMs: 50, clipboard: { kind: 'empty' } },
    { appName: 'chrome.exe', processId: 2, windowTitle: 'Docs', idleMs: 0, clipboard: { kind: 'empty' } },
  ];
  const tracker = new ActivityTracker({ repository, sampler: async () => snapshots.shift(), pollIntervalMs: 1000, clipboardCapture: 'none', excludedProcessNames: new Set() });
  tracker.running = true;
  await tracker.tick(); await tracker.tick(); await tracker.tick();
  assert.equal(repository.sessions.length, 2);
  assert.equal(repository.sessions[0].endedAt instanceof Date, true);
  assert.deepEqual(repository.events.map((event) => event.type), ['window_focus', 'idle_ended', 'window_focus']);
});

test('stores only clipboard metadata by default', async () => {
  const repository = createRepository();
  const tracker = new ActivityTracker({
    repository,
    sampler: async () => ({ appName: 'Code.exe', processId: 1, windowTitle: 'draft', idleMs: 0, clipboard: { kind: 'text', text: 'do not store my secret' } }),
    pollIntervalMs: 1000, clipboardCapture: 'metadata', excludedProcessNames: new Set(),
  });
  tracker.running = true;
  await tracker.tick();
  const clipboard = repository.events.find((event) => event.type === 'clipboard_changed');
  assert.equal(clipboard.data.text, undefined);
  assert.equal(clipboard.data.length, 22);
  assert.match(clipboard.data.sha256, /^[a-f0-9]{64}$/);
});

test('redacts excluded applications', async () => {
  const repository = createRepository();
  const tracker = new ActivityTracker({
    repository,
    sampler: async () => ({ appName: 'KeePass.exe', processId: 9, windowTitle: 'Passwords', idleMs: 0, clipboard: { kind: 'text', text: 'secret' } }),
    pollIntervalMs: 1000, clipboardCapture: 'text', excludedProcessNames: new Set(['keepass.exe']),
  });
  tracker.running = true;
  await tracker.tick();
  assert.equal(repository.sessions[0].windowTitle, '[excluded application]');
  assert.equal(repository.events.some((event) => event.type === 'clipboard_changed'), false);
});
