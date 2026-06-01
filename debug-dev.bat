@echo off
setlocal EnableExtensions
set "NODE_DIR=C:\Program Files\nodejs"
set "NODE=%NODE_DIR%\node.exe"
set "NEXT=%~dp0node_modules\next\dist\bin\next"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "%~dp0"
if not exist ".gstack" mkdir ".gstack"

echo === build check ===
"%NODE%" "%NEXT%" build > ".gstack\build.log" 2>&1
set BUILD_EXIT=%ERRORLEVEL%
type ".gstack\build.log"
echo.
echo build exit code: %BUILD_EXIT%
echo Log: %CD%\.gstack\build.log
pause
endlocal
