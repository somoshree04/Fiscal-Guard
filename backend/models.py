
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(30), unique=True, index=True,nullable=False)
    email = Column(String(255), unique=True, index=True,nullable=False)
    hashed_password = Column(String(255),nullable=False)

    expenses = relationship("Expense", back_populates="owner", cascade="all, delete-orphan")

class Expense(Base):
    __tablename__ = "expenses"
    # Serves "all expenses for a user" and "this user's history in a category"
    __table_args__ = (Index("ix_expenses_owner_category", "owner_id", "category"),)

    id = Column(Integer, primary_key=True)
    amount = Column(Float, nullable=False)          # becomes integer paise in the next step
    category = Column(String(30), nullable=False)
    description = Column(String(200), nullable=False, default="")
    is_anomaly = Column(Boolean, nullable=False, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    owner = relationship("User", back_populates="expenses")