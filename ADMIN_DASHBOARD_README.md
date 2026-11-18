# FareCare Admin Dashboard (local hackathon demo)

Open http://127.0.0.1:5500/admin.html after starting the frontend and backend as in README.md.

In the backend PowerShell terminal BEFORE starting uvicorn, set an admin key:

    $env:FARECARE_ADMIN_KEY = "choose-a-long-random-secret-key"
    .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload

Enter the same key on admin.html and click Load dashboard. It is kept only in the browser page memory, not localStorage.

Features: database-backed metrics, ride listing, driver approvals and suspensions, daily-fee aggregates. The pre-existing unprotected driver approval endpoint has been secured with the same admin key.

Limitations: demo admin key is not a production auth system. Other legacy API endpoints still rely on user IDs without authorization. SOS is a nonfunctional placeholder. No actual police/transport-authority integration, document verification, real payments, or real-time monitoring. Do not deploy publicly.
