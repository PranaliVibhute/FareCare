# FareCare: bidirectional stops + VIT demo pin

- VIT Pune Gate **demo pin** is set to the GPS coordinates shown in the previously provided passenger screenshot: 18.464152, 73.867668. This is a manual demo coordinate override, NOT verified to be the actual VIT entrance. GPS from the browser is not changed or spoofed.
- Passenger fare dropdown allows choosing any other stop on the same route, in either direction. Example: Bibwewadi -> VIT Pune Gate, Swargate, Mandai.
- Reverse trips sum the same segment fares as forward trips.
- Driver eligibility considers ride direction, including reverse direction. Driver progress remains a simulated stop, not real navigation.
- The 1 km GPS pickup-radius validation remains enabled. If the VIT demo pin is not physically near the browser's actual GPS, booking may still be rejected; adjust the verified coordinate, not the browser GPS.
- Existing routes and ₹100 Ride Initiator quote remain unchanged.
