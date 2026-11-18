# Run this script from the extracted FareCare project root.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'backend')
if (-not (Test-Path '.venv\Scripts\python.exe')) {
    py -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python virtual environment.' }
}
$python = '.\.venv\Scripts\python.exe'
& $python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
Write-Host 'Repairing / creating the local demo driver in the SAME database as the API...' -ForegroundColor Cyan
& $python seed_demo_driver.py
if ($LASTEXITCODE -ne 0) { throw 'Demo driver setup failed. Backend not started.' }
if (-not $env:FARECARE_ADMIN_KEY) { $env:FARECARE_ADMIN_KEY = 'farecare-admin-2026-demo' }
Write-Host 'Demo driver email: driver.demo@example.com' -ForegroundColor Green
Write-Host 'Demo driver password: FareCareDemo#2026' -ForegroundColor Green
Write-Host 'Backend: http://127.0.0.1:8000/docs' -ForegroundColor Cyan
& $python -m uvicorn app.main:app --reload
