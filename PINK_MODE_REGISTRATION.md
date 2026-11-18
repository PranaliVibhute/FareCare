# Pink Mode passenger registration (demo)

- Passenger signup now asks for self-declared gender. Driver signup is unchanged.
- Women can opt into Pink Mode. The backend rejects Pink Mode bookings by other accounts.
- A Pink Mode Ride Joiner can join only a Pink Mode Ride Initiator, and both must be registered as women. Normal rides remain separate.
- Existing passenger accounts have no gender recorded and cannot use Pink Mode until updated/re-registered. Do not overwrite the database just to change gender.
- This is **not** identity verification and cannot establish someone’s gender. It is only a hackathon simulation; do not advertise as a verified women-only safety service.
- Backend dispatch still lacks real authentication, so these restrictions are not production secure.
