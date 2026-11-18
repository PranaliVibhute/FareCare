FareCare common-point fare preview

Open frontend/booking.html through the frontend server and click Preview PCMC → Aher Garden common points.

The example displays 5 stop pins: PCMC Metro Station, I-Venus / Physics Wallah (Chinchwad Station–Highway), Chapekar Chowk, Walhekarwadi, and Aher Garden.
Known sample segment fares: ₹20, ₹10, ₹10. Walhekarwadi → Aher Garden is unknown, so ₹40 is only the known subtotal, not a total fare.

This is a schematic route preview (not a geocoded map). The backend booking price is unchanged; no live navigation, map API, or fare quote integration.

Run: cd frontend ; python -m http.server 5500
