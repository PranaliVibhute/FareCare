# VIT Pune Gate pin and 1 km pickup radius

- Passenger and driver maps now draw all 11 configured stop pins directly from coordinates, rather than relying on geocoding responses. VIT Pune Gate is always among the configured markers when Leaflet loads.
- The pickup eligibility radius is now **1,000 metres** (2 km diameter), enforced in both frontend and backend.
- Pickup GPS is still required; drop-off does not have a 1 km restriction.
- The coordinates are **approximate demonstration coordinates**, not verified gate entrances. Check and adjust them before real-world use.
- Maps require internet for Leaflet and OpenStreetMap background tiles.
