#!/bin/bash
# Run this script on your Ubuntu server in /home/ubuntu/retro/
# Usage: bash setup.sh

set -e

mkdir -p web roms

cat > web/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NES Game Player</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #1a1a2e;
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
        }
        .header {
            background: #16213e;
            padding: 20px;
            text-align: center;
            border-bottom: 3px solid #e94560;
        }
        .header h1 { color: #e94560; font-size: 2em; }
        .header p { color: #888; margin-top: 5px; }
        .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
        .game-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px; margin-top: 20px;
        }
        .game-card {
            background: #16213e; border: 1px solid #0f3460;
            border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.2s;
        }
        .game-card:hover { border-color: #e94560; transform: translateY(-2px); }
        .game-card h3 { color: #e94560; margin-bottom: 5px; }
        .game-card p { color: #888; font-size: 0.9em; }
        .upload-section {
            background: #16213e; border: 2px dashed #0f3460;
            border-radius: 8px; padding: 30px; text-align: center; margin-bottom: 20px;
        }
        .upload-section h2 { margin-bottom: 10px; }
        .btn {
            background: #e94560; color: white; border: none;
            padding: 10px 25px; border-radius: 5px; cursor: pointer; font-size: 1em;
        }
        .btn:hover { background: #c73652; }
        #player-container {
            display: none; position: fixed; top: 0; left: 0;
            width: 100%; height: 100%; background: #000; z-index: 1000;
        }
        #close-btn {
            position: fixed; top: 10px; right: 10px; z-index: 1001;
            background: #e94560; color: white; border: none;
            padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 1em;
        }
        .no-games { text-align: center; padding: 40px; color: #888; }
        .instructions {
            background: #16213e; border-radius: 8px; padding: 20px;
            margin-top: 20px; line-height: 1.8;
        }
        .instructions code {
            background: #0f3460; padding: 2px 6px; border-radius: 3px; color: #e94560;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>&#127918; NES Game Player</h1>
        <p>Powered by EmulatorJS</p>
    </div>
    <div class="container">
        <div class="upload-section">
            <h2>Quick Play</h2>
            <p>Select a .nes ROM file from your computer to play instantly</p>
            <br>
            <input type="file" id="rom-upload" accept=".nes,.zip,.7z">
            <br><br>
            <button class="btn" onclick="playUploadedRom()">Play ROM</button>
        </div>
        <h2>&#128193; Server ROMs</h2>
        <p style="color: #888; margin-top: 5px;">Place .nes files in the <code>roms/</code> folder on the server</p>
        <div id="game-list" class="game-list">
            <div class="no-games">Loading...</div>
        </div>
        <div class="instructions">
            <h3>&#128203; How to Add Games</h3>
            <p>Place <code>.nes</code> ROM files in the <code>roms/</code> directory, then edit <code>roms/index.json</code></p>
        </div>
    </div>
    <div id="player-container">
        <button id="close-btn" onclick="closePlayer()">✕ Close</button>
        <div id="game" style="width:100%;height:100%;"></div>
    </div>
    <script>
        async function loadGameList() {
            const container = document.getElementById('game-list');
            try {
                const resp = await fetch('roms/index.json');
                if (!resp.ok) throw new Error('No index.json');
                const games = await resp.json();
                if (games.length === 0) throw new Error('Empty');
                container.innerHTML = '';
                games.forEach(game => {
                    const card = document.createElement('div');
                    card.className = 'game-card';
                    card.innerHTML = '<h3>' + game.name + '</h3><p>Click to play</p>';
                    card.onclick = () => launchGame('roms/' + game.file);
                    container.appendChild(card);
                });
            } catch (e) {
                container.innerHTML = '<div class="no-games"><p>No server ROMs found. Use Quick Play above.</p></div>';
            }
        }
        function playUploadedRom() {
            const fileInput = document.getElementById('rom-upload');
            if (!fileInput.files.length) { alert('Please select a .nes ROM file first'); return; }
            const url = URL.createObjectURL(fileInput.files[0]);
            launchGame(url);
        }
        function launchGame(romUrl) {
            document.getElementById('player-container').style.display = 'block';
            document.getElementById('game').innerHTML = '';
            window.EJS_player = '#game';
            window.EJS_gameUrl = romUrl;
            window.EJS_core = 'nes';
            window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
            const old = document.getElementById('ejs-script');
            if (old) old.remove();
            const s = document.createElement('script');
            s.id = 'ejs-script';
            s.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
            document.body.appendChild(s);
        }
        function closePlayer() {
            document.getElementById('player-container').style.display = 'none';
            document.getElementById('game').innerHTML = '';
            delete window.EJS_player; delete window.EJS_gameUrl; delete window.EJS_core;
            location.reload();
        }
        loadGameList();
    </script>
</body>
</html>
HTMLEOF

cat > roms/index.json << 'JSONEOF'
[]
JSONEOF

cat > docker-compose.yml << 'YMLEOF'
services:
  emulatorjs:
    image: nginx:alpine
    container_name: emulatorjs
    ports:
      - 8080:80
    volumes:
      - ./web:/usr/share/nginx/html
      - ./roms:/usr/share/nginx/html/roms
    restart: unless-stopped
YMLEOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "Now run:  sudo docker compose up -d"
echo "Then open: http://$(hostname -I | awk '{print $1}'):8080"
echo ""