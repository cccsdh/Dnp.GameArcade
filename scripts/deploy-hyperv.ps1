<#
  Deploys the built game (dist/) to an Ubuntu 24.04 Hyper-V VM, served by nginx on port 5180.

  First run creates the VM from the cached Ubuntu cloud image (cloud-init seed disk).
  Later runs just rebuild and push dist/ to the existing VM.

  Usage (elevated PowerShell, from the repo root):
    .\scripts\deploy-hyperv.ps1            # build + deploy (creates VM if missing)
    .\scripts\deploy-hyperv.ps1 -SkipBuild # deploy the current dist/ as-is
#>
param(
  [string]$VMName = 'game-arcade',
  [int]$Port = 5180,
  [string]$VMRoot = 'D:\HyperV',
  [string]$CloudImage = 'D:\HyperV\images\noble-server-cloudimg-amd64.img',
  [string]$Switch = 'Default Switch',
  [string]$WslDistro = 'Ubuntu-24.04',
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$vmDir = Join-Path $VMRoot $VMName
$key = Join-Path $vmDir 'id_ed25519'
$knownHosts = Join-Path $vmDir 'known_hosts'
$user = 'game'
$sshOpts = @('-i', $key, '-o', "UserKnownHostsFile=$knownHosts", '-o', 'StrictHostKeyChecking=accept-new',
             '-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes')

function Write-Lf([string]$path, [string]$text) {
  [IO.File]::WriteAllText($path, ($text -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding $false))
}

function Get-VMIp {
  $nic = Get-VMNetworkAdapter -VMName $VMName
  $ip = $nic.IPAddresses | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1
  if ($ip) { return $ip }
  # Fallback before the Hyper-V KVP daemon is up: match the VM's MAC in the host ARP table.
  $mac = ($nic.MacAddress -replace '(..)(?!$)', '$1-')
  (Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.LinkLayerAddress -eq $mac -and $_.State -ne 'Unreachable' } |
    Select-Object -First 1).IPAddress
}

function New-GameVM {
  Write-Host "Creating VM $VMName in $vmDir"
  New-Item -ItemType Directory -Force $vmDir | Out-Null
  if (-not (Test-Path $key)) { ssh-keygen -q -t ed25519 -N '""' -C "$user@$VMName" -f $key }
  $pub = (Get-Content "$key.pub" -Raw).Trim()

  # OS disk: convert the qcow2 cloud image to VHDX and grow it.
  $osDisk = Join-Path $vmDir "$VMName.vhdx"
  $toWsl = { param($p) '/mnt/' + $p.Substring(0,1).ToLower() + ($p.Substring(2) -replace '\\', '/') }
  wsl -d $WslDistro -e qemu-img convert -O vhdx -o subformat=dynamic (& $toWsl $CloudImage) (& $toWsl $osDisk)
  if ($LASTEXITCODE) { throw 'qemu-img convert failed' }
  Resize-VHD -Path $osDisk -SizeBytes 20GB

  # cloud-init NoCloud seed: a FAT32 disk labelled CIDATA.
  $site = @"
server {
    listen $Port default_server;
    listen [::]:$Port default_server;
    root /var/www/$VMName;
    index index.html;
    gzip on;
    gzip_types application/javascript application/json text/css image/svg+xml;
    location / { try_files `$uri `$uri/ /index.html; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location /assets/ { expires 7d; }
}
"@
  $siteIndented = ($site -split "`r?`n" | ForEach-Object { "      $_" }) -join "`n"
  $userData = @"
#cloud-config
hostname: $VMName
fqdn: $VMName.mshome.net
users:
  - name: $user
    gecos: Game arcade deploy
    groups: [sudo]
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    lock_passwd: true
    ssh_authorized_keys:
      - $pub
ssh_pwauth: false
package_update: true
package_upgrade: true
packages:
  - nginx
write_files:
  - path: /etc/nginx/sites-available/$VMName
    content: |
$siteIndented
runcmd:
  # Hyper-V integration: lets the host see the VM's address (Get-VMNetworkAdapter).
  - [bash, -c, "DEBIAN_FRONTEND=noninteractive apt-get install -y linux-cloud-tools-virtual || true"]
  - [bash, -c, "mkdir -p /var/www/$VMName && chown ${user}:${user} /var/www/$VMName"]
  - [ln, -sf, /etc/nginx/sites-available/$VMName, /etc/nginx/sites-enabled/$VMName]
  - [systemctl, enable, --now, nginx]
  - [systemctl, reload, nginx]
  - [touch, /var/lib/cloud/instance/$VMName-ready]
"@
  $metaData = "instance-id: $VMName-$(Get-Date -Format yyyyMMddHHmmss)`nlocal-hostname: $VMName`n"

  $seed = Join-Path $vmDir 'seed.vhdx'
  New-VHD -Path $seed -SizeBytes 64MB -Dynamic | Out-Null
  $disk = Mount-VHD -Path $seed -Passthru | Get-Disk
  try {
    Initialize-Disk -Number $disk.Number -PartitionStyle MBR
    $vol = New-Partition -DiskNumber $disk.Number -UseMaximumSize -AssignDriveLetter |
      Format-Volume -FileSystem FAT32 -NewFileSystemLabel CIDATA -Confirm:$false
    Write-Lf "$($vol.DriveLetter):\user-data" $userData
    Write-Lf "$($vol.DriveLetter):\meta-data" $metaData
  } finally { Dismount-VHD -Path $seed }

  New-VM -Name $VMName -Generation 2 -MemoryStartupBytes 2GB -VHDPath $osDisk -SwitchName $Switch -Path $vmDir | Out-Null
  Set-VM -Name $VMName -ProcessorCount 2 -AutomaticCheckpointsEnabled $false -AutomaticStartAction Start -AutomaticStopAction ShutDown
  Set-VMFirmware -VMName $VMName -SecureBootTemplate MicrosoftUEFICertificateAuthority
  Add-VMHardDiskDrive -VMName $VMName -Path $seed
  Start-VM -Name $VMName
}

# --- main ---
if (-not $SkipBuild) {
  Push-Location $repo
  try { npm run build; if ($LASTEXITCODE) { throw 'npm run build failed' } } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $repo 'dist\index.html'))) { throw 'dist/index.html missing - build first' }

if (-not (Get-VM -Name $VMName -ErrorAction SilentlyContinue)) { New-GameVM }
elseif ((Get-VM -Name $VMName).State -ne 'Running') { Start-VM -Name $VMName }

Write-Host 'Waiting for VM network + cloud-init (first boot takes a few minutes)...'
$deadline = (Get-Date).AddMinutes(20)
while ($true) {
  $ip = Get-VMIp
  if ($ip) {
    # PS 5.1 turns native stderr into terminating errors under 'Stop'; rely on exit codes here.
    $ErrorActionPreference = 'Continue'
    ssh @sshOpts "$user@$ip" "test -f /var/lib/cloud/instance/$VMName-ready" 2>$null
    $ok = $LASTEXITCODE -eq 0
    $ErrorActionPreference = 'Stop'
    if ($ok) { break }
  }
  if ((Get-Date) -gt $deadline) { throw "Timed out waiting for $VMName (last IP: $ip)" }
  Start-Sleep -Seconds 10
}
Write-Host "VM ready at $ip"

$ErrorActionPreference = 'Continue'  # native tools below write progress/warnings to stderr; exit codes are checked
$tarball = Join-Path $env:TEMP "$VMName-dist.tgz"
tar -czf $tarball -C (Join-Path $repo 'dist') .
if ($LASTEXITCODE) { throw 'tar failed' }
scp @sshOpts $tarball "${user}@${ip}:/tmp/dist.tgz"
if ($LASTEXITCODE) { throw 'scp failed' }
ssh @sshOpts "$user@$ip" "set -e; find /var/www/$VMName -mindepth 1 -delete; tar -xzf /tmp/dist.tgz -C /var/www/$VMName; rm /tmp/dist.tgz; sudo nginx -t -q; sudo systemctl reload nginx"
if ($LASTEXITCODE) { throw 'remote extract failed' }
Remove-Item $tarball

$code = (Invoke-WebRequest "http://${ip}:$Port/" -UseBasicParsing -TimeoutSec 15).StatusCode
Write-Host "Deployed. HTTP $code from http://${ip}:$Port/  (also http://$VMName.mshome.net:$Port/)"
