$ErrorActionPreference = "Continue"

$portable = Join-Path $PSScriptRoot ".tools\node-v20"
$nodeDir = if (Test-Path (Join-Path $portable "node.exe")) { $portable } else { "C:\Program Files\nodejs" }
$node = Join-Path $nodeDir "node.exe"
$runNext = Join-Path $PSScriptRoot "scripts\run-next.mjs"
$env:PATH = "$nodeDir;$env:PATH"

Write-Host "AI Vital Manager starting..." -ForegroundColor Cyan
Write-Host "Node: $(& $node -v) ($nodeDir)" -ForegroundColor DarkGray
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path ".gstack" | Out-Null

if (-not (Test-Path ".\node_modules")) {
  Write-Host "node_modules missing. Run fix-deps.bat first." -ForegroundColor Yellow
  Read-Host "Press Enter"
  exit 1
}

Write-Host "Dev server: http://localhost:3000" -ForegroundColor Green
Write-Host "Stop with Ctrl+C. Keep this window open." -ForegroundColor DarkGray
Write-Host ""

& $node $runNext dev -p 3000

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "[ERROR] Dev server stopped (exit $LASTEXITCODE)." -ForegroundColor Red
  Write-Host "Try: fix-deps.bat then start.bat again" -ForegroundColor Yellow
  Read-Host "Press Enter"
}
