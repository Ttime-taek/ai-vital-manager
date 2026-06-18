# .env.local -> Vercel Environment Variables (Production + Preview + Development)
# Usage (once per machine):
#   1. powershell -ExecutionPolicy Bypass -File .\scripts\vercel-setup.ps1
#   2. powershell -ExecutionPolicy Bypass -File .\scripts\sync-vercel-env.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env.local"

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

  Write-Host "Installing vercel CLI locally (avoids broken npx on Windows)..."
  Push-Location $root
  try {
    & $Npm install vercel --no-save --no-audit --no-fund 2>&1 | ForEach-Object { Write-Host $_ }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path $vc)) {
    throw "Failed to install vercel. Run: npm install vercel --no-save"
  }
  return $vc
}

function Invoke-Vercel {
  param(
    [string]$Node,
    [string]$Vc,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$VercelArgs
  )

  $output = & $Node $Vc @VercelArgs 2>&1
  if ($output) {
    $output | ForEach-Object { Write-Host $_ }
  }
  return $LASTEXITCODE
}

if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found at $envFile"
}

$nodeInfo = Get-ProjectNode
$env:PATH = "$($nodeInfo.Dir);$env:PATH"

$keys = @(
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "AI_PROVIDER",
  "CEREBRAS_API_KEY",
  "CEREBRAS_MODEL",
  "CEREBRAS_BASE_URL",
  "MEDICATION_WEB_SEARCH",
  "SERPER_API_KEY",
  "TAVILY_API_KEY",
  "INTERACTIONS_LLM_ORDER",
  "USDA_FDC_API_KEY"
)

$parsed = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $name = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  $parsed[$name] = $value
}

Write-Host "Node: $($nodeInfo.Dir)"
$vc = Ensure-VercelCli -Node $nodeInfo.Node -Npm $nodeInfo.Npm

$vercelDir = Join-Path $root ".vercel"
if (-not (Test-Path (Join-Path $vercelDir "project.json"))) {
  Write-Host ""
  Write-Host "Project not linked to Vercel yet." -ForegroundColor Yellow
  Write-Host "Run first:" -ForegroundColor Yellow
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\vercel-setup.ps1" -ForegroundColor Cyan
  exit 1
}

Write-Host "Vercel CLI check..."
$whoamiCode = Invoke-Vercel -Node $nodeInfo.Node -Vc $vc whoami
if ($whoamiCode -ne 0) {
  Write-Host ""
  Write-Host "Not logged in to Vercel." -ForegroundColor Yellow
  Write-Host "Run:" -ForegroundColor Yellow
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\vercel-setup.ps1" -ForegroundColor Cyan
  exit 1
}

$envTargets = @("production", "preview", "development")

foreach ($key in $keys) {
  if (-not $parsed.ContainsKey($key)) { continue }
  $value = $parsed[$key]
  if ([string]::IsNullOrWhiteSpace($value)) { continue }

  foreach ($target in $envTargets) {
    Write-Host "Setting $key ($target)..."
    $value | & $nodeInfo.Node $vc env add $key $target --force 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Failed: $key ($target)"
    }
  }
}

Write-Host ""
Write-Host "Done. Redeploy from Vercel Dashboard -> Deployments -> Redeploy"
Write-Host ""
Write-Host "Tip: For better Korean drug web search on Vercel, set SERPER_API_KEY in .env.local"
Write-Host "     (https://serper.dev) then re-run this script. TAVILY_API_KEY is optional."
