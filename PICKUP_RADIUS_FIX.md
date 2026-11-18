# Passenger pickup validation

- A selected pickup fare anchor must be within **500 metres** of the passenger GPS coordinates (a 1 km diameter zone).
- Both frontend preflight and backend POST /rides enforce the limit.
- Rejected requests report distance and nearest configured stop.
- Drop-off is not limited to 500 metres; existing downstream route rules apply.
- `/routes/pickup-anchors` exposes the demo reference coordinates used for validation.
- **Coordinates are approximate reference points, not verified exact stop entrances.** Calibrate all pins on-site before real use.
- GPS coordinates are client-provided; this is NOT spoof-resistant or production-safe.
- Existing map geocoding is separate and can disagree with the reference coordinates.
