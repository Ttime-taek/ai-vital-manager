@echo off

setlocal EnableExtensions

set "PORTABLE=%~dp0.tools\node-v20"

if exist "%PORTABLE%\node.exe" (set "NODE_DIR=%PORTABLE%") else (set "NODE_DIR=C:\Program Files\nodejs")

set "NODE=%NODE_DIR%\node.exe"

set "NEXT=%~dp0node_modules\next\dist\bin\next"

set "LOG=%~dp0.gstack\dev-run.log"
set "OUTLOG=%~dp0.gstack\dev-run.out.log"
set "ERRLOG=%~dp0.gstack\dev-run.err.log"

cd /d "%~dp0"

if not exist ".gstack" mkdir ".gstack"



set "WATCHPACK_POLLING=true"

set "CHOKIDAR_USEPOLLING=true"

set "NEXT_TELEMETRY_DISABLED=1"



echo Running dev for 20s, logging to %LOG% ...

powershell -NoProfile -Command ^

  "$log='%LOG%'; $out='%OUTLOG%'; $err='%ERRLOG%'; $env:PATH='%NODE_DIR%;'+$env:PATH; " ^

  "$env:WATCHPACK_POLLING='true'; $env:CHOKIDAR_USEPOLLING='true'; " ^

  "$p=Start-Process -FilePath '%NODE%' -ArgumentList @('%NEXT%','dev','-p','3000') -WorkingDirectory '%CD%' -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -NoNewWindow; " ^

  "Start-Sleep -Seconds 20; if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force }; " ^

  "if ($p) { 'exit '+$p.ExitCode | Add-Content $log }; if (Test-Path $out) { Get-Content $out | Add-Content $log }; if (Test-Path $err) { '--- stderr ---' | Add-Content $log; Get-Content $err | Add-Content $log }"



echo.

echo --- tail of %LOG% ---

powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 50 -ErrorAction SilentlyContinue"

pause

endlocal

