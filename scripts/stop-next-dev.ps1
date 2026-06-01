# Stop only Next.js dev servers — do not kill every node.exe (would abort SWC install).
$me = $PID
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.ProcessId -ne $me -and
    $_.CommandLine -match 'next(\\|/)dist(\\|/)bin(\\|/)next|next dev|dev-logger\.mjs'
  } |
  ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
  }
