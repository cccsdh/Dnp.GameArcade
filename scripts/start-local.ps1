<#
  Starts the game arcade locally in the browser - no Visual Studio needed, just Node.js.

  Installs npm packages on first run (or when package-lock.json changes), then
  starts the Vite dev server and opens the game in your default browser.

  Usage (from the repo root, or double-click scripts\start-local.cmd):
    .\scripts\start-local.ps1            # dev server with hot reload (http://localhost:5173)
    .\scripts\start-local.ps1 -Preview   # production build, served locally (http://localhost:4173)
    .\scripts\start-local.ps1 -Port 8080 # pick another port
    .\scripts\start-local.ps1 -NoOpen    # don't open a browser tab
  Press Ctrl+C to stop the server.
#>
param(
  [switch]$Preview,
  [int]$Port = 0,
  [switch]$NoOpen
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Push-Location $repo
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js was not found. Install the LTS version from https://nodejs.org/ and run this again.'
  }
  Write-Host "Node $(node --version)"

  # (Re)install packages when they're missing or package-lock.json is newer than the install.
  $marker = Join-Path $repo 'node_modules\.package-lock.json'
  $lock = Join-Path $repo 'package-lock.json'
  if (-not (Test-Path $marker) -or ((Get-Item $lock).LastWriteTime -gt (Get-Item $marker).LastWriteTime)) {
    Write-Host 'Installing packages...'
    npm install
    if ($LASTEXITCODE) { throw 'npm install failed' }
  }

  $viteArgs = @()
  if ($Port) { $viteArgs += @('--port', $Port) }
  # Vite skips opening a browser when BROWSER=none.
  if ($NoOpen) { $env:BROWSER = 'none' } else { $viteArgs += '--open' }

  if ($Preview) {
    npm run build
    if ($LASTEXITCODE) { throw 'npm run build failed' }
    Write-Host 'Serving the production build. Press Ctrl+C to stop.'
    npx vite preview @viteArgs
  } else {
    Write-Host 'Starting the dev server (edits reload instantly). Press Ctrl+C to stop.'
    npx vite @viteArgs
  }
} finally {
  Pop-Location
}
