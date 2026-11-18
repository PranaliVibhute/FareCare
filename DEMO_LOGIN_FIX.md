# Driver demo login fix

Email: `driver.demo@example.com`  
Password: `FareCareDemo#2026`

The demo autofill lives in `frontend/js/app.js`, not `login.html`.
The seeder can be rerun: it migrates the old `.test` account, reuses the existing phone, avoids duplicate phone numbers, resets the demo password and approves the driver.

From `backend`:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe seed_demo_driver.py
$env:FARECARE_ADMIN_KEY = "your-private-admin-key"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

From `frontend` in a second terminal:

```powershell
py -m http.server 5500
```

Open http://127.0.0.1:5500/login.html and hard-refresh. Keep your existing database if you want your prior data; don't delete it.
