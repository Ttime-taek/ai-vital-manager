$ErrorActionPreference = "Stop"

Write-Host "AI 바이탈 매니저 서버 시작" -ForegroundColor Cyan
Write-Host "프로젝트: $PSScriptRoot" -ForegroundColor DarkGray

Set-Location $PSScriptRoot

if (!(Test-Path ".\\node_modules")) {
  Write-Host "node_modules 없음, npm install 실행..." -ForegroundColor Yellow
  npm install
}

Write-Host "개발 서버 실행: http://localhost:3000" -ForegroundColor Green
Write-Host "(종료: Ctrl+C)" -ForegroundColor DarkGray

npm run dev

