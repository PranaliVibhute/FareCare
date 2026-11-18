# Demo driver access (local development only)

Email: driver.demo@example.com
Password: FareCareDemo#2026
Role: Driver

The driver is created/updated and pre-approved by `backend/seed_demo_driver.py`.
The account does NOT exist until the seed script runs against the backend's active SQLite database.

From project root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\START_BACKEND.ps1
```

The startup script creates the virtual environment if needed, installs dependencies, runs the demo driver seeder, and starts FastAPI. Open a second PowerShell terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\START_FRONTEND.ps1
```

Open http://127.0.0.1:5500/login.html and choose Driver.
If you already have a backend on port 8000, stop it first. This is a local demo credential only.
