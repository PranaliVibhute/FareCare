from datetime import date, datetime
from sqlalchemy import String, Integer, Boolean, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    gender: Mapped[str | None] = mapped_column(String(24), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class DriverProfile(Base):
    __tablename__ = "driver_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    licence_number: Mapped[str] = mapped_column(String(100))
    vehicle_registration: Mapped[str] = mapped_column(String(30))
    vehicle_type: Mapped[str] = mapped_column(String(30))
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_at: Mapped[date | None] = mapped_column(Date, nullable=True)

class DailyFee(Base):
    __tablename__ = "daily_fees"
    __table_args__ = (UniqueConstraint("driver_id", "fee_date", name="uq_driver_fee_date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("driver_profiles.id"), index=True)
    fee_date: Mapped[date] = mapped_column(Date, index=True)
    amount_paise: Mapped[int] = mapped_column(Integer, default=1500)
    penalty_paise: Mapped[int] = mapped_column(Integer, default=0)
    paid_paise: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class GraceMonth(Base):
    __tablename__ = "driver_grace_months"
    __table_args__ = (UniqueConstraint("driver_id", "month_key", name="uq_driver_grace_month"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("driver_profiles.id"), index=True)
    month_key: Mapped[str] = mapped_column(String(7))
    missed_days_used: Mapped[int] = mapped_column(Integer, default=0)
    penalty_days: Mapped[int] = mapped_column(Integer, default=0)

class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("driver_profiles.id"), index=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)

class Ride(Base):
    __tablename__ = "rides"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vehicle: Mapped[str] = mapped_column(String(30))
    pickup: Mapped[str] = mapped_column(String(255))
    destination: Mapped[str] = mapped_column(String(255))
    travel_date: Mapped[str] = mapped_column(String(10))
    travel_time: Mapped[str] = mapped_column(String(5))
    passengers: Mapped[int] = mapped_column(Integer, default=1)
    preference: Mapped[str] = mapped_column(String(20), default="shared")
    pink_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_total_paise: Mapped[int] = mapped_column(Integer)
    estimated_share_paise: Mapped[int] = mapped_column(Integer)
    status: Mapped[str | None] = mapped_column(String(32), default='requested', nullable=True)
    driver_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extension_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    boarded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class RideStopDetail(Base):
    __tablename__ = "ride_stop_details"
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), primary_key=True)
    actual_pickup: Mapped[str] = mapped_column(String(255), default="")
    actual_dropoff: Mapped[str] = mapped_column(String(255), default="")


class RideGeo(Base):
    __tablename__ = "ride_geo"
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), primary_key=True)
    journey_kind: Mapped[str] = mapped_column(String(20), default="initiator")
    pickup_lat: Mapped[float | None] = mapped_column(nullable=True)
    pickup_lng: Mapped[float | None] = mapped_column(nullable=True)
    dropoff_lat: Mapped[float | None] = mapped_column(nullable=True)
    dropoff_lng: Mapped[float | None] = mapped_column(nullable=True)
