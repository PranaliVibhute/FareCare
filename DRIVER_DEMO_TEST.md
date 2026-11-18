# FareCare Driver Registration and Test Account

## Create an already-approved demo driver
From the extracted project root, open PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe seed_demo_driver.py
$env:FARECARE_ADMIN_KEY = "replace-with-your-private-admin-key"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Second PowerShell terminal, from the project root:

```powershell
cd frontend
py -m http.server 5500
```

Go to http://127.0.0.1:5500/login.html and click **Fill demo driver credentials**, then **Login**.

- Email: `driver.demo@example.com`
- Password: `FareCareDemo#2026`
- Role: Driver
- Registration: `DEMO-AUTO-001`
- Approved: Yes (seeded test account only)

The seed command is safe to rerun; it will not reset an existing driver's password or duplicate the account. It creates a test record in your local SQLite database, not a real email inbox. The account starts with today's approval date; billing and missed-payment penalties accumulate according to existing backend rules.

## Test real registration flow
Open http://127.0.0.1:5500/signup.html, select **Driver**, fill in dummy name, unique email, unique 10-digit phone, password (8+ characters), licence, vehicle number and vehicle category. After signing up, go to http://127.0.0.1:5500/admin.html and approve the pending driver with the admin key. Then log in as the newly registered driver.

## Limitations

The login API returns a user ID, not a cryptographically secure session. Other endpoints are not fully access-controlled. This demo account and its publicly documented password must not be used on an internet-facing deployment. No OTP or real licence verification occurs.
