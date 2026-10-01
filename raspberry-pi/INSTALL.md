# Game Arcade on a Raspberry Pi: installation manual

This guide turns a Raspberry Pi into a small game server for your home network. Once it's set up, any phone, tablet, laptop or TV browser on the same Wi-Fi can open the arcade. You can also plug a screen and a USB controller into the Pi itself and play on it directly.

The installer (`install.sh`) sets up everything the Pi needs:

- **nginx**, the web server that hands the game to browsers;
- **the game files**, copied to `/var/www/game-arcade`;
- **port 5180**, opened in the firewall so other devices can reach it (SSH stays open too);
- **start on boot**, so the arcade comes back by itself after a restart;
- **kiosk mode** (optional), which opens the arcade full-screen on the Pi's own display at login.

---

## 1. What you need

| Item | Notes |
| --- | --- |
| Raspberry Pi | Pi 3B+, 4 or 5 recommended. A Pi Zero 2 W works as a server, but it's too slow to *play* on. |
| microSD card | 16 GB or larger. |
| Power supply | The official one for your model. Underpowered Pis crash at random. |
| Network | Wi-Fi or Ethernet on the same network as the devices you'll play on. |
| A Windows PC | Used to prepare the SD card and (recommended) to build the game. |
| Optional | HDMI screen, keyboard, mouse, USB NES-style controller for playing on the Pi itself. |

## 2. Prepare the Raspberry Pi

If your Pi already runs Raspberry Pi OS and you can log in to it, skip to [step 3](#3-get-the-game-onto-the-pi).

1. On the PC, install **Raspberry Pi Imager** from <https://www.raspberrypi.com/software/>.
2. Insert the microSD card and open Imager.
   - **Device:** your Pi model.
   - **Operating system:** *Raspberry Pi OS (64-bit)*. Pick the version *with desktop* if you want to play on the Pi's own screen. The *Lite* version is fine for a server only.
   - **Storage:** the microSD card.
3. Click **Next**, then **Edit settings** when asked about OS customisation:
   - **General tab:** set the hostname to `raspberrypi` (or anything you like; it's used in the address later). Choose a username and password, and enter your Wi-Fi name and password if you aren't using Ethernet. Set your locale and time zone.
   - **Services tab:** tick **Enable SSH** and choose *Use password authentication*.
4. Click **Save**, then **Yes** to write the card. Wait for it to finish and verify.
5. Put the card in the Pi and power it on. The first boot takes a couple of minutes.
6. Check you can reach it from the PC. Open PowerShell and run (with your own username and hostname):

   ```
   ssh pi@raspberrypi.local
   ```

   Type `yes` the first time, then your password. You're now at the Pi's command line. Type `exit` to leave.

   > If `raspberrypi.local` isn't found, look up the Pi's IP address in your router's device list and use that instead, for example `ssh pi@192.168.1.42`.

## 3. Get the game onto the Pi

There are two ways. **Option A is recommended**: the game is built on your PC in seconds, and the Pi only needs nginx. Building on the Pi itself (option B) works, but it installs Node.js and can take 10 minutes or more.

### Option A: build on the PC, copy a bundle (recommended)

The PC needs [Node.js](https://nodejs.org/) (LTS) and the game's source folder. In PowerShell, from the game's folder:

```
.\raspberry-pi\make-bundle.ps1 -PiHost pi@raspberrypi.local -Install
```

That single command:

1. builds the game;
2. packages it as `raspberry-pi\game-arcade-pi.tar.gz`;
3. copies it to the Pi;
4. unpacks it to `~/game-arcade-pi`;
5. runs the installer. It asks for the Pi's password twice, once for copying and once for `sudo`.

When it prints **Done!**, skip to [step 5](#5-play).

If you'd rather copy the files yourself, run `.\raspberry-pi\make-bundle.ps1` without `-PiHost`. That just creates `raspberry-pi\game-arcade-pi.tar.gz`. Get it onto the Pi any way you like (a USB stick, WinSCP, or `scp raspberry-pi\game-arcade-pi.tar.gz pi@raspberrypi.local:~/`). Then continue with [step 4](#4-run-the-installer).

> If PowerShell refuses to run the script ("running scripts is disabled"), run it like this instead:
> `powershell -ExecutionPolicy Bypass -File .\raspberry-pi\make-bundle.ps1`

### Option B: build on the Pi from source

Copy the **whole game folder** (everything except `node_modules` and `dist`) to the Pi, for example into `~/Game`. The installer finds the source one level above the `raspberry-pi` folder. It installs Node.js (version 18 or newer; from NodeSource if the OS's version is too old), then runs `npm ci` and `npm run build` as your user.

Then run the installer from `~/Game/raspberry-pi` as described in step 4. Allow plenty of time. A Pi 3 needs at least 1 GB of free memory, so close the desktop browser while it builds.

## 4. Run the installer

On the Pi (over `ssh` or in a terminal window), go to the folder and run the installer:

```
tar -xzf ~/game-arcade-pi.tar.gz -C ~      # only if you copied the .tar.gz yourself
cd ~/game-arcade-pi                         # or ~/Game/raspberry-pi for option B
sudo bash install.sh
```

These options can be combined:

| Option | What it does |
| --- | --- |
| `--port 8080` | Serve on a different port (default **5180**). Use `--port 80` to drop the port from the address. |
| `--kiosk` | Also open the arcade full-screen on the Pi's own screen every time you log in to the desktop. |
| `--no-firewall` | Leave the firewall alone (if you manage it yourself). |

Example: `sudo bash install.sh --kiosk`

When it finishes, it prints the addresses to use, for example:

```
==> Done! The Game Arcade is running.
  On the Pi:            http://localhost:5180/
  From other devices:   http://raspberrypi.local:5180/
                        http://192.168.1.42:5180/
```

### About the firewall

Raspberry Pi OS doesn't turn on a firewall by default. The installer installs **ufw** and adds two rules, *allow SSH (port 22)* and *allow port 5180*, then switches ufw on, so the Pi only accepts those two. If the Pi runs **firewalld** instead, the installer adds the port there and leaves the rest alone. You can see the rules with `sudo ufw status`.

The arcade is meant for your **home network**. Don't forward port 5180 on your router to the internet.

## 5. Play

- **From another device:** open a browser (Chrome, Edge, Firefox, Safari) and go to `http://raspberrypi.local:5180/`, or use the IP address the installer printed. Some Android phones and older TVs don't understand `.local` names, so use the IP address there.
- **On the Pi itself:** open Chromium from the desktop and go to `http://localhost:5180/`. With `--kiosk`, it opens full-screen by itself after login. **Alt+F4** closes it, and **F11** toggles full-screen in a normal window.
- **Controllers:** plug a USB NES-style pad into whichever device is running the browser, and press a button. If the buttons are mixed up, press **C** on the arcade screen (or **Select** on the pad) to open *Controller setup*.
- **Saves** (Underrealm heroes, uploaded dungeon packs, controller layouts) are stored in each browser, not on the Pi. A hero made on the laptop won't show up on the phone.

**Tip:** give the Pi a fixed address so the link never changes. Most routers call this a *DHCP reservation*: find the Pi in the router's device list and reserve its current IP.

## 6. Updating to a new version

From the PC, run the same command again:

```
.\raspberry-pi\make-bundle.ps1 -PiHost pi@raspberrypi.local -Install
```

Or copy a new `game-arcade-pi.tar.gz` over and re-run `sudo bash install.sh`. The installer replaces the game files and keeps your settings. Players may need to refresh the page (Ctrl+F5) to pick up the new version.

## 7. Everyday commands (on the Pi)

| To... | Run |
| --- | --- |
| Check the web server is running | `systemctl status nginx` |
| Restart it | `sudo systemctl restart nginx` |
| See the firewall rules | `sudo ufw status` |
| Find the Pi's IP address | `hostname -I` |
| See web server errors | `sudo tail -n 50 /var/log/nginx/error.log` |
| Turn kiosk mode off | `rm ~/.config/autostart/game-arcade-kiosk.desktop` |
| Shut the Pi down safely | `sudo shutdown now` |

## 8. Troubleshooting

**"This site can't be reached" from another device**

- Test on the Pi itself first: `curl -I http://localhost:5180/` should say `HTTP/1.1 200 OK`. If it doesn't, re-run the installer and read its output.
- Make sure both devices are on the same network. Guest Wi-Fi networks often block device-to-device traffic.
- Try the IP address instead of `raspberrypi.local`.
- Check that the port is allowed: `sudo ufw status` should list `5180/tcp ALLOW`.

**`bash: install.sh: /usr/bin/env: bad interpreter` or `$'\r': command not found`**

The script picked up Windows line endings, which happens if it was copied or edited on Windows without going through `make-bundle.ps1`. Fix it on the Pi with `sed -i 's/\r$//' install.sh uninstall.sh`, then run it again.

**The build (option B) stops with "JavaScript heap out of memory" or the Pi freezes**

The Pi ran out of memory. Use option A instead, or add swap space: `sudo dphys-swapfile swapoff`, then edit `/etc/dphys-swapfile` and set `CONF_SWAPSIZE=2048`, then `sudo dphys-swapfile setup && sudo dphys-swapfile swapon`.

**Port 5180 is already used by something else**

Re-run with another port: `sudo bash install.sh --port 8080`. Remove the old firewall rule with `sudo ufw delete allow 5180/tcp`.

**No sound**

Browsers only play sound after you click, tap or press a key on the page, so press something on the title screen. On the Pi, check the output device by right-clicking the speaker icon on the desktop taskbar.

**Games are slow on the Pi's own screen**

The 3D games (Turbo Kart, The Underrealm) are heavy for a Pi 3. A Pi 4 or 5 handles them much better. Close other programs, and use the Pi's full-screen browser rather than a small window. Playing on another device while the Pi only serves the game always runs smoothly.

## 9. Uninstalling

```
cd ~/game-arcade-pi
sudo bash uninstall.sh
```

This removes the game, its nginx site, its firewall rule and the kiosk autostart. nginx, ufw and Node.js stay installed; remove them with `sudo apt remove nginx ufw nodejs` if nothing else needs them.
