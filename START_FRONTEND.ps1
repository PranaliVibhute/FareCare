$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'frontend')
Write-Host 'Frontend: http://127.0.0.1:5500/login.html' -ForegroundColor Cyan
py -m http.server 5500
