# FareCare — runnable prototype

This project keeps the original FareCare vehicle choices and visual assets, then adds a responsive frontend, separate passenger/driver portals, booking-request demo, and a FastAPI + PostgreSQL backend foundation.

## 1. Run the frontend

No build step is required.

```bash
cd frontend
python -m http.server 5500
```

Open http://localhost:5500

The frontend demo uses browser `localStorage`. It is useful for demonstrating screens and flows, but it is not real authentication, booking dispatch, payment processing, or secure billing.

## 2. Run the backend

Use Python 3.11+.

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
```

Create a PostgreSQL database named `farecare`, update `DATABASE_URL` in `.env`, then:

```bash
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

For a quick local test without PostgreSQL, the backend defaults to a local SQLite database if `DATABASE_URL` is not set.

## 3. Implemented backend foundation

- Passenger/driver account creation with Argon2 password hashing.
- Driver profile starts unapproved.
- Admin approval endpoint starts daily billing from approval date.
- Daily fee is ₹15 (1500 paise), stored as integer paise.
- No ride commission.
- Unpaid daily fees accumulate.
- First three missed-payment days in each calendar month consume grace chances without penalty.
- Each later missed-payment day in that month adds ₹2 (200 paise).
- Grace counters reset by month; fee debt remains in the ledger.
- Payments are applied to the oldest outstanding fee first.
- Paying debt does not restore grace chances.

## 4. Important business-rule interpretation

This implementation treats a day as a *missed-payment day* when the previous balance is still unpaid when that day's ₹15 fee is created. It does not yet implement a daily payment deadline/time-of-day. Define that deadline before production.

The earlier example that showed Day 1 as a missed day is only a simplified illustration. The backend's first bill is created on approval day; if it remains unpaid when the next day's bill is created, the next day is counted as a missed-payment day.

## 5. Not production-ready yet

Before real users or money:
- Add JWT access/refresh tokens and role-based authorization.
- Protect admin approval with admin authentication.
- Implement phone OTP verification and secure driver document upload/storage.
- Never collect real licence/RC documents through the current demo form.
- Add Alembic migrations, tests, audit logs and idempotent scheduled billing.
- Integrate a real payment gateway; never mark a payment successful from a frontend button.
- Connect route/geocoding provider, route matching, segment fare allocation and driver dispatch.
- Implement actual safety features (trusted contacts, tracking, SOS) and test them.
- Add privacy policy, consent, retention/deletion rules and security review.
- Review applicable transport, consumer, data protection and payment regulations.

## 6. Main folders

```text
FareCare/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── booking.html
│   ├── passenger.html
│   ├── driver.html
│   ├── css/style.css
│   ├── js/app.js
│   └── images/
└── backend/
    ├── app/
    │   ├── main.py
    │   ├── database.py
    │   └── models.py
    ├── requirements.txt
    └── .env.example
```
