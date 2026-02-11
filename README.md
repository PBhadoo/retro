# EmulatorJS NES Player - Ubuntu 24 (amd64)

The `linuxserver/emulatorjs` image does **not support linux/amd64**. This setup uses **nginx + EmulatorJS CDN** instead, which works on any architecture.

## Quick Start

```bash
# Start the container
sudo docker compose up -d
```

Open **http://YOUR_SERVER_IP:8080** in a browser.

## Playing Games

### Option 1: Upload from Browser (easiest)
1. Open `http://YOUR_SERVER_IP:8080`
2. Use the **Quick Play** section to select a `.nes` file from your computer
3. Click **Play ROM**

### Option 2: Host ROMs on the Server
1. Place `.nes` files in the `roms/` directory:
   ```bash
   cp MyGame.nes ./roms/
   ```
2. Edit `roms/index.json` to list your games:
   ```json
   [
     { "name": "Super Mario Bros", "file": "super-mario-bros.nes" },
     { "name": "Contra", "file": "contra.nes" }
   ]
   ```
3. The games will appear on the web page automatically (refresh the page).

## Firewall

```bash
sudo ufw allow 8080/tcp
```

## File Structure

```
.
├── docker-compose.yml
├── web/
│   └── index.html          # Game launcher page
└── roms/
    ├── index.json           # Game list (edit this)
    └── YourGame.nes         # ROM files go here
```

## Troubleshooting

```bash
# Check container status
sudo docker compose ps

# View logs
sudo docker compose logs -f

# Restart
sudo docker compose restart

# Stop
sudo docker compose down