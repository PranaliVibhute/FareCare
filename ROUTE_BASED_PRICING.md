# FareCare: route-based joining fares (finale demo)

Joining riders NEVER have a universal ₹30 charge. The backend sums the fare of each segment between their selected main fare points:

- PCMC Metro Station → I-Venus / Physics Wallah: ₹20
- I-Venus / Physics Wallah → Chapekar Chowk: ₹10
- Chapekar Chowk → Walhekarwadi: ₹10
- PCMC Metro Station → Chapekar Chowk: ₹30 (₹20 + ₹10)
- I-Venus / Physics Wallah → Walhekarwadi: ₹20 (₹10 + ₹10)
- PCMC Metro Station → Walhekarwadi: ₹40

If a rider exits at Aher Garden (inside the final segment), they pay through Walhekarwadi's fare boundary, as configured by the user.

Passenger A starts with a *configured demo* private-auto quote of ₹100 and cannot fall below the shared-auto floor for A's own journey. For each joined passenger, only **confirmed boarding** triggers a deduction. A's payable = max(A's route-specific shared-auto floor, private quote − sum of all boarded joiners' individual route fares). The backend recomputes contributions using each boarded joiner's own route interval and passenger count. No joining fee is hardcoded.

Driver GPS progress and roadside pickup verification are still simulated, and the ₹100 private fare is NOT a live Uber quote. No real payment processing.
