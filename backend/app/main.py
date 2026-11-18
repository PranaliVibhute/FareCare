from datetime import date, datetime, timedelta
import os
import secrets
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, func, text
from passlib.context import CryptContext
from .database import Base, engine, get_db
from .models import User, DriverProfile, DailyFee, GraceMonth, Payment, Ride, RideStopDetail, RideGeo

Base.metadata.create_all(bind=engine)
# Lightweight additive schema migration for existing local demo SQLite databases.
with engine.begin() as conn:
    user_cols = {row[1] for row in conn.exec_driver_sql('PRAGMA table_info(users)')} if engine.dialect.name == 'sqlite' else set()
    if engine.dialect.name == 'sqlite' and 'gender' not in user_cols:
        conn.exec_driver_sql('ALTER TABLE users ADD COLUMN gender VARCHAR(24)')
    cols = {row[1] for row in conn.exec_driver_sql('PRAGMA table_info(rides)')} if engine.dialect.name == 'sqlite' else set()
    if engine.dialect.name == 'sqlite':
        for name, typ in [('status','VARCHAR(32)'),('driver_user_id','INTEGER'),('boarded_at','DATETIME'),('extension_approved','BOOLEAN DEFAULT 0')]:
            if name not in cols: conn.exec_driver_sql(f'ALTER TABLE rides ADD COLUMN {name} {typ}')
app = FastAPI(title="FareCare API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
pwd = CryptContext(schemes=["argon2"], deprecated="auto")
DAILY_FEE = int(os.getenv("DAILY_PLATFORM_FEE_PAISE", "1500"))

class SignupIn(BaseModel):
    name: str
    email: EmailStr
    phone: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=8)
    role: str
    gender: str | None = None
    licence_number: str | None = None
    vehicle_registration: str | None = None
    vehicle_type: str | None = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    role: str

class PaymentIn(BaseModel):
    amount_paise: int = Field(gt=0)
    reference: str | None = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "FareCare API"}

@app.post("/auth/signup")
def signup(data: SignupIn, db: Session = Depends(get_db)):
    if data.role not in {"passenger", "driver"}:
        raise HTTPException(400, "Role must be passenger or driver")
    if data.role == 'passenger' and data.gender not in {'woman', 'man', 'nonbinary', 'prefer_not_to_say'}:
        raise HTTPException(400, 'Select a gender when registering as a passenger')
    if db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(409, "Email already registered")
    if db.scalar(select(User).where(User.phone == data.phone)):
        raise HTTPException(409, "Phone already registered")
    if data.role == "driver" and not all([data.licence_number, data.vehicle_registration, data.vehicle_type]):
        raise HTTPException(400, "Driver licence and vehicle details are required")
    user = User(name=data.name, email=data.email, phone=data.phone,
                password_hash=pwd.hash(data.password), role=data.role,
                gender=data.gender if data.role == "passenger" else None)
    db.add(user); db.flush()
    if data.role == "driver":
        db.add(DriverProfile(user_id=user.id, licence_number=data.licence_number,
             vehicle_registration=data.vehicle_registration, vehicle_type=data.vehicle_type, approved=False))
    db.commit()
    return {"message": "Account created", "user_id": user.id,
            "approval_required": data.role == "driver"}

@app.post("/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email, User.role == data.role))
    if not user or not pwd.verify(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email, password or role")
    return {"user_id": user.id, "name": user.name, "role": user.role, "gender": user.gender}

def ensure_daily_billing(db: Session, driver: DriverProfile, today: date):
    """Create one ₹15 fee per calendar day from approval date; never rewrite past fees."""
    if not driver.approved or not driver.approved_at:
        raise HTTPException(403, "Driver account is awaiting admin approval")
    start = driver.approved_at
    existing = set(db.scalars(select(DailyFee.fee_date).where(
        DailyFee.driver_id == driver.id, DailyFee.fee_date >= start, DailyFee.fee_date <= today
    )).all())
    cursor = start
    while cursor <= today:
        if cursor not in existing:
            month = cursor.strftime("%Y-%m")
            grace = db.scalar(select(GraceMonth).where(
                GraceMonth.driver_id == driver.id, GraceMonth.month_key == month
            ))
            if not grace:
                grace = GraceMonth(driver_id=driver.id, month_key=month, missed_days_used=0, penalty_days=0)
                db.add(grace); db.flush()
            # A fee is a missed-payment day when a previous daily fee remains unpaid.
            prior_balance = db.scalar(select(func.coalesce(func.sum(DailyFee.amount_paise + DailyFee.penalty_paise - DailyFee.paid_paise), 0))
                                      .where(DailyFee.driver_id == driver.id, DailyFee.fee_date < cursor))
            penalty = 0
            if prior_balance and prior_balance > 0:
                if grace.missed_days_used < 3:
                    grace.missed_days_used += 1
                else:
                    grace.penalty_days += 1
                    penalty = 200
            db.add(DailyFee(driver_id=driver.id, fee_date=cursor, amount_paise=DAILY_FEE, penalty_paise=penalty))
        cursor += timedelta(days=1)
    db.commit()

def driver_for_user(db: Session, user_id: int):
    driver = db.scalar(select(DriverProfile).where(DriverProfile.user_id == user_id))
    if not driver:
        raise HTTPException(404, "Driver profile not found")
    return driver

@app.get("/drivers/{user_id}/billing")
def billing(user_id: int, db: Session = Depends(get_db)):
    driver = driver_for_user(db, user_id)
    ensure_daily_billing(db, driver, date.today())
    rows = db.scalars(select(DailyFee).where(DailyFee.driver_id == driver.id).order_by(DailyFee.fee_date.desc())).all()
    total = sum(x.amount_paise + x.penalty_paise - x.paid_paise for x in rows)
    month = date.today().strftime("%Y-%m")
    grace = db.scalar(select(GraceMonth).where(GraceMonth.driver_id == driver.id, GraceMonth.month_key == month))
    return {"balance_paise": total, "daily_fee_paise": DAILY_FEE, "ride_commission_percent": 0,
            "grace_used": grace.missed_days_used if grace else 0,
            "grace_remaining": max(0, 3 - (grace.missed_days_used if grace else 0)),
            "fees": [{"date": x.fee_date, "fee_paise": x.amount_paise, "penalty_paise": x.penalty_paise,
                      "paid_paise": x.paid_paise} for x in rows]}

@app.post("/drivers/{user_id}/payments")
def record_payment(user_id: int, data: PaymentIn, db: Session = Depends(get_db)):
    driver = driver_for_user(db, user_id)
    ensure_daily_billing(db, driver, date.today())
    rows = db.scalars(select(DailyFee).where(DailyFee.driver_id == driver.id, DailyFee.paid_paise < DailyFee.amount_paise + DailyFee.penalty_paise).order_by(DailyFee.fee_date)).all()
    balance = sum(x.amount_paise + x.penalty_paise - x.paid_paise for x in rows)
    if data.amount_paise > balance:
        raise HTTPException(400, "Payment cannot exceed outstanding balance")
    remaining = data.amount_paise
    for row in rows:
        due = row.amount_paise + row.penalty_paise - row.paid_paise
        applied = min(due, remaining)
        row.paid_paise += applied
        remaining -= applied
        if remaining == 0: break
    db.add(Payment(driver_id=driver.id, amount_paise=data.amount_paise, reference=data.reference))
    db.commit()
    return {"message": "Payment recorded", "paid_paise": data.amount_paise, "remaining_balance_paise": balance-data.amount_paise,
            "grace_chances_restored": 0}

def require_admin(x_admin_key: str | None = Header(default=None)):
    configured = os.getenv("FARECARE_ADMIN_KEY", "")
    if not configured or not x_admin_key or not secrets.compare_digest(configured, x_admin_key):
        raise HTTPException(403, "Invalid admin key or admin access not configured")
    return True

@app.get("/admin/overview")
def admin_overview(_: bool = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()
    drivers = db.scalars(select(DriverProfile).order_by(DriverProfile.id.desc())).all()
    rides = db.scalars(select(Ride).order_by(Ride.id.desc())).all()
    fees = db.scalars(select(DailyFee)).all()
    payments = db.scalars(select(Payment)).all()
    return {
        "metrics": {"passengers": sum(u.role == "passenger" for u in users),
                    "drivers": len(drivers), "pending_drivers": sum(not d.approved for d in drivers),
                    "rides": len(rides), "active_rides": sum((r.status or "") in ("requested", "confirmed") for r in rides),
                    "completed_rides": sum(r.status == "completed" for r in rides),
                    "recorded_fees_paise": sum(f.amount_paise + f.penalty_paise for f in fees),
                    "recorded_payments_paise": sum(p.amount_paise for p in payments),
                    "outstanding_paise": sum(f.amount_paise + f.penalty_paise - f.paid_paise for f in fees)},
        "drivers": [{"id": d.id, "user_id": d.user_id, "name": next((u.name for u in users if u.id == d.user_id), ""),
                     "vehicle": d.vehicle_registration, "type": d.vehicle_type, "approved": d.approved} for d in drivers],
        "rides": [{"id": r.id, "pickup": r.pickup, "destination": r.destination,
                   "status": r.status, "driver_user_id": r.driver_user_id, "user_id": r.user_id,
                   "fare_paise": r.estimated_share_paise, "group_id": r.group_id,
                   "boarded": r.boarded_at is not None} for r in rides[:100]]}

@app.get("/admin/driver-fees")
def admin_driver_fees(_: bool = Depends(require_admin), db: Session = Depends(get_db)):
    today = date.today()
    profiles = db.scalars(select(DriverProfile).order_by(DriverProfile.id)).all()
    users = {u.id: u for u in db.scalars(select(User).where(User.role == "driver")).all()}
    result = []
    for driver in profiles:
        if driver.approved and driver.approved_at:
            ensure_daily_billing(db, driver, today)
        fees = db.scalars(select(DailyFee).where(DailyFee.driver_id == driver.id)).all()
        payments = db.scalars(select(Payment).where(Payment.driver_id == driver.id).order_by(Payment.paid_at.desc())).all()
        grace = db.scalar(select(GraceMonth).where(GraceMonth.driver_id == driver.id, GraceMonth.month_key == today.strftime("%Y-%m")))
        total = sum(x.amount_paise + x.penalty_paise for x in fees)
        paid = sum(x.paid_paise for x in fees)
        due = max(0, total - paid)
        grace_used = grace.missed_days_used if grace else 0
        penalty_days = grace.penalty_days if grace else 0
        if not driver.approved:
            status = "not_approved"
        elif penalty_days > 0 and due > 0:
            status = "penalty_due"
        elif due > 0:
            status = "unpaid"
        elif fees:
            status = "paid"
        else:
            status = "no_fees"
        user = users.get(driver.user_id)
        result.append({"driver_id":driver.id, "name":user.name if user else "Unknown", "vehicle":driver.vehicle_registration,
                       "approved":driver.approved, "status":status, "fee_paise":total,
                       "paid_paise":paid, "outstanding_paise":due, "grace_used":grace_used,
                       "grace_remaining":max(0,3-grace_used), "penalty_days":penalty_days,
                       "penalty_paise":sum(x.penalty_paise for x in fees),
                       "last_payment":payments[0].paid_at.isoformat() if payments else None})
    return {"daily_fee_paise":DAILY_FEE, "commission_percent":0, "grace_limit":3,
            "penalty_per_day_paise":200, "drivers":result,
            "counts":{k:sum(d["status"]==k for d in result) for k in ("paid","unpaid","penalty_due","not_approved","no_fees")}}

@app.post("/admin/drivers/{driver_id}/approve")
def approve_driver(driver_id: int, _: bool = Depends(require_admin), db: Session = Depends(get_db)):
    # Protect this endpoint with admin authentication before production deployment.
    driver = db.get(DriverProfile, driver_id)
    if not driver: raise HTTPException(404, "Driver not found")
    if driver.approved: return {"message": "Driver already approved"}
    driver.approved = True
    driver.approved_at = date.today()
    db.commit()
    return {"message": "Driver approved; daily billing begins today", "approved_at": driver.approved_at}


@app.post("/admin/drivers/{driver_id}/suspend")
def suspend_driver(driver_id: int, _: bool = Depends(require_admin), db: Session = Depends(get_db)):
    driver = db.get(DriverProfile, driver_id)
    if not driver: raise HTTPException(404, "Driver not found")
    driver.approved = False
    db.commit()
    return {"message": "Driver suspended from approval-based operations; existing rides require manual review"}


# HACKATHON DEMO: These ride endpoints use user IDs without authorization.
# Do not expose this server publicly until JWT authentication and ownership checks are added.
class RideIn(BaseModel):
    user_id: int
    vehicle: str
    pickup: str = Field(min_length=2)
    destination: str = Field(min_length=2)
    date: str
    time: str
    passengers: int = Field(ge=1, le=6)
    preference: str = "shared"
    pink_mode: bool = False
    actual_pickup: str = Field(default="", max_length=255)
    actual_dropoff: str = Field(default="", max_length=255)
    journey_kind: str = "initiator"
    pickup_lat: float | None = Field(default=None, ge=-90, le=90)
    pickup_lng: float | None = Field(default=None, ge=-180, le=180)
    dropoff_lat: float | None = Field(default=None, ge=-90, le=90)
    dropoff_lng: float | None = Field(default=None, ge=-180, le=180)

# Administrator-defined fare boundaries. Sample fares supplied by project owner.
# Actual intermediate pickup/drop-off descriptions do not change the fare.
ROUTES = {"pcmc-walhekarwadi": {
    "name": "PCMC Metro → Walhekarwadi", "vehicle": "auto",
    "points": ["PCMC Metro Station", "I-Venus / Physics Wallah", "Chapekar Chowk", "Walhekarwadi"],
    "segment_paise": [2000, 1000, 1000],
    "intermediate_examples": ["Aher Garden (between Chapekar Chowk and Walhekarwadi)"]
}, "ktown-ravet": {
    "name": "K-Town Gate → Ravet Chowk", "vehicle": "auto",
    "points": ["K-Town Gate", "Mukai Chowk", "Ravet Chowk"],
    "segment_paise": [1000, 2000],
    "intermediate_examples": []
}, "vit-mandai": {
    "name": "VIT Pune Gate → Mandai", "vehicle": "auto",
    "points": ["VIT Pune Gate", "Bibwewadi", "Swargate", "Mandai"],
    "segment_paise": [1000, 1000, 1000],
    "intermediate_examples": []
}}
# Demo reference coordinates (latitude, longitude). Verify exact gate/stop pins before deployment.
# Pickup eligibility uses a 1 km radius (2 km diameter), not the old 15 km discovery radius.
PICKUP_RADIUS_KM = 1.0
PICKUP_COORDINATES = {
    "PCMC Metro Station": (18.6290, 73.7999),
    "I-Venus / Physics Wallah": (18.6380, 73.7978),
    "Chapekar Chowk": (18.6462, 73.7970),
    "Walhekarwadi": (18.6588, 73.7800),
    "K-Town Gate": (18.6530, 73.7410),
    "Mukai Chowk": (18.6565, 73.7440),
    "Ravet Chowk": (18.6470, 73.7530),
    "VIT Pune Gate": (18.464152, 73.867668),
    "Bibwewadi": (18.4720, 73.8630),
    "Swargate": (18.5018, 73.8585),
    "Mandai": (18.5155, 73.8564),
}

def pickup_distance_km(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, asin, sqrt
    dlat, dlon = radians(lat2-lat1), radians(lon2-lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 6371.0 * 2 * asin(min(1.0, sqrt(a)))

@app.get("/routes/pickup-anchors")
def pickup_anchors():
    return {"radius_metres": 1000, "coordinates": {k: {"lat": v[0], "lng": v[1]} for k,v in PICKUP_COORDINATES.items()}, "note": "Approximate demo stop coordinates; verify pins before use."}

BASE_FARES = {"auto": 10000, "sedan": 24000, "xuv": 36000, "parcel": 8000}

def route_fare(pickup: str, destination: str):
    for route_id, route in ROUTES.items():
        points = route["points"]
        indices = {route_key(name): i for i, name in enumerate(points)}
        a, b = indices.get(route_key(pickup)), indices.get(route_key(destination))
        if a is not None and b is not None:
            if a == b:
                raise HTTPException(400, "Pickup and drop-off must be different")
            lo, hi = sorted((a, b))
            return sum(route["segment_paise"][lo:hi]), route_id
    return None, None

@app.get("/routes")
def configured_routes():
    return {"routes": [{"id": key, **route} for key, route in ROUTES.items()],
            "note": "Joining riders pay segment fares; original rider begins at an illustrative private-auto fare and has a shared-fare floor. Uber prices are NOT live."}

@app.get("/routes/fare")
def configured_fare(pickup: str, destination: str):
    fare, route_id = route_fare(pickup, destination)
    if fare is None:
        raise HTTPException(404, "No configured route for these fare points")
    return {"route_id": route_id, "fare_paise": fare, "currency": "INR"}


def ride_json(r):
    return {"id": r.id, "vehicle": r.vehicle, "pickup": r.pickup, "destination": r.destination,
            "date": r.travel_date, "time": r.travel_time, "passengers": r.passengers,
            "preference": r.preference, "pink_mode": r.pink_mode, "group_id": r.group_id,
            "estimated_total_paise": r.estimated_total_paise,
            "estimated_share_paise": r.estimated_share_paise, "boarded": r.boarded_at is not None, "status": r.status or "requested", "driver_user_id": r.driver_user_id}

def route_key(s):
    return " ".join(s.casefold().strip().split())

@app.post("/rides")
def create_ride(data: RideIn, db: Session = Depends(get_db)):
    user = db.get(User, data.user_id)
    if not user or user.role != "passenger":
        raise HTTPException(400, "Create a passenger account and log in first")
    if data.pink_mode and user.gender != 'woman':
        raise HTTPException(403, 'Pink Mode is available only to passengers registered as women. Existing passengers must update their gender before using it.')
    if data.journey_kind not in {"initiator", "joiner"}:
        raise HTTPException(400,"Invalid passenger mode")
    if data.pickup_lat is None or data.pickup_lng is None:
        raise HTTPException(400,"Current GPS pickup is required")
    anchor = next((name for name in PICKUP_COORDINATES if route_key(name) == route_key(data.pickup)), None)
    if anchor is None:
        raise HTTPException(400, "Unknown pickup fare point")
    anchor_lat, anchor_lng = PICKUP_COORDINATES[anchor]
    distance = pickup_distance_km(data.pickup_lat, data.pickup_lng, anchor_lat, anchor_lng)
    if distance > PICKUP_RADIUS_KM:
        closest = min(PICKUP_COORDINATES, key=lambda name: pickup_distance_km(data.pickup_lat, data.pickup_lng, *PICKUP_COORDINATES[name]))
        nearest_distance = pickup_distance_km(data.pickup_lat, data.pickup_lng, *PICKUP_COORDINATES[closest])
        raise HTTPException(400, f"Pickup unavailable: {anchor} is {distance:.1f} km from your GPS location. Pickup must be within 1 km. Nearest configured stop: {closest} ({nearest_distance:.1f} km).")
    if (data.dropoff_lat is None) != (data.dropoff_lng is None):
        raise HTTPException(400,"Incomplete destination coordinates")
    vehicle = data.vehicle.lower()
    if vehicle not in BASE_FARES:
        raise HTTPException(400, "Unsupported vehicle")
    if route_key(data.pickup) == route_key(data.destination):
        raise HTTPException(400, "Pickup and destination must differ")
    if data.preference not in {"shared", "private"}:
        raise HTTPException(400, "Invalid ride preference")
    configured, route_id = route_fare(data.pickup, data.destination)
    if configured is None:
        raise HTTPException(400, "Choose a configured main fare point route; other routes are not priced yet")
    if ROUTES[route_id]["vehicle"] != vehicle:
        raise HTTPException(400, "Selected route supports Auto only")
    base = BASE_FARES[vehicle] if data.journey_kind == "initiator" else configured * data.passengers
    r = Ride(user_id=data.user_id, vehicle=vehicle, pickup=data.pickup.strip(),
             destination=data.destination.strip(), travel_date=data.date, travel_time=data.time,
             passengers=data.passengers, preference=data.preference, pink_mode=data.pink_mode,
             estimated_total_paise=base, estimated_share_paise=base)
    db.add(r); db.flush()
    db.add(RideStopDetail(ride_id=r.id, actual_pickup=data.actual_pickup.strip(), actual_dropoff=data.actual_dropoff.strip()))
    db.add(RideGeo(ride_id=r.id, journey_kind=data.journey_kind, pickup_lat=data.pickup_lat,
                   pickup_lng=data.pickup_lng, dropoff_lat=data.dropoff_lat, dropoff_lng=data.dropoff_lng))
    # Driver confirmation is required. Overlap is evaluated at dispatch, not booking.
    r.status='requested'
    db.commit(); db.refresh(r)
    return {"message": "Demo booking saved", "ride": ride_json(r),
            "matched": False,
            "disclaimer": "Person A starts at an illustrative private-auto fare; only boarded joiners reduce A payable, never below the shared-auto floor. No real payments collected."}

@app.get("/rides/user/{user_id}")
def user_rides(user_id: int, db: Session = Depends(get_db)):
    rows = db.scalars(select(Ride).where(Ride.user_id == user_id).order_by(Ride.id.desc())).all()
    return {"rides": [{**ride_json(x), "actual_pickup": (d.actual_pickup if d else ""),
                         "actual_dropoff": (d.actual_dropoff if d else "")}
                       for x in rows for d in [db.get(RideStopDetail, x.id)]]}

@app.get("/rides/demo")
def demo_rides(db: Session = Depends(get_db)):
    rows = db.scalars(select(Ride).order_by(Ride.id.desc()).limit(30)).all()
    return {"rides": [ride_json(x) for x in rows], "demo_only": True}


# DEMO DISPATCH: simulated route progress is entered by the driver; NOT live GPS.
# Route eligibility checks use the main fare-point order and do not validate
# intermediate pickup geometry. This must not be used for real dispatch.
class DriverProgressIn(BaseModel):
    driver_user_id: int
    point: str

class DispatchActionIn(BaseModel):
    driver_user_id: int
    continue_beyond_initiator: bool = False

DRIVER_PROGRESS = {}  # ephemeral demo state, resets when backend restarts

def driver_account(db, user_id):
    u=db.get(User,user_id)
    if not u or u.role!='driver': raise HTTPException(403,'Driver account required')
    return u

def ride_indices(r):
    for route_id,route in ROUTES.items():
        pts=route['points']
        if r.pickup in pts and r.destination in pts:
            return route_id,pts.index(r.pickup),pts.index(r.destination)
    return None,None,None

@app.get('/dispatch/progress/{driver_user_id}')
def get_progress(driver_user_id:int,db:Session=Depends(get_db)):
    driver_account(db,driver_user_id)
    return {'point':DRIVER_PROGRESS.get(driver_user_id,'PCMC Metro Station'),'simulated':True}

@app.post('/dispatch/progress')
def set_progress(data:DriverProgressIn,db:Session=Depends(get_db)):
    driver_account(db,data.driver_user_id)
    if not any(data.point in route['points'] for route in ROUTES.values()):
        raise HTTPException(400,'Unknown route point')
    DRIVER_PROGRESS[data.driver_user_id]=data.point
    return {'point':data.point,'simulated':True}

# Demo-only route-progress logic: the configured pickup fare anchor stands in for
# a verified roadside GPS map-match. It is NOT a real roadside safety check.
DEMO_SEATS = 3

def dispatch_evaluation(db, driver_id, r):
    route_id, start, end = ride_indices(r)
    if route_id is None or start is None or end == start:
        return False, 'Unsupported route or direction', None
    progress_point = DRIVER_PROGRESS.get(driver_id, ROUTES[route_id]['points'][0])
    if progress_point not in ROUTES[route_id]['points']:
        return False, 'Driver simulated position is on another route; choose a point on this route', None
    progress = ROUTES[route_id]['points'].index(progress_point)
    if (end-start)*(start-progress) < 0:
        return False, 'Pickup fare anchor is already behind driver for this direction (simulation)', None
    geo = db.get(RideGeo, r.id)
    if geo and geo.journey_kind == 'joiner':
        parents = db.scalars(select(Ride).where(Ride.driver_user_id == driver_id,
            Ride.status == 'confirmed', Ride.preference == 'shared').order_by(Ride.id)).all()
        parent = next((p for p in parents if p.id != r.id
            and (db.get(RideGeo, p.id) is not None)
            and db.get(RideGeo, p.id).journey_kind == 'initiator'
            and p.travel_date == r.travel_date
            and ride_indices(p)[0] == route_id
            and (ride_indices(p)[2]-ride_indices(p)[1])*(end-start) > 0
            and min(ride_indices(p)[1],ride_indices(p)[2]) <= min(start,end)
            and max(start,end) <= max(ride_indices(p)[1],ride_indices(p)[2])), None)
        if not parent:
            return False, 'Ride Joiner must join an existing confirmed Ride Initiator route', None
        if parent.pink_mode != r.pink_mode:
            return False, 'Pink Mode riders can join only Pink Mode rides; regular riders can join only regular rides', None
        if parent.pink_mode:
            parent_user = db.get(User, parent.user_id)
            joiner_user = db.get(User, r.user_id)
            if not parent_user or parent_user.gender != 'woman' or not joiner_user or joiner_user.gender != 'woman':
                return False, 'Pink Mode requires both Ride Initiator and Ride Joiner to be registered as women', None
        assigned = db.scalars(select(Ride).where(Ride.driver_user_id == driver_id,
            Ride.status == 'confirmed')).all()
        overlapping = sum(x.passengers for x in assigned if x.travel_date == r.travel_date
            and ride_indices(x)[0] == route_id
            and min(ride_indices(x)[1],ride_indices(x)[2]) < max(start,end)
            and min(start,end) < max(ride_indices(x)[1],ride_indices(x)[2]))
        if overlapping + r.passengers > DEMO_SEATS:
            return False, f'Capacity exceeded: demo auto has {DEMO_SEATS} passenger seats', None
        parent_detail=db.get(RideStopDetail,parent.id)
        extension_needed=bool(parent_detail and parent_detail.actual_dropoff.strip() and end==ride_indices(parent)[2])
        return True, ('DRIVER CONSENT REQUIRED: Ride Initiator has an intermediate home drop-off; agree to continue to the next common point for this Ride Joiner. ' if extension_needed else '')+'DEMO ONLY: route anchors and capacity checked; actual roadside geometry NOT verified', parent.id
    # Person A initiates a ride; demo driver can only take one active initiator at a time.
    active = db.scalars(select(Ride).where(Ride.driver_user_id == driver_id,
        Ride.status == 'confirmed')).all()
    if any(db.get(RideGeo, x.id) and db.get(RideGeo, x.id).journey_kind == 'initiator' for x in active):
        return False, 'Driver already has an active initiating ride; join as Person B instead', None
    if r.passengers > DEMO_SEATS:
        return False, f'Demo auto capacity is {DEMO_SEATS} passengers', None
    return True, 'DEMO ONLY: pickup anchor ahead of simulated driver; roadside GPS NOT verified', None

@app.get('/dispatch/requests/{driver_user_id}')
def dispatch_requests(driver_user_id:int,db:Session=Depends(get_db)):
    driver_account(db,driver_user_id)
    point=DRIVER_PROGRESS.get(driver_user_id,'PCMC Metro Station')
    rides=db.scalars(select(Ride).where(Ride.vehicle=='auto',Ride.preference=='shared',
        Ride.driver_user_id.is_(None),Ride.status=='requested').order_by(Ride.id.desc())).all()
    results=[]
    for r in rides:
        eligible,reason,parent_id=dispatch_evaluation(db,driver_user_id,r)
        details=db.get(RideStopDetail,r.id)
        geo=db.get(RideGeo,r.id)
        parent=db.get(Ride,parent_id) if parent_id else None
        parent_detail=db.get(RideStopDetail,parent_id) if parent_id else None
        requires_extension=bool(parent and parent_detail and parent_detail.actual_dropoff.strip() and ride_indices(r)[2]==ride_indices(parent)[2])
        results.append({**ride_json(r),'eligible':eligible,'reason':reason,'requires_extension_consent':requires_extension,
            'journey_kind':geo.journey_kind if geo else 'initiator',
            'parent_ride_id':parent_id,
            'actual_pickup':details.actual_pickup if details else '',
            'actual_dropoff':details.actual_dropoff if details else ''})
    return {'requests':results,'driver_point':point,'simulation':True,'seats':DEMO_SEATS}

@app.post('/dispatch/rides/{ride_id}/accept')
def accept_ride(ride_id:int,data:DispatchActionIn,db:Session=Depends(get_db)):
    driver_account(db,data.driver_user_id)
    r=db.get(Ride,ride_id)
    if not r:raise HTTPException(404,'Ride not found')
    if r.driver_user_id is not None or (r.status or 'requested')!='requested':
        raise HTTPException(409,'Ride already handled')
    eligible,reason,parent_id=dispatch_evaluation(db,data.driver_user_id,r)
    if not eligible:raise HTTPException(409,reason)
    if parent_id:
        parent=db.get(Ride,parent_id)
        details=db.get(RideStopDetail,parent_id)
        needs_extension=bool(details and details.actual_dropoff.strip() and ride_indices(r)[2]==ride_indices(parent)[2])
        if needs_extension and not data.continue_beyond_initiator:
            raise HTTPException(409,'Driver must explicitly agree to continue beyond Ride Initiator home to the next common point')
        r.extension_approved=bool(needs_extension and data.continue_beyond_initiator)
    r.driver_user_id=data.driver_user_id
    r.group_id=parent_id if parent_id else r.id
    r.status='confirmed'
    db.commit()
    return {'message':'Driver accepted after rechecking simulated route eligibility',
            'ride':ride_json(r),'simulation':True,
            'warning':'GPS roadside path was not verified; demo only'}

@app.post('/dispatch/rides/{ride_id}/reject')
def reject_ride(ride_id:int,data:DispatchActionIn,db:Session=Depends(get_db)):
    driver_account(db,data.driver_user_id)
    r=db.get(Ride,ride_id)
    if not r:raise HTTPException(404,'Ride not found')
    if r.driver_user_id is not None or r.status!='requested':raise HTTPException(409,'Already handled')
    # A driver may decline a pending request even when route eligibility fails.
    # Do not reject requests on behalf of other drivers in production.
    r.status='rejected';db.commit();return {'message':'Request rejected','ride':ride_json(r)}

@app.post('/dispatch/rides/{ride_id}/complete')
def complete_ride(ride_id:int,data:DispatchActionIn,db:Session=Depends(get_db)):
    driver_account(db,data.driver_user_id)
    r=db.get(Ride,ride_id)
    if not r or r.driver_user_id!=data.driver_user_id:raise HTTPException(403,'Not your assigned ride')
    if r.status!='confirmed':raise HTTPException(409,'Ride is not confirmed')
    children=db.scalars(select(Ride).where(Ride.group_id==r.id,Ride.status=='confirmed')).all()
    if r.group_id==r.id and any(x.id!=r.id and not x.extension_approved for x in children):
        raise HTTPException(409,'Joined passengers still aboard without driver-approved onward continuation')
    r.status='completed'
    if r.group_id and r.group_id != r.id: recalculate_initiator(db,r.group_id)
    db.commit();return {'ride':ride_json(r)}

@app.get('/dispatch/assigned/{driver_user_id}')
def assigned_rides(driver_user_id:int,db:Session=Depends(get_db)):
    driver_account(db,driver_user_id)
    rows=db.scalars(select(Ride).where(Ride.driver_user_id==driver_user_id).order_by(Ride.id.desc())).all()
    return {'rides':[ride_json(r) for r in rows]}


# FARECARE DYNAMIC PRICING: Person A's private fare is reduced ONLY by
# Ride Joiners who actually boarded, with A's shared-route fare as floor.
# Money is represented as integer paise. No actual money changes hands here.
def recalculate_initiator(db: Session, group_id: int):
    parent = db.get(Ride, group_id)
    if not parent:
        raise HTTPException(404, 'Original ride not found')
    geo = db.get(RideGeo, parent.id)
    if not geo or geo.journey_kind != 'initiator':
        raise HTTPException(409, 'Group has no initiating passenger')
    shared_floor, parent_route = route_fare(parent.pickup, parent.destination)
    if shared_floor is None:
        raise HTTPException(409, 'Shared-fare floor unavailable for this route')
    private_fare = parent.estimated_total_paise
    minimum = shared_floor * parent.passengers
    children = db.scalars(select(Ride).where(Ride.group_id == group_id, Ride.id != group_id)).all()
    # Once boarded, a passenger contributes even after completing their trip.
    # Recompute each boarded joiner's contribution from their OWN selected
    # fare-point interval. Never apply a universal ₹30 joining fare.
    contribution = 0
    for child in children:
        if child.boarded_at is None:
            continue
        child_fare, child_route = route_fare(child.pickup, child.destination)
        if child_fare is None or child_route != parent_route:
            raise HTTPException(409, 'Boarded joining passenger has an invalid fare-point route')
        contribution += child_fare * child.passengers
    parent.estimated_share_paise = max(minimum, private_fare - contribution)
    return {'ride_id':parent.id,'private_fare_paise':private_fare,
            'shared_floor_paise':minimum,'boarded_contributions_paise':contribution,
            'payable_paise':parent.estimated_share_paise,
            'savings_paise':private_fare-parent.estimated_share_paise,
            'boarded_joiners':sum(1 for c in children if c.boarded_at is not None),
            'provisional':parent.status != 'completed',
            'note':'Private fare is a configured demo quote, not a live Uber price.'}

@app.get('/rides/{ride_id}/fare-breakdown')
def fare_breakdown(ride_id:int, db:Session=Depends(get_db)):
    r=db.get(Ride,ride_id)
    if not r:raise HTTPException(404,'Ride not found')
    geo=db.get(RideGeo,r.id)
    if geo and geo.journey_kind == 'initiator':
        return recalculate_initiator(db,r.id)
    return {'ride_id':r.id,'journey_kind':'joiner','payable_paise':r.estimated_share_paise,
            'boarded':r.boarded_at is not None,'note':'Joining passenger pays the sum of their own travelled route-segment fares, not a universal ₹30.'}

@app.post('/dispatch/rides/{ride_id}/board')
def board_ride(ride_id:int,data:DispatchActionIn,db:Session=Depends(get_db)):
    driver_account(db,data.driver_user_id)
    r=db.get(Ride,ride_id)
    if not r or r.driver_user_id!=data.driver_user_id:
        raise HTTPException(403,'Ride is not assigned to this driver')
    if r.status != 'confirmed':
        raise HTTPException(409,'Only confirmed rides can board')
    if r.boarded_at is not None:
        raise HTTPException(409,'Passenger already boarded')
    geo=db.get(RideGeo,r.id)
    if geo and geo.journey_kind == 'joiner':
        eligible,reason,parent_id=dispatch_evaluation_for_boarding(db,data.driver_user_id,r)
        if not eligible:raise HTTPException(409,reason)
    r.boarded_at=datetime.utcnow()
    breakdown=None
    if r.group_id and r.group_id != r.id:
        breakdown=recalculate_initiator(db,r.group_id)
    elif geo and geo.journey_kind == 'initiator':
        breakdown=recalculate_initiator(db,r.id)
    db.commit()
    return {'message':'Boarding recorded','ride':ride_json(r),'initiator_fare':breakdown,
            'simulation':True}

def dispatch_evaluation_for_boarding(db,driver_id,r):
    # Simulated point ordering, NOT GPS geometry. The pickup point must not
    # be behind the driver when boarding is recorded.
    route_id,start,end=ride_indices(r)
    if route_id is None:return False,'Unknown route',None
    point=DRIVER_PROGRESS.get(driver_id,ROUTES[route_id]['points'][0])
    if point not in ROUTES[route_id]['points']:
        return False,'Driver simulated position is on another route',None
    progress=ROUTES[route_id]['points'].index(point)
    if (end-start)*(progress-start)>0:return False,'Driver has passed the joining pickup (simulated)',None
    parent=db.get(Ride,r.group_id) if r.group_id else None
    if not parent or parent.status != 'confirmed':
        return False,'Initiating ride is not active',None
    return True,'Eligible by simulated route anchors',parent.id
