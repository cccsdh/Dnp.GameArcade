#!/usr/bin/env bash
#
# Removes the Game Arcade from a Raspberry Pi: the nginx site, the game files,
# the firewall rule and the kiosk autostart. nginx, Node.js and ufw themselves
# stay installed (other things may use them).
#
# Usage:  sudo bash uninstall.sh [--port 5180]
set -euo pipefail

APP=game-arcade
PORT=5180
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:?--port needs a number}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
[ "$(id -u)" -eq 0 ] || { echo "Run this with sudo:  sudo bash uninstall.sh" >&2; exit 1; }

rm -f /etc/nginx/sites-enabled/$APP /etc/nginx/sites-available/$APP
rm -rf /var/www/$APP
if command -v nginx >/dev/null; then nginx -t && systemctl reload nginx || true; fi

if command -v firewall-cmd >/dev/null && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --remove-port="$PORT/tcp" || true
  firewall-cmd --reload || true
elif command -v ufw >/dev/null; then
  ufw delete allow "$PORT/tcp" || true
fi

if [ -n "${SUDO_USER:-}" ]; then
  HOME_DIR="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
  rm -f "$HOME_DIR/.config/autostart/$APP-kiosk.desktop"
fi

echo "Game Arcade removed."
