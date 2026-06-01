@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "NODE_DIR=%LOCALAPPDATA%\ai-vital-manager\node-v20"
if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=%~dp0.tools\node-v20"
if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=C:\Program Files\nodejs"

set "NODE=%NODE_DIR%\node.exe"
set "PATH=%NODE_DIR%;%PATH%"
set "LOG=%~dp0.gstack\swc-fix.log"

if not exist ".gstack" mkdir ".gstack"
if not exist "%NODE%" ( echo [ERROR] Run fix-deps.bat first. & pause & exit /b 1 )
if not exist "node_modules\next\package.json" (
  echo [ERROR] next is not installed. Run: npm install
  pause
  exit /b 1
)

echo === quick-fix-swc %date% %time% === >> "%LOG%"
"%NODE%" -v >> "%LOG%" 2>&1

echo Stopping Next dev servers only (not install node)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-next-dev.ps1"

if exist ".next" ( echo Removing .next ... & rmdir /s /q ".next" )

echo.
echo SWC download ~39.5 MB — wait until you see "installed @next/swc-win32-x64-msvc"
echo Do NOT press Ctrl+C. If interrupted, run this script again to resume.
echo.

"%NODE%" "%~dp0scripts\install-swc-direct.mjs"
if errorlevel 1 goto :fail

"%NODE%" "%~dp0scripts\prune-swc-stubs.mjs"
"%NODE%" "%~dp0scripts\check-next-swc.mjs"
if errorlevel 1 goto :fail

echo.
echo Done. Run start.bat
pause
exit /b 0

:fail
echo.
echo Install failed. Last log lines:
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 25 -ErrorAction SilentlyContinue"
echo.
echo Re-run quick-fix-swc.bat to resume the download.
pause
exit /b 1
