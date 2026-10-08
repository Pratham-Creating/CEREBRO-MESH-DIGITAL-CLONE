import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askAgent } from './agent.js';

const publicDir = fileURLToPath(new URL('./public/', import.meta.url));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

export function createServer({ db, config, repository, trackerStatus }) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      
      if (request.method === 'POST' && url.pathname === '/api/ask') {
        let body = '';
        request.on('data', chunk => body += chunk.toString());
        request.on('end', async () => {
          try {
            const { query } = JSON.parse(body);
            const answer = await askAgent(db, query, config.geminiApiKey);
            sendJson(response, 200, { answer });
          } catch(e) {
            sendJson(response, 500, { error: e.message });
          }
        });
        return;
      }

      if (url.pathname === '/api/health') return sendJson(response, 200, { ok: true, tracker: trackerStatus() });
      if (url.pathname === '/api/events') {
        const events = await repository.listEvents({ limit: url.searchParams.get('limit'), type: url.searchParams.get('type'), from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        return sendJson(response, 200, { events });
      }
      if (url.pathname === '/api/sessions') {
        const sessions = await repository.listSessions({ limit: url.searchParams.get('limit'), from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        return sendJson(response, 200, { sessions });
      }
      if (url.pathname === '/api/dashboard') {
        const dashboard = await repository.dashboard({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        return sendJson(response, 200, dashboard);
      }
      const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const target = path.resolve(publicDir, requested);
      if (!target.startsWith(publicDir) || !contentTypes[path.extname(target)]) return sendJson(response, 404, { error: 'Not found' });
      const content = await fs.readFile(target);
      response.writeHead(200, { 'content-type': contentTypes[path.extname(target)], 'cache-control': 'no-store' });
      response.end(content);
    } catch (error) {
      if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'Not found' });
      console.error('request failed', error);
      return sendJson(response, 500, { error: 'Unexpected server error' });
    }
  });
}
