FARECARE MAP + FIXED FARE UPDATE (HACKATHON PROTOTYPE)

Start backend from backend folder:
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
If virtualenv missing: py -m venv .venv && .\.venv\Scripts\python.exe -m pip install -r requirements.txt

Start frontend from frontend folder:
  py -m http.server 5500
Open http://localhost:5500/booking.html?vehicle=auto

Fixed configured fare points:
PCMC Metro -> I-Venus / Physics Wallah: Rs 20
I-Venus / Physics Wallah -> Chapekar Chowk: Rs 10
Chapekar Chowk -> Walhekarwadi: Rs 10
PCMC Metro -> Walhekarwadi: Rs 40 per passenger
Actual drop-off Aher Garden can be entered separately, without changing fare.
No fare discounts, pooling, or per-passenger split.

Map uses Leaflet and OpenStreetMap tiles, Nominatim geocoding and browser geolocation.
Requires internet and user location permission. Only configured fare points are shown.
Geocoded coordinates are approximate and may be unavailable or inaccurate.
Map is not navigation, verified auto-stand data or real-time driver tracking.

IMPORTANT: Current login uses a user_id in sessionStorage and backend ride endpoints
lack real authentication/authorization. DO NOT expose publicly or use real personal data.
Existing bookings created by the old sample fare logic are not retroactively recalculated.
Other routes/vehicles need administrator-configured fare tables before booking.
The existing matched-group indicator is informational only; no pooling price change.
