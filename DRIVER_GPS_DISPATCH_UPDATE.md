# Driver GPS dispatch (hackathon demonstration)

On driver.html, click **Use my current location**. Browser geolocation requires localhost or HTTPS and location permission. The frontend geocodes FareCare fare anchors and suggests the nearest point within 15 km straight-line distance. **Click Update simulated position** to confirm that anchor; the backend then applies its existing ordered-route eligibility rules. By default, requests from other routes are hidden. Uncheck **Show requests on my selected route only** to view all requests. You can always choose a fare point manually.

Limitations: geocoding requires internet, the suggestion is not actual road map-matching, a driver on a road between fare points can be matched to the wrong anchor, the browser GPS location is not independently verified by the backend, and driver progress is ephemeral. Never use for actual dispatch.
