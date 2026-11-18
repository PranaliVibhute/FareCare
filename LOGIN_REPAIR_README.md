# FareCare demo driver login repair

The screenshot error `Invalid email, password or role` is a 401 from `/auth/login`. It occurs when the running backend database does not contain the demo account with the expected password and role. The database URL defaults to `sqlite:///./farecare_dev.db`, which is **relative to the terminal's working directory**. Running the seed from one folder and Uvicorn from another can create two separate databases.

## Reliable start procedure

1. Extract this ZIP to a new folder.
2. In PowerShell in the extracted project root, run `powershell -ExecutionPolicy Bypass -File .\START_BACKEND.ps1`. This sets the working directory to `backend`, installs dependencies if needed, and runs the idempotent seed against the **same** SQLite database that Uvicorn uses.
3. In a second PowerShell terminal in the project root, run `powershell -ExecutionPolicy Bypass -File .\START_FRONTEND.ps1`.
4. Open http://127.0.0.1:5500/login.html, click **Fill demo driver credentials**, then **Login**.

Email: `driver.demo@example.com`  
Password: `FareCareDemo#2026`  
Role: `Driver`

If you need to retain rides, fees, and existing accounts, **stop the old backend** and copy its `backend/farecare_dev.db` file into the new extracted project's `backend` folder **before** running the launcher. Do not copy the database while Uvicorn is writing to it. The seed script does not delete rides or payments. If `DATABASE_URL` is set in your environment, it takes precedence; verify it points to the intended database.

Make sure there is no older Uvicorn process still running on port 8000. Hard-refresh the browser (`Ctrl+Shift+R`).

This is a local demonstration account, not production authentication. Do not deploy the included credentials or admin demo key publicly.
