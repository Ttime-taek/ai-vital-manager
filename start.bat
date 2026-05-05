@echo off
setlocal

echo AI Vital Manager starting...
cd /d "%~dp0"

if not exist "node_modules" (
  echo node_modules not found. Running npm install...
  npm install
)

echo Starting dev server at http://localhost:3000
echo (Stop with Ctrl+C)
npm run dev

endlocal

