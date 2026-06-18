@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set "NODE_DIR=C:\Program Files\nodejs"
if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=%LOCALAPPDATA%\ai-vital-manager\node-v20"
if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=%~dp0..\.tools\node-v20"
set "PATH=%NODE_DIR%;%PATH%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-vercel-env.ps1"
exit /b %ERRORLEVEL%
