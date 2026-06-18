# .env.local -> Vercel Environment Variables (Production + Preview + Development)
# Usage (once per machine):
#   1. npx vercel login
#   2. cd project root && npx vercel link   (pick team + ai-vital-manager-xmi5)
#   3. powershell -ExecutionPolicy Bypass -File .\scripts\sync-vercel-env.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found at $envFile"
}

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

$npx = "npx.cmd"
if (-not (Get-Command $npx -ErrorAction SilentlyContinue)) {
  $npx = "npx"
}

Write-Host "Vercel CLI check..."
& $npx --yes vercel whoami
if ($LASTEXITCODE -ne 0) {
  Write-Error "Run: npx vercel login"
}

$envTargets = @("production", "preview", "development")

foreach ($key in $keys) {
  if (-not $parsed.ContainsKey($key)) { continue }
  $value = $parsed[$key]
  if ([string]::IsNullOrWhiteSpace($value)) { continue }

  foreach ($target in $envTargets) {
    Write-Host "Setting $key ($target)..."
    $value | & $npx --yes vercel env add $key $target --force 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Failed: $key ($target)"
    }
  }
}

Write-Host ""
Write-Host "Done. Redeploy: npx vercel --prod"
Write-Host "Or Vercel dashboard -> Deployments -> Redeploy"
Write-Host ""
Write-Host "Tip: For better Korean drug web search on Vercel, set SERPER_API_KEY in .env.local"
Write-Host "     (https://serper.dev) then re-run this script. TAVILY_API_KEY is optional."
