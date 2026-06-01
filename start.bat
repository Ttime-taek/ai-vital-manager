@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

if not exist ".gstack" mkdir ".gstack"

set "NODE_DIR=C:\Program Files\nodejs"
if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=%LOCALAPPDATA%\ai-vital-manager\node-v20"
if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=%~dp0.tools\node-v20"

set "NODE=%NODE_DIR%\node.exe"
set "NEXT=%~dp0node_modules\next\dist\bin\next"
set "PATH=%NODE_DIR%;%PATH%"
set "LIVELOG=%~dp0.gstack\dev-live.log"

if not exist "%NODE%" ( echo [ERROR] Run fix-deps.bat first. & pause & exit /b 1 )
if not exist "%NEXT%" ( echo [ERROR] Run fix-deps.bat. & pause & exit /b 1 )

echo AI Vital Manager
echo Node: %NODE_DIR%
"%NODE%" -v
echo http://localhost:3000  -  keep this window open
echo.

rem Quick health probe: if a simple long-lived Node process is terminated
rem by endpoint security, next dev will also die right after "Ready".
"%NODE%" -e "setTimeout(() => process.exit(0), 4000)" >nul 2>nul
if errorlevel 1 (
  echo [WARN] Node runtime was terminated during a 4s liveness probe.
  echo This machine likely has endpoint security policy blocking long-lived node.exe.
  echo Trying Bun runtime fallback...
  where bun >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Bun not found. Check AhnLab EPP/V3 policy and allowlist:
    echo   - %NODE%
    echo   - %CD%\node_modules\next\dist\bin\next
    echo   - %CD%\node_modules\next\dist\server\lib\start-server.js
    pause
    exit /b 1
  )
  set "WATCHPACK_POLLING=true"
  set "CHOKIDAR_USEPOLLING=true"
  set "NEXT_TELEMETRY_DISABLED=1"
  set "TERM=xterm-256color"
  set "NEXT_IGNORE_INCORRECT_LOCKFILE=1"
  echo [INFO] Bun fallback: bun --bun "%NEXT%" dev -p 3000
  bun --version
  bun --bun "%NEXT%" dev -p 3000
  set "EXITCODE=!ERRORLEVEL!"
  goto :postrun
)

set "WATCHPACK_POLLING=true"
set "CHOKIDAR_USEPOLLING=true"
set "NEXT_TELEMETRY_DISABLED=1"
set "TERM=xterm-256color"

rem Disable Next's incorrect-lockfile patching (it can crash when next@14.2.35
rem expects SWC versions that aren't present in our lockfile).
set "NEXT_IGNORE_INCORRECT_LOCKFILE=1"

"%NODE%" "%~dp0scripts\prune-swc-stubs.mjs"
if errorlevel 1 goto :failed

"%NODE%" "%~dp0scripts\check-next-swc.mjs"
if errorlevel 1 goto :failed

"%NODE%" "%NEXT%" dev -p 3000
set "EXITCODE=!ERRORLEVEL!"

:postrun
if !EXITCODE! equ 0 (
  echo.
  echo Dev server exited unexpectedly. If it stopped right after Starting, re-run start.bat.
  pause
  exit /b 0
)

:failed
if not defined EXITCODE set "EXITCODE=1"
echo.
echo [ERROR] Dev server stopped (exit !EXITCODE!).
if exist "%LIVELOG%" (
  echo --- dev-live.log last 20 lines ---
  powershell -NoProfile -Command "Get-Content -LiteralPath '%LIVELOG%' -Tail 20 -ErrorAction SilentlyContinue"
)
echo ---
pause
exit /b !EXITCODE!
