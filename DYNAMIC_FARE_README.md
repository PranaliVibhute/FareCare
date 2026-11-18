# FareCare dynamic fare demo

## Exact fare logic
Person A starts at the **configured private-auto quote** (₹100 for the sample auto corridor). This is NOT a live Uber API quote.
Person A's floor is the sum of configured shared-auto segments between the selected fare anchors. Example: PCMC Metro → Aher Garden uses Walhekarwadi as final anchor, so floor ₹40.
Each Person B pays their configured segment fare. **Only after the driver presses Confirm boarding** does B's fare reduce Person A's payable amount.
Formula (integer paise): `A_payable = max(A_shared_floor, A_private_quote - sum(boarded_B_fares))`.
When a joining rider completes, their contribution stays counted. Acceptance without boarding has no effect.

## Demo flow
1. Register passenger A and driver, sign in separately.
2. A books PCMC Metro → Walhekarwadi (Aher Garden as actual drop-off); shows ₹100 initial, ₹40 floor.
3. Driver accepts A and presses Confirm boarding.
4. B books PCMC Metro → Chapekar Chowk (₹30); driver accepts B. A still owes ₹100.
5. Driver presses Confirm boarding for B. A now owes ₹70.
6. Repeat with a second B: A owes ₹40. Third B cannot board simultaneously if seats full; use realistic capacity and complete a rider before adding another.
7. Driver marks B completed; their contribution remains counted.
8. Advance simulated driver progress beyond pickup: boarding a previously accepted B is blocked.

## Limitations
- Roadside GPS map matching and live driver tracking are **not** implemented; driver route progress is simulated.
- The ₹100 initial private fare is configured for demo, **not sourced from Uber**.
- Arbitrary geographic destinations still require a mapped fare anchor.
- No real payment processing or production-grade API authentication.
- The backend demo uses client-provided user IDs; do not deploy publicly.
