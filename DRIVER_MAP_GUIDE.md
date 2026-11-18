# Driver map (hackathon prototype)

The driver dashboard now shows Leaflet/OpenStreetMap map pins, nearby common stops after browser GPS permission, and a **Show route on map** control for each passenger request and assigned ride. Green highlights the selected ride fare-point sequence; dashed shows the entire common corridor. Stop buttons show segment prices. The driver must follow the Ride Initiator’s chosen fare-point sequence in the demo, but the map is **schematic straight lines, not road routing or turn-by-turn directions**. Real route adherence, dynamic road navigation, and GPS tracking are not implemented.

Open `frontend/driver.html` via the frontend HTTP server; requires internet for tiles, Leaflet and geocoding.
