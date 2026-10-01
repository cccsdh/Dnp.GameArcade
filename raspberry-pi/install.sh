#!/usr/bin/env bash
#
# Installs the Game Arcade on a Raspberry Pi (Raspberry Pi OS / Debian / Ubuntu).
#
#   - installs nginx (and Node.js, only if it has to build the game itself)
#   - copies the game to /var/www/game-arcade and serves it on port 5180
#   - opens that port in the firewall (ufw or firewalld)
#   - optionally starts Chromium full-screen on the Pi's own display at login
#
# Usage (from this folder):
#   sudo bash install.sh                 # install, or update to a newer build
#   sudo bash install.sh --port 8080     # serve on another port
#   sudo bash install.sh --kiosk         # also open the arcade full-screen on the Pi at login
#   sudo bash install.sh --no-firewall   # don't touch the firewall
#
# Where the game comes from, in order:
#   1. ./game/           a prebuilt copy (made on a PC by make-bundle.ps1) - fastest
#   2. ../package.json   the full source tree: Node.js is installed and the game is built here
#
# Safe to run again: re-running replaces the game files and keeps everything else.
set -euo pipefail

APP=game-arcade
PORT=5180
KIOSK=0
FIREWALL=1
WEB_ROOT=/var/www/$APP
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:?--port needs a number}"; shift 2 ;;
    --kiosk) KIOSK=1; shift ;;
    --no-firewall) FIREWALL=0; shift ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
  esac
done

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31mxx %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this with sudo:  sudo bash install.sh $*"
case "$PORT" in ''|*[!0-9]*) die "Port must be a number, got '$PORT'" ;; esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || die "Port must be 1-65535"
command -v apt-get >/dev/null || die "This installer needs a Debian-based OS (Raspberry Pi OS, Debian, Ubuntu)."

# The desktop user (for kiosk mode) is whoever ran sudo.
DESK_USER="${SUDO_USER:-}"
[ "$DESK_USER" = root ] && DESK_USER=""

export DEBIAN_FRONTEND=noninteractive
say "Updating package lists"
apt-get update -q

say "Installing nginx"
apt-get install -y -q nginx curl ca-certificates

# --- Get the game files -----------------------------------------------------------
STAGE=""
if [ -f "$HERE/game/index.html" ]; then
  say "Using the prebuilt game in $HERE/game"
  STAGE="$HERE/game"
elif [ -f "$HERE/../package.json" ]; then
  SRC="$(cd "$HERE/.." && pwd)"
  say "No prebuilt game found - building from source in $SRC"
  need_node=1
  if command -v node >/dev/null; then
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 18 ] && need_node=0
  fi
  if [ "$need_node" -eq 1 ]; then
    say "Installing Node.js"
    apt-get install -y -q nodejs npm
    major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "$major" -lt 18 ]; then
      say "The OS's Node.js is too old ($major); installing Node.js 20 from NodeSource"
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y -q nodejs
    fi
  fi
  echo "Node $(node --version), npm $(npm --version)"
  # Build as the normal user so node_modules/ and dist/ aren't owned by root.
  BUILD_USER="${DESK_USER:-root}"
  say "Installing packages and building (this can take several minutes on a Pi)"
  sudo -u "$BUILD_USER" env NODE_OPTIONS=--max-old-space-size=1024 bash -c "cd '$SRC' && npm ci --no-audit --no-fund && npm run build"
  STAGE="$SRC/dist"
  [ -f "$STAGE/index.html" ] || die "The build did not produce dist/index.html"
else
  die "No game files found. Put a prebuilt copy in $HERE/game (see INSTALL.md), or run this from inside the full source folder."
fi

say "Copying the game to $WEB_ROOT"
mkdir -p "$WEB_ROOT"
find "$WEB_ROOT" -mindepth 1 -delete
cp -a "$STAGE"/. "$WEB_ROOT"/
chown -R www-data:www-data "$WEB_ROOT"
chmod -R a+rX "$WEB_ROOT"

# --- nginx site ------------------------------------------------------------------------
say "Configuring nginx on port $PORT"
cat > /etc/nginx/sites-available/$APP <<EOF
# Game Arcade - written by raspberry-pi/install.sh
server {
    listen $PORT;
    listen [::]:$PORT;
    server_name _;
    root $WEB_ROOT;
    index index.html;

    gzip on;
    gzip_types application/javascript application/json text/css image/svg+xml audio/wav;

    location / { try_files \$uri \$uri/ /index.html; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location /dungeons/ { add_header Cache-Control "no-cache"; }
    location /assets/ { expires 7d; }
}
EOF
ln -sf /etc/nginx/sites-available/$APP /etc/nginx/sites-enabled/$APP
# The stock "Welcome to nginx" site also sits on port 80; leave it unless it clashes.
if [ "$PORT" = 80 ] && [ -e /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl enable nginx >/dev/null
systemctl restart nginx

# --- Firewall ---------------------------------------------------------------------------
if [ "$FIREWALL" -eq 1 ]; then
  if command -v firewall-cmd >/dev/null && systemctl is-active --quiet firewalld; then
    say "Opening port $PORT/tcp in firewalld"
    firewall-cmd --permanent --add-port="$PORT/tcp"
    firewall-cmd --reload
  else
    say "Opening port $PORT/tcp in ufw"
    apt-get install -y -q ufw
    # Always keep SSH reachable before turning the firewall on, so a headless Pi can't lock you out.
    ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp
    ufw allow "$PORT/tcp" comment "Game Arcade"
    ufw --force enable
    ufw status verbose | sed -n '1,20p'
  fi
else
  warn "Skipping the firewall (--no-firewall). Make sure port $PORT/tcp is reachable."
fi

# --- Kiosk mode (optional) -------------------------------------------------------------
if [ "$KIOSK" -eq 1 ]; then
  if [ -z "$DESK_USER" ]; then
    warn "Kiosk mode needs to know your desktop user - run with sudo from that user's account. Skipped."
  else
    say "Setting up kiosk mode for user $DESK_USER"
    if ! command -v chromium-browser >/dev/null && ! command -v chromium >/dev/null; then
      apt-get install -y -q chromium-browser || apt-get install -y -q chromium
    fi
    BROWSER_BIN="$(command -v chromium-browser || command -v chromium)"
    HOME_DIR="$(getent passwd "$DESK_USER" | cut -d: -f6)"
    mkdir -p "$HOME_DIR/.config/autostart"
    cat > "$HOME_DIR/.config/autostart/$APP-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Game Arcade (kiosk)
Comment=Opens the Game Arcade full-screen at login (remove this file to stop it)
Exec=sh -c 'sleep 5; $BROWSER_BIN --kiosk --noerrdialogs --disable-infobars --no-first-run --password-store=basic --autoplay-policy=no-user-gesture-required http://localhost:$PORT/'
X-GNOME-Autostart-enabled=true
EOF
    chown -R "$DESK_USER":"$DESK_USER" "$HOME_DIR/.config/autostart"
    echo "The arcade will open full-screen the next time $DESK_USER logs in to the desktop (Alt+F4 closes it)."
  fi
fi

# --- Check it's up -------------------------------------------------------------------------
say "Checking the server"
code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" || true)"
[ "$code" = 200 ] || die "nginx answered HTTP '$code' on port $PORT - see: sudo journalctl -u nginx"

IPS="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' || true)"
say "Done! The Game Arcade is running."
echo "  On the Pi:            http://localhost:$PORT/"
echo "  From other devices:   http://$(hostname).local:$PORT/"
for ip in $IPS; do echo "                        http://$ip:$PORT/"; done
echo
echo "It starts automatically on boot. To update, copy a new game/ folder here and run this script again."
