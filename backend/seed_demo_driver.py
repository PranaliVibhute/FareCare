"""Idempotent local demo driver seeder. Run from backend directory."""
from datetime import date
from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.models import User, DriverProfile
from app.main import pwd

EMAIL = "driver.demo@example.com"
OLD_EMAIL = "driver.demo@farecare.test"
PASSWORD = "FareCareDemo#2026"
Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    user = db.scalar(select(User).where(User.email == EMAIL))
    if user is None:
        old = db.scalar(select(User).where(User.email == OLD_EMAIL))
        if old is not None:
            if old.role != "driver":
                raise SystemExit("Old demo email belongs to a non-driver; refusing to overwrite")
            user = old
            user.email = EMAIL
            print("Migrated old demo email")
    if user is None:
        phone = None
        for n in range(1000, 10000):
            candidate = f"900000{n:04d}"
            if db.scalar(select(User.id).where(User.phone == candidate)) is None:
                phone = candidate
                break
        if phone is None:
            raise SystemExit("No unused demo phone available")
        user = User(name="FareCare Demo Driver", email=EMAIL, phone=phone,
                    password_hash=pwd.hash(PASSWORD), role="driver")
        db.add(user)
        db.flush()
        print("Created demo driver")
    elif user.role != "driver":
        raise SystemExit("Demo email belongs to non-driver; refusing to overwrite")
    else:
        print("Reusing existing demo driver and phone")
    user.password_hash = pwd.hash(PASSWORD)
    profile = db.scalar(select(DriverProfile).where(DriverProfile.user_id == user.id))
    if profile is None:
        profile = DriverProfile(user_id=user.id, licence_number="DEMO-LICENCE-001",
                                vehicle_registration="DEMO-AUTO-001", vehicle_type="Auto")
        db.add(profile)
    profile.approved = True
    profile.approved_at = date.today()
    db.commit()
print(f"Ready: {EMAIL} / {PASSWORD}")
