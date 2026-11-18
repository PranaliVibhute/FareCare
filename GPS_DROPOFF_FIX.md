# GPS and drop-off selector fix

Problem: Using Current Location triggered the map nearby event. The old booking code treated the externally geocoded 15-km results as a hard filter for pickup fare anchors. When geocoding was slow, inaccurate or empty, it removed every pickup option and therefore every downstream drop-off.

Fix: GPS nearby results are informational. Configured fare anchors stay selectable, regardless of whether Nominatim resolves the map pins. Select a pickup fare anchor after GPS, then select a downstream drop-off from the case-insensitive search dropdown or click a valid pin. The 15-km nearby list is advisory, not an enforced 15-km pickup limit in this demo.

This is not live road-route verification; driver location and roadside eligibility remain simulated.
