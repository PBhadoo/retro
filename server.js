const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 80;
const ROMS_DIR = path.join(__dirname, 'roms');
const WEB_DIR = path.join(__dirname, 'web');
const INDEX_JSON = path.join(ROMS_DIR, 'index.json');

// Password auth config
const PASSWORD = 'bhadoo';
const AUTH_TOKEN = crypto.createHash('sha256').update(PASSWORD + '_retro_auth').digest('hex');
const COOKIE_NAME = 'retro_auth';

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

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [key, val] = c.trim().split('=');
    if (key && val) cookies[key] = val;
  });
  return cookies;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] === AUTH_TOKEN;
}

function serveLoginPage(res, errorMsg) {
  const error = errorMsg ? `<p class="error">${errorMsg}</p>` : '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NES Game Player - Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #1a1a2e;
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-box {
            background: #16213e;
            border: 1px solid #0f3460;
            border-radius: 12px;
            padding: 40px;
            width: 350px;
            text-align: center;
        }
        .login-box h1 {
            color: #e94560;
            font-size: 1.8em;
            margin-bottom: 5px;
        }
        .login-box .subtitle {
            color: #888;
            margin-bottom: 25px;
        }
        .login-box input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 1px solid #0f3460;
            border-radius: 6px;
            background: #1a1a2e;
            color: #e0e0e0;
            font-size: 1em;
            margin-bottom: 15px;
            text-align: center;
        }
        .login-box input[type="password"]:focus {
            outline: none;
            border-color: #e94560;
        }
        .login-box button {
            width: 100%;
            padding: 12px;
            background: #e94560;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1em;
            cursor: pointer;
        }
        .login-box button:hover {
            background: #c73652;
        }
        .error {
            color: #e94560;
            margin-bottom: 15px;
            font-size: 0.9em;
        }
        footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            text-align: center;
            padding: 15px;
            color: #888;
            font-size: 0.9em;
        }
        footer .heart { color: #e94560; }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>&#127918; NES Player</h1>
        <p class="subtitle">Enter password to continue</p>
        ${error}
        <form method="POST" action="/login">
            <input type="password" name="password" placeholder="Password" autofocus required>
            <button type="submit">Enter</button>
        </form>
    </div>
    <footer>Built and Hosted by Parveen Bhadoo <span class="heart">&#10084;</span></footer>
</body>
</html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function parseFormBody(buffer) {
  const str = buffer.toString('utf8');
  const params = {};
  str.split('&').forEach(pair => {
    const [key, val] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent((val || '').replace(/\+/g, ' '));
  });
  return params;
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

  // Login endpoint
  if (req.method === 'POST' && req.url === '/login') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = parseFormBody(Buffer.concat(chunks));
      if (body.password === PASSWORD) {
        res.writeHead(302, {
          'Set-Cookie': `${COOKIE_NAME}=${AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`,
          'Location': '/'
        });
        res.end();
      } else {
        serveLoginPage(res, 'Wrong password. Try again.');
      }
    });
    return;
  }

  // Logout endpoint
  if (req.url === '/logout') {
    res.writeHead(302, {
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`,
      'Location': '/'
    });
    res.end();
    return;
  }

  // Check auth for all other routes
  if (!isAuthenticated(req)) {
    serveLoginPage(res);
    return;
  }

  // Upload endpoint
  if (req.method === 'POST' && req.url === '/upload') {
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
      const filtered = games.filter(g => g.file !== filename);
      const displayName = filename.replace(/\.nes$/i, '').replace(/\s*\(.*?\)/g, '').trim();
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
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;

    const nextBoundary = indexOf(buffer, boundaryBuf, start);
    if (nextBoundary === -1) break;

    const partData = buffer.slice(start, nextBoundary);

    const headerEnd = indexOf(partData, Buffer.from('\r\n\r\n'), 0);
    if (headerEnd === -1) { start = nextBoundary; continue; }

    const headerStr = partData.slice(0, headerEnd).toString('utf8');
    let body = partData.slice(headerEnd + 4);
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
  console.log('Password auth enabled');
});