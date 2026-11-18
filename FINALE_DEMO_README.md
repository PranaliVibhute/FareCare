# FareCare finale demo — actual implementation boundary

## New connected dispatch behavior
- Driver manually accepts/rejects requests, passenger sees status after refreshing passenger dashboard.
- Person A (initiator) must be confirmed first. Person B (joiner) is offered to the SAME driver only if the fare-anchor segment lies inside Person A route and the driver has not passed B pickup anchor.
- The server rechecks before accepting. Group ID links B to A; fare is fixed per passenger, not divided.
- Demo seat capacity 3 across overlapping confirmed journeys; completing Person A first is blocked while joined riders are active.
- Driver request list auto refreshes every 5 seconds when visible.

## Simulated — must disclose to judges
1. Driver position is manually selected main fare point, NOT live GPS.
2. Person B roadside pickup is represented by a selected fare anchor; no road geometry map-matching. DO NOT use for real dispatch.
3. Person A arbitrary map destination can be selected visually, but price requires a configured fare corridor.
4. Location pin geocoding is external Nominatim and may fail; map tiles need internet.
5. Payment ledger is prototype; no real payments. Driver approval, Pink Mode, SOS are not production-verified.
6. Prototype uses user_id API authorization; NOT safe for deployment to public internet.

## Demo order
1. Register passenger A, passenger B and driver accounts (distinct email/phone).
2. Driver simulated point PCMC Metro Station.
3. A books PCMC Metro → Walhekarwadi; driver accepts.
4. B books I-Venus → Chapekar Chowk, same travel date; driver refreshes, sees 'Joining confirmed ride FC…', accepts.
5. Both passenger dashboards show confirmed on refresh.
6. Complete B then A; observe completed status.
7. Repeat with driver progressed to Chapekar Chowk: I-Venus pickup is ineligible.

## Run
From backend: py -m pip install -r requirements.txt ; py -m uvicorn app.main:app --reload
From frontend: py -m http.server 5500
Open http://localhost:5500. Do not run on public network.
