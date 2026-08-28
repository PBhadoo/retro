# NES Game Player

A self-hosted retro NES game player powered by EmulatorJS, with password authentication, ROM upload, and automatic HTTPS via Caddy.

## Features

- **Browser-based NES emulator** — play games directly in your browser
- **Password protected** — simple password auth (no username required)
- **Upload & Play** — upload `.nes` ROMs through the web UI, saved permanently on the server
- **Searchable game library** — instant search filtering across all games
- **Configurable keyboard controls** — sensible keyboard defaults for desktop play, remappable per-button from the in-page Settings menu
- **Alphabetical listing** — games sorted A-Z in a clean row-based layout
- **Lazy loading** — shows 50 games at a time, loads more on scroll
- **Automatic HTTPS** — Caddy reverse proxy with free Let's Encrypt SSL
- **Docker-based** — single `docker compose up -d` to run everything

## Quick Start

### 1. Prerequisites (Ubuntu 24)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in
```

### 2. Clone and Deploy

```bash
git clone https://github.com/PBhadoo/retro.git
cd retro
```

### 3. Configure Domain (Optional)

Edit `Caddyfile` and replace the placeholder with your domain:

```
retro.yourdomain.com {
    reverse_proxy emulatorjs:80
}
```

For IP-only access (no domain), keep the default:

```
:80, :443 {
    reverse_proxy emulatorjs:80
}
```

### 4. Start

```bash
sudo docker compose up -d
```

### 5. Open

- **With domain:** `https://retro.yourdomain.com`
- **Without domain:** `http://YOUR_SERVER_IP`

**Password:** `bhadoo`

## Usage

### Playing Games
1. Enter the password on the login page
2. Browse the game library or use the search bar
3. Click any game to play instantly in your browser

### Uploading New Games
1. Click **Upload & Play** to upload and immediately play a `.nes` ROM
2. Click **Upload Only** to save a ROM to the server without playing
3. Uploaded games appear at the top of `index.json` and are sorted alphabetically on the page

## File Structure

```
.
├── docker-compose.yml      # Docker services (Node.js app + Caddy)
├── Caddyfile               # Caddy reverse proxy config (HTTPS)
├── server.js               # Node.js server (auth, upload, static files)
├── web/
│   └── index.html          # Game player frontend
└── roms/
    ├── index.json           # Game list (auto-updated on upload)
    └── *.nes                # ROM files
```

## Architecture

- **Caddy** — reverse proxy on ports 80/443, handles HTTPS/SSL automatically
- **Node.js** — internal HTTP server serving the web UI, handling uploads, and managing ROMs
- **EmulatorJS** — loaded from CDN (`cdn.emulatorjs.org`), runs the NES emulator in the browser

## Configuration

| Setting | Location | Default |
|---------|----------|---------|
| Password | `server.js` → `PASSWORD` | `bhadoo` |
| Games per page | `web/index.html` → `PAGE_SIZE` | `50` |
| Domain | `Caddyfile` | `:80, :443` |
| External ports | `docker-compose.yml` | `80, 443` |

## Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Management

```bash
# View logs
sudo docker compose logs -f

# Restart
sudo docker compose restart

# Stop
sudo docker compose down

# Rebuild after changes
sudo docker compose down && sudo docker compose up -d
```

## Logout

Visit `/logout` to clear your session.

---

Built and Hosted by Parveen Bhadoo ❤