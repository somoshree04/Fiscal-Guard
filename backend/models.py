
from sqlalchemy import (
    Boolean, 
    Column, 
    DateTime, 
    Float, 
    ForeignKey, 
    Integer, 
    String, 
    Index,
    BigInteger, # Added for amount_paise
    CheckConstraint    # Added to prevent negative amounts
)
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
    __table_args__ = (
    
    Index("ix_expenses_owner_category", "owner_id", "category"),

    # Ensures that a user cannot submit a 0 or negative expense value
    CheckConstraint("amount_paise > 0", name="ck_expenses_amount_positive"),
    
    )

    id = Column(Integer, primary_key=True)
    amount_paise = Column(BigInteger, nullable=False)         
    category = Column(String(30), nullable=False)
    description = Column(String(200), nullable=False, default="")
    is_anomaly = Column(Boolean, nullable=False, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    owner = relationship("User", back_populates="expenses")

    @property
    def amount(self) -> float:
        """Rupees, for API output only. Never do arithmetic on this."""
        return self.amount_paise / 100