import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Request counter for the dynamic endpoint
let requestCount = 0;

// Fun rotating messages for the dynamic endpoint
const DYNAMIC_MESSAGES = [
  'THE TIME IS {time}',
  'REQUEST #{count}',
  'SERVER UPTIME {uptime}',
  'HELLO FROM THE SERVER',
  '{time} - REFRESH #{count}',
  'LIVE UPDATE #{count}',
];

const DYNAMIC_COLORS = [
  '#ff3300', '#00cc00', '#ffaa00', '#0066ff',
  '#ff0066', '#00cc99', '#ffff00', '#9900cc',
];

const startTime = Date.now();

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function buildDynamicSequence() {
  requestCount++;
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const uptime = formatUptime(Date.now() - startTime);

  // Pick two messages for a two-step sequence
  const msg1idx = (requestCount - 1) % DYNAMIC_MESSAGES.length;
  const msg2idx = requestCount % DYNAMIC_MESSAGES.length;
  const color1 = DYNAMIC_COLORS[(requestCount - 1) % DYNAMIC_COLORS.length];
  const color2 = DYNAMIC_COLORS[requestCount % DYNAMIC_COLORS.length];

  function fillTemplate(tpl) {
    return tpl
      .replace('{time}', time)
      .replace('{count}', String(requestCount))
      .replace('{uptime}', uptime);
  }

  return {
    options: { loop: true },
    sequence: [
      {
        text: fillTemplate(DYNAMIC_MESSAGES[msg1idx]),
        phase: 'scroll-left',
        color: color1,
        until: 'center',
        speed: 100,
      },
      { phase: 'pause', duration: 2500 },
      { phase: 'fade-out', duration: 400 },
      {
        text: fillTemplate(DYNAMIC_MESSAGES[msg2idx]),
        phase: 'fade-in',
        color: color2,
        duration: 600,
      },
      { phase: 'pause', duration: 2500 },
      { phase: 'fade-out', duration: 400 },
    ],
  };
}

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // Dynamic JSON endpoint — returns a fresh sequence with timestamp + counter
  if (url === '/api/sign.json') {
    const data = JSON.stringify(buildDynamicSequence());
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(data);
    return;
  }

  if (url === '/') url = '/demo/index.html';

  // Resolve file path
  let filePath = path.join(__dirname, url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
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

    // No-cache for JSON files (so polling picks up changes)
    const headers = { 'Content-Type': mime };
    if (ext === '.json') {
      headers['Cache-Control'] = 'no-store';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Marquee demo server running on http://0.0.0.0:${PORT}`);
  console.log(`Open http://localhost:${PORT} or http://<your-ip>:${PORT}`);
  console.log(`Dynamic JSON endpoint: http://localhost:${PORT}/api/sign.json`);
});
