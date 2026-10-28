from datetime import datetime, timezone
from enum import Enum
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Category(str, Enum):
    Eating_Out = "Eating_Out"
    Education = "Education"
    Entertainment = "Entertainment"
    Groceries = "Groceries"
    Healthcare = "Healthcare"
    Insurance = "Insurance"
    Loan_Repayment = "Loan_Repayment"
    Miscellaneous = "Miscellaneous"
    Rent = "Rent"
    Transport = "Transport"
    Utilities = "Utilities"


class ExpenseCreate(BaseModel):
    amount: Decimal = Field(gt=0, lt=10_000_000, max_digits=10, decimal_places=2)
    category: Category
    description: str = Field(default="", max_length=200)


class Expense(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    amount: float
    category: str
    description: str | None = None
    is_anomaly: bool
    timestamp: datetime | None = None

    @field_validator("timestamp")
    @classmethod
    def assume_utc(cls, v):
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)   # bcrypt's limit


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"