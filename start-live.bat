@echo off

setlocal EnableExtensions

cd /d "%~dp0"



set "NODE_DIR=%LOCALAPPDATA%\ai-vital-manager\node-v20"

if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=%~dp0.tools\node-v20"

if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=C:\Program Files\nodejs"



set "NODE=%NODE_DIR%\node.exe"

set "NEXT=%~dp0node_modules\next\dist\bin\next"

set "PATH=%NODE_DIR%;%PATH%"

set "WATCHPACK_POLLING=true"

set "CHOKIDAR_USEPOLLING=true"

set "NEXT_TELEMETRY_DISABLED=1"



echo http://localhost:3001

"%NODE%" "%NEXT%" dev -p 3001

pause

endlocal

