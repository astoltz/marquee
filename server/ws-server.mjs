// WebSocket Server for Marquee Sign Library
//
// Provides:
// - HTTP server for admin panel and static files
// - WebSocket server for real-time sign control
// - HTTP Basic Auth for admin routes
// - Viewer tracking and stats broadcasting

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Store } from './store.mjs';
import { Scheduler } from './scheduler.mjs';
import { ViewerTracker } from './viewer-tracker.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.WS_PORT || process.env.PORT || 8080;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'marquee';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Generate admin tokens
const adminTokens = new Set();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function checkBasicAuth(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) return false;
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

// State
const store = new Store();
const viewers = new ViewerTracker();

// Scheduler
const scheduler = new Scheduler(store, (name, sequence) => {
  console.log(`Schedule activated: ${name}`);
  if (sequence) {
    viewers.broadcast({ action: 'sequence', ...sequence }, 'viewer');
  }
});

// Stats broadcast interval
let statsTimer = null;

function broadcastStats() {
  const viewerCount = viewers.count('viewer');
  viewers.broadcast({ type: 'stats', viewers: viewerCount });
  // Also broadcast viewer count as a token update
  viewers.broadcast({
    action: 'tokenUpdate',
    tokens: { viewers: viewerCount },
  }, 'viewer');
}

// HTTP server
const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // Admin API routes
  if (url.startsWith('/api/admin/')) {
    if (!checkBasicAuth(req)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Marquee Admin"',
        'Content-Type': 'text/plain',
      });
      res.end('Unauthorized');
      return;
    }

    // Admin token generation
    if (url === '/api/admin/token' && req.method === 'POST') {
      const token = generateToken();
      adminTokens.add(token);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token }));
      return;
    }

    // Get all sequences
    if (url === '/api/admin/sequences' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(store.getSequences()));
      return;
    }

    // Save sequence
    if (url.startsWith('/api/admin/sequences/') && req.method === 'PUT') {
      const name = decodeURIComponent(url.slice('/api/admin/sequences/'.length));
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          store.setSequence(name, data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Delete sequence
    if (url.startsWith('/api/admin/sequences/') && req.method === 'DELETE') {
      const name = decodeURIComponent(url.slice('/api/admin/sequences/'.length));
      store.deleteSequence(name);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Get/set global config
    if (url === '/api/admin/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(store.getGlobalConfig()));
      return;
    }

    if (url === '/api/admin/config' && req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          store.setGlobalConfig(config);
          // Broadcast config to viewers
          viewers.broadcast({ action: 'config', ...config }, 'viewer');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Get/manage schedule
    if (url === '/api/admin/schedule' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(store.getSchedule()));
      return;
    }

    if (url === '/api/admin/schedule' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const entry = JSON.parse(body);
          const saved = store.addScheduleEntry(entry);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(saved));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.startsWith('/api/admin/schedule/') && req.method === 'DELETE') {
      const id = url.slice('/api/admin/schedule/'.length);
      store.removeScheduleEntry(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Viewers list
    if (url === '/api/admin/viewers' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(viewers.list()));
      return;
    }

    // Push to specific viewer or all
    if (url === '/api/admin/push' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.viewerId) {
            viewers.sendTo(data.viewerId, { action: 'sequence', ...data.sequence });
          } else {
            viewers.broadcast({ action: 'sequence', ...data.sequence }, 'viewer');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Admin panel
  if (url === '/admin' || url === '/admin/') {
    if (!checkBasicAuth(req)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Marquee Admin"',
        'Content-Type': 'text/plain',
      });
      res.end('Unauthorized');
      return;
    }
    url = '/admin/index.html';
  }

  // Static files
  if (url === '/') url = '/demo/index.html';

  const filePath = path.join(ROOT, url);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found: ' + url);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let viewerId = viewers.add(ws, 'viewer');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_e) {
      return;
    }

    // Registration
    if (msg.type === 'register') {
      const oldViewer = viewers.getByWs(ws);
      if (oldViewer) viewers.remove(oldViewer.id);

      if (msg.role === 'admin' && adminTokens.has(msg.token)) {
        viewerId = viewers.add(ws, 'admin', { token: msg.token });
      } else {
        viewerId = viewers.add(ws, msg.role || 'viewer', msg.metadata || {});
      }
      broadcastStats();
      return;
    }

    // Admin commands (require admin role)
    const viewer = viewers.get(viewerId);
    if (viewer && viewer.role === 'admin') {
      if (msg.type === 'admin:push') {
        if (msg.viewerId) {
          viewers.sendTo(msg.viewerId, { action: 'sequence', ...msg.sequence });
        } else {
          viewers.broadcast({ action: 'sequence', ...msg.sequence }, 'viewer');
        }
      } else if (msg.type === 'admin:schedule') {
        if (msg.entry) store.addScheduleEntry(msg.entry);
      } else if (msg.type === 'admin:config') {
        if (msg.config) {
          store.setGlobalConfig(msg.config);
          viewers.broadcast({ action: 'config', ...msg.config }, 'viewer');
        }
      } else if (msg.type === 'admin:activate') {
        if (msg.sequence) {
          store.setActiveSequence(msg.sequence);
          const seq = store.getSequence(msg.sequence);
          if (seq) {
            viewers.broadcast({ action: 'sequence', ...seq }, 'viewer');
          }
        }
      }
    }
  });

  ws.on('close', () => {
    viewers.removeByWs(ws);
    broadcastStats();
  });

  // Send current active sequence to new viewer
  const active = store.getActiveSequence();
  if (active) {
    ws.send(JSON.stringify({ action: 'sequence', ...active }));
  }

  broadcastStats();
});

// Start
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Marquee WebSocket server running on http://0.0.0.0:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`Admin credentials: ${ADMIN_USER}/${ADMIN_PASS}`);
  scheduler.start();
  statsTimer = setInterval(broadcastStats, 30000);
});
