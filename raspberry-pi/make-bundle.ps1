<#
  Builds the game on this PC and packages it for a Raspberry Pi:
  raspberry-pi\game-arcade-pi.tar.gz holds install.sh, uninstall.sh, INSTALL.md and a
  prebuilt game\ folder, so the Pi doesn't need Node.js or a slow build of its own.

  Usage (from the repo root):
    .\raspberry-pi\make-bundle.ps1                          # build + make the .tar.gz
    .\raspberry-pi\make-bundle.ps1 -SkipBuild               # package the current dist\ as-is
    .\raspberry-pi\make-bundle.ps1 -PiHost pi@raspberrypi.local           # ...and copy it to the Pi
    .\raspberry-pi\make-bundle.ps1 -PiHost pi@raspberrypi.local -Install  # ...and install it there
#>
param(
  [switch]$SkipBuild,
  [string]$PiHost = '',
  [switch]$Install,
  [int]$Port = 5180
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$repo = Split-Path $here -Parent

if (-not $SkipBuild) {
  Push-Location $repo
  try { npm run build; if ($LASTEXITCODE) { throw 'npm run build failed' } } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $repo 'dist\index.html'))) { throw 'dist\index.html missing - build first' }

# Stage: game-arcade-pi\{install.sh, uninstall.sh, INSTALL.md, game\...}
$stageRoot = Join-Path $env:TEMP 'game-arcade-pi-stage'
$stage = Join-Path $stageRoot 'game-arcade-pi'
if (Test-Path $stageRoot) { Remove-Item $stageRoot -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($f in 'install.sh', 'uninstall.sh') {
  # Shell scripts must have Unix line endings or bash on the Pi will choke on them.
  $text = [IO.File]::ReadAllText((Join-Path $here $f)) -replace "`r`n", "`n"
  [IO.File]::WriteAllText((Join-Path $stage $f), $text, (New-Object Text.UTF8Encoding $false))
}
Copy-Item (Join-Path $here 'INSTALL.md') $stage
Copy-Item (Join-Path $repo 'dist') (Join-Path $stage 'game') -Recurse
# Source maps are only for debugging and are most of the size.
Get-ChildItem (Join-Path $stage 'game') -Recurse -Filter *.map | Remove-Item

$bundle = Join-Path $here 'game-arcade-pi.tar.gz'
if (Test-Path $bundle) { Remove-Item $bundle }
tar -czf $bundle -C $stageRoot game-arcade-pi
if ($LASTEXITCODE) { throw 'tar failed' }
Remove-Item $stageRoot -Recurse -Force
$mb = [math]::Round((Get-Item $bundle).Length / 1MB, 1)
Write-Host "Bundle ready: $bundle ($mb MB)"

if ($PiHost) {
  Write-Host "Copying to ${PiHost}:~/"
  scp $bundle "${PiHost}:~/game-arcade-pi.tar.gz"
  if ($LASTEXITCODE) { throw 'scp failed' }
  $remote = 'rm -rf ~/game-arcade-pi && tar -xzf ~/game-arcade-pi.tar.gz -C ~ && echo Unpacked to ~/game-arcade-pi'
  if ($Install) { $remote += " && sudo bash ~/game-arcade-pi/install.sh --port $Port" }
  # -t gives sudo a terminal to ask for the Pi's password.
  ssh -t $PiHost $remote
  if ($LASTEXITCODE) { throw 'remote step failed' }
}
