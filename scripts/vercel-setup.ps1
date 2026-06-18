# One-time Vercel login + link (Windows-safe — does not use npx)
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\vercel-setup.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Get-ProjectNode {
  $candidates = @(
    "$env:LOCALAPPDATA\ai-vital-manager\node-v20",
    (Join-Path $root ".tools\node-v20"),
    "C:\Program Files\nodejs"
  )
  foreach ($dir in $candidates) {
    $nodeExe = Join-Path $dir "node.exe"
    if (Test-Path $nodeExe) {
      return @{
        Dir = $dir
        Node = $nodeExe
        Npm = Join-Path $dir "npm.cmd"
      }
    }
  }
  throw "Node.js not found. Run fix-deps.bat first."
}

function Ensure-VercelCli {
  param(
    [string]$Node,
    [string]$Npm
  )

  $vc = Join-Path $root "node_modules\vercel\dist\vc.js"
  if (Test-Path $vc) { return $vc }

  Write-Host "Installing vercel CLI locally..."
  Push-Location $root
  try {
    & $Npm install vercel --no-save --no-audit --no-fund
  } finally {
    Pop-Location
  }

  if (-not (Test-Path $vc)) {
    throw "Failed to install vercel. Run: npm install vercel --no-save"
  }
  return $vc
}

Set-Location $root
$nodeInfo = Get-ProjectNode
$env:PATH = "$($nodeInfo.Dir);$env:PATH"

Write-Host "Node: $($nodeInfo.Dir)"
$vc = Ensure-VercelCli -Node $nodeInfo.Node -Npm $nodeInfo.Npm

Write-Host ""
Write-Host "Step 1/2: Vercel login (browser opens)..." -ForegroundColor Cyan
& $nodeInfo.Node $vc login
if ($LASTEXITCODE -ne 0) {
  throw "vercel login failed (exit $LASTEXITCODE)"
}

Write-Host ""
Write-Host "Step 2/2: Link this folder to your Vercel project..." -ForegroundColor Cyan
Write-Host "Choose team, then project: ai-vital-manager-xmi5" -ForegroundColor DarkGray
& $nodeInfo.Node $vc link
if ($LASTEXITCODE -ne 0) {
  throw "vercel link failed (exit $LASTEXITCODE)"
}

Write-Host ""
Write-Host "Setup complete. Sync env vars:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\sync-vercel-env.ps1"
