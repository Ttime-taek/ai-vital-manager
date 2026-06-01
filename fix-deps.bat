@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "NODE_DIR=%LOCALAPPDATA%\ai-vital-manager\node-v20"
set "NODE=%NODE_DIR%\node.exe"
set "NPM=%NODE_DIR%\npm.cmd"
set "ZIP=%LOCALAPPDATA%\ai-vital-manager\node-v20.zip"
set "USED_BUN=0"

if not exist "%LOCALAPPDATA%\ai-vital-manager" mkdir "%LOCALAPPDATA%\ai-vital-manager"

if not exist "%NODE%" (
  echo Downloading Node 20 ...
  curl.exe -L -o "%ZIP%" "https://nodejs.org/dist/v20.20.2/node-v20.20.2-win-x64.zip"
  if errorlevel 1 ( echo Download failed. & pause & exit /b 1 )
  powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%LOCALAPPDATA%\ai-vital-manager' -Force; if (Test-Path '%LOCALAPPDATA%\ai-vital-manager\node-v20.20.2-win-x64') { if (Test-Path '%NODE_DIR%') { Remove-Item '%NODE_DIR%' -Recurse -Force }; Rename-Item '%LOCALAPPDATA%\ai-vital-manager\node-v20.20.2-win-x64' 'node-v20' }"
  del "%ZIP%" 2>nul
)

set "PATH=%NODE_DIR%;%PATH%"
"%NODE%" -v
echo.

echo Stopping Next dev servers only...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-next-dev.ps1"

if exist ".next" ( echo Removing .next ... & rmdir /s /q ".next" )

rem ── Pre-clean known-locked dirs (rolldown brings wasm-runtime that often fails to rmdir on Windows).
if exist "node_modules\@rolldown" (
  echo Removing node_modules\@rolldown ...
  powershell -NoProfile -Command "Remove-Item -LiteralPath 'node_modules\@rolldown' -Recurse -Force -ErrorAction SilentlyContinue"
)
if exist "node_modules\@next\swc-win32-x64-msvc" (
  rem will be reinstalled below
  powershell -NoProfile -Command "Remove-Item -LiteralPath 'node_modules\@next\swc-win32-x64-msvc' -Recurse -Force -ErrorAction SilentlyContinue"
)

echo Installing deps (skip lifecycle scripts; SWC handled explicitly later)...
call "%NPM%" install --ignore-scripts --omit=optional --no-audit --no-fund
if errorlevel 1 (
  echo First npm install failed. Wiping node_modules and retrying...
  if exist "node_modules" (
    powershell -NoProfile -Command "Remove-Item -LiteralPath 'node_modules' -Recurse -Force -ErrorAction SilentlyContinue"
  )
  if exist "node_modules" (
    echo Stubborn lock. Trying robocopy purge...
    if not exist "%TEMP%\vp-empty" mkdir "%TEMP%\vp-empty"
    robocopy "%TEMP%\vp-empty" "node_modules" /MIR /NFL /NDL /NJH /NJS /NC /NS >nul
    rmdir /s /q "node_modules" 2>nul
  )
  call "%NPM%" install --ignore-scripts --omit=optional --no-audit --no-fund
  if errorlevel 1 (
    echo npm install failed twice. Trying bun fallback...
    where bun >nul 2>nul
    if errorlevel 1 ( echo bun not found. Close editor/AV scan and retry. & pause & exit /b 1 )
    call bun install --ignore-scripts
    if errorlevel 1 ( echo bun fallback failed. & pause & exit /b 1 )
    set "USED_BUN=1"
  )
)

if "%USED_BUN%"=="0" (
  call "%NPM%" install next@14.2.35 eslint-config-next@14.2.35 --save-exact --ignore-scripts --omit=optional --no-audit --no-fund
  if errorlevel 1 ( echo Version pin failed. & pause & exit /b 1 )
) else (
  echo Using bun fallback: skipping npm version pin step.
)

echo Checking SWC before direct install...
"%NODE%" "%~dp0scripts\check-next-swc.mjs"
if errorlevel 1 (
  echo SWC missing/mismatch. Running direct installer...
  "%NODE%" "%~dp0scripts\install-swc-direct.mjs"
  if errorlevel 1 ( echo SWC direct install failed. & pause & exit /b 1 )
)

echo Pruning broken @next/swc platform stubs...
"%NODE%" "%~dp0scripts\prune-swc-stubs.mjs"
if errorlevel 1 ( echo prune failed. & pause & exit /b 1 )

"%NODE%" "%~dp0scripts\check-next-swc.mjs"
if errorlevel 1 ( echo Version check failed. & pause & exit /b 1 )

echo.
echo Done. Run start.bat
pause
endlocal
