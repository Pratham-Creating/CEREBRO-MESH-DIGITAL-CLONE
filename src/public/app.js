const $ = (selector) => document.querySelector(selector);
const range = $('#range');
const type = $('#eventType');

// Navigation
document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    $(link.getAttribute('href')).classList.add('active');
  });
});

function dateRange() {
  if (range.value === 'all') return {};
  const from = new Date();
  if (range.value === 'today') from.setHours(0, 0, 0, 0); else from.setDate(from.getDate() - 7);
  return { from: from.toISOString() };
}
function query(values) { const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value)); return params.toString() ? `?${params}` : ''; }
function duration(value) { const seconds = Math.round(Number(value || 0) / 1000); if (seconds < 60) return `${seconds}s`; if (seconds < 3600) return `${Math.floor(seconds / 60)}m`; return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`; }
function displayTime(value) { return new Date(`${value.replace(' ', 'T')}Z`).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function escape(value = '') { const node = document.createElement('span'); node.textContent = String(value); return node.innerHTML; }
function detail(event) { if (event.type.startsWith('file_')) return event.data?.path || 'File system event'; if (event.type === 'clipboard_changed') return `${event.data?.kind || 'clipboard'} · ${event.data?.length || 0} characters`; if (event.type.startsWith('idle_')) return `Idle for ${duration(event.data?.idleMs)}`; return event.windowTitle || 'No window title'; }

async function load() {
  const filters = { ...dateRange(), type: type.value, limit: 100 };
  try {
    const [health, dashboard, events] = await Promise.all([
      fetch('/api/health').then((r) => r.json()), fetch(`/api/dashboard${query(dateRange())}`).then((r) => r.json()), fetch(`/api/events${query(filters)}`).then((r) => r.json()),
    ]);
    $('#status').textContent = health.tracker.running ? `Recording every ${health.tracker.pollIntervalMs / 1000}s` : 'Tracker stopped';
    const totalEvents = dashboard.counts.reduce((sum, row) => sum + Number(row.count), 0);
    
    const metricsHtml = `
      <div class="metric-card glass-card"><span>Tracked apps</span><strong>${dashboard.apps.length}</strong></div>
      <div class="metric-card glass-card"><span>Events</span><strong>${totalEvents}</strong></div>
      <div class="metric-card glass-card"><span>Status</span><strong>${health.tracker.running ? 'Active' : 'Offline'}</strong></div>
    `;
    $('#metrics').innerHTML = metricsHtml;

    const max = Math.max(...dashboard.apps.map((app) => Number(app.durationMs)), 1);
    $('#apps').innerHTML = dashboard.apps.length ? dashboard.apps.map((app) => `<div class="bar-line"><span title="${escape(app.appName)}">${escape(app.appName)}</span><div class="track"><div class="fill" style="width:${Math.max(3, Number(app.durationMs) / max * 100)}%"></div></div><span class="duration">${duration(app.durationMs)}</span></div>`).join('') : '<p class="empty" style="color:var(--text-muted)">No completed sessions yet.</p>';
    
    $('#events').innerHTML = events.events.length ? events.events.map((event) => `<tr><td>${displayTime(event.occurredAt)}</td><td><span class="type">${escape(event.type)}</span></td><td>${escape(event.appName || '—')}</td><td class="detail" title="${escape(detail(event))}">${escape(detail(event))}</td></tr>`).join('') : '<tr><td colspan="4">No matching events.</td></tr>';
  } catch(e) {
    $('#status').textContent = `Error: ${e.message}`;
  }
}

// Chat logic
const chatForm = $('#chat-form');
const chatInput = $('#chat-input');
const chatMessages = $('#chat-messages');

function addMessage(text, isUser = false) {
  const msg = document.createElement('div');
  msg.className = `message ${isUser ? 'user' : 'system'}`;
  msg.innerHTML = `
    <div class="avatar">
      ${isUser 
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
      }
    </div>
    <div class="text"></div>
  `;
  // Use innerText for text safely instead of innerHTML to avoid XSS (except for BR tags)
  if (!isUser) {
    msg.querySelector('.text').innerHTML = text.replace(/\\n/g, '<br>');
  } else {
    msg.querySelector('.text').innerText = text;
  }
  
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = chatInput.value.trim();
  if (!query) return;
  
  addMessage(query, true);
  chatInput.value = '';
  
  const loadingId = 'loading-' + Date.now();
  const msg = document.createElement('div');
  msg.id = loadingId;
  msg.className = 'message system';
  msg.innerHTML = `
    <div class="avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
    <div class="text" style="color:var(--text-muted)">Thinking...</div>
  `;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    document.getElementById(loadingId).remove();
    addMessage(data.answer || data.error || 'Something went wrong.');
  } catch(err) {
    document.getElementById(loadingId).remove();
    addMessage('Error connecting to CEREBRO core.');
  }
});

$('#refresh').addEventListener('click', load); 
range.addEventListener('change', load); 
type.addEventListener('change', load);
load();
setInterval(load, 15_000);
