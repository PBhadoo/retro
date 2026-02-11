const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 80;
const ROMS_DIR = path.join(__dirname, 'roms');
const WEB_DIR = path.join(__dirname, 'web');
const INDEX_JSON = path.join(ROMS_DIR, 'index.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.nes': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': getMime(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });
}

function loadIndex() {
  try {
    const data = fs.readFileSync(INDEX_JSON, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveIndex(games) {
  fs.writeFileSync(INDEX_JSON, JSON.stringify(games, null, 2));
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Upload endpoint
  if (req.method === 'POST' && req.url === '/upload') {
    // Read the multipart form data
    const boundary = getBoundary(req.headers['content-type']);
    if (!boundary) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing boundary' }));
      return;
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = parseMultipart(buffer, boundary);

      const filePart = parts.find(p => p.filename && p.filename.endsWith('.nes'));
      if (!filePart) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No .nes file found in upload' }));
        return;
      }

      const filename = filePart.filename;
      const savePath = path.join(ROMS_DIR, filename);

      // Save the file
      fs.writeFileSync(savePath, filePart.data);

      // Update index.json - add to top of list
      const games = loadIndex();
      // Remove if already exists
      const filtered = games.filter(g => g.file !== filename);
      // Create display name from filename
      const displayName = filename.replace(/\.nes$/i, '').replace(/\s*\(.*?\)/g, '').trim();
      // Add to top
      filtered.unshift({ name: displayName, file: filename });
      saveIndex(filtered);

      console.log(`Uploaded: ${filename}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, name: displayName, file: filename }));
    });
    return;
  }

  // Static file serving
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Serve from roms/ if path starts with /roms/
  if (urlPath.startsWith('/roms/')) {
    const romPath = path.join(ROMS_DIR, urlPath.substring(6));
    serveFile(res, romPath);
    return;
  }

  // Serve from web/
  const webPath = path.join(WEB_DIR, urlPath);
  serveFile(res, webPath);
});

// Simple multipart parser
function getBoundary(contentType) {
  if (!contentType) return null;
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  return match ? (match[1] || match[2]) : null;
}

function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  const endBuf = Buffer.from('--' + boundary + '--');

  let start = indexOf(buffer, boundaryBuf, 0);
  if (start === -1) return parts;

  while (true) {
    start = start + boundaryBuf.length;
    // Skip CRLF after boundary
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;

    const nextBoundary = indexOf(buffer, boundaryBuf, start);
    if (nextBoundary === -1) break;

    const partData = buffer.slice(start, nextBoundary);

    // Find header/body separator (double CRLF)
    const headerEnd = indexOf(partData, Buffer.from('\r\n\r\n'), 0);
    if (headerEnd === -1) { start = nextBoundary; continue; }

    const headerStr = partData.slice(0, headerEnd).toString('utf8');
    // Body is after double CRLF, minus trailing CRLF before next boundary
    let body = partData.slice(headerEnd + 4);
    // Remove trailing CRLF
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.slice(0, body.length - 2);
    }

    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const nameMatch = headerStr.match(/name="([^"]+)"/);

    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      data: body,
    });

    // Check if next boundary is the end
    if (indexOf(buffer, endBuf, nextBoundary) === nextBoundary) break;
    start = nextBoundary;
  }

  return parts;
}

function indexOf(buf, search, from) {
  for (let i = from; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

server.listen(PORT, () => {
  console.log(`NES Game Server running on port ${PORT}`);
  console.log(`Serving web files from: ${WEB_DIR}`);
  console.log(`Serving ROMs from: ${ROMS_DIR}`);
});