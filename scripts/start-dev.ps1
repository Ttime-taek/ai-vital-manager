# Optional: run via  start.bat  (recommended). This script avoids Start-Transcript.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$nodeDir = "$env:LOCALAPPDATA\ai-vital-manager\node-v20"
if (-not (Test-Path "$nodeDir\node.exe")) {
  $nodeDir = Join-Path $root ".tools\node-v20"
}
if (-not (Test-Path "$nodeDir\node.exe")) {
  $nodeDir = "C:\Program Files\nodejs"
}
$node = Join-Path $nodeDir "node.exe"
$next = Join-Path $root "node_modules\next\dist\bin\next"

$env:PATH = "$nodeDir;$env:PATH"
$env:WATCHPACK_POLLING = "true"
$env:CHOKIDAR_USEPOLLING = "true"
$env:NEXT_TELEMETRY_DISABLED = "1"

Set-Location $root
Write-Host "http://localhost:3000" -ForegroundColor Green
& $node $next dev -p 3000
exit $LASTEXITCODE
