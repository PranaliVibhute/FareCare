# Driver accept/reject and mock payment QR

- **Reject** now works for any unassigned pending ride even if its pickup is behind the driver. It updates the ride to rejected.
- **Accept** remains intentionally blocked when the backend determines the driver has already passed the pickup. To accept, use a request with pickup at or ahead of the GPS-matched fare anchor, in the requested direction.
- Buttons require fresh browser GPS (within 60 seconds). Permission must be allowed.
- The right-side QR graphic is a **decorative fake**; it does not contain UPI payment data and cannot accept payments.
- This is a local hackathon demo, not production-grade dispatch or billing.
