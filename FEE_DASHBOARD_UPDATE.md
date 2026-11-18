# FareCare admin fee dashboard update

Open frontend/admin.html with the backend running and FARECARE_ADMIN_KEY configured.

The new `/admin/driver-fees` endpoint reads actual SQLite driver billing and payment records. It shows per-driver charges, paid amount, outstanding balance, monthly missed-payment chances, penalty days, and last recorded payment. Approved drivers have billing generated through the current date on dashboard refresh. The existing daily ₹15 platform fee, zero ride commission, three monthly chances, and ₹2 penalty are unchanged.

The separate Example A/B/C table is illustrative, not database data. Payments in this prototype are recorded entries; there is no verified payment gateway.

**Limitations:** The existing fee engine accrues fees by calendar day since approval, and uses earlier outstanding balances to count missed-payment chances; it is not a precise timestamped payment-deadline engine. It may not fully reflect payments recorded late or retroactively. The `paid` status means all accrued fees are paid, not proof of bank settlement. This is not production-ready accounting.
