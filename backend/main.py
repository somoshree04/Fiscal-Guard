import logging
import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.http import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from datetime import datetime,timezone
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import func
from fastapi import Request

from limiter import limiter, LOGIN_LIMIT, SIGNUP_LIMIT

# --- UPDATE THIS LOGIC TO CLEAR THE ERROR ---
current_dir = os.path.dirname(os.path.abspath(__file__)) # points to backend/
root_dir = os.path.dirname(current_dir)                 # points to ai-finance-tracker/

sys.path.append(current_dir)   # Let's Python find sibling backend files (models, database, security)
sys.path.append(root_dir)      # Let's Python find root directory folders (ml_logic)
# ---------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fiscalguard")


import ml_logic.model as ml
from ml_logic.categories import CATEGORY_MAP

import database
import models
import schemas
import security


@asynccontextmanager
async def lifespan(app: FastAPI):
    ml.load_model()          # fail loudly at startup if the model is missing
    yield


app = FastAPI(title="FiscalGuard API", lifespan=lifespan)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # `detail` is the key our frontend api.js already reads for error messages
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many attempts. Please wait a minute and try again."},
        headers={"Retry-After": "60"},
    )

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://localhost:5173",
        
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=False)

@app.get("/health")
def health(db: Session = Depends(database.get_db)):
    db.execute(text("SELECT 1"))
    log.info("Health check passed")
    return {"status": "ok"}

def _to_utc(dt: datetime) -> datetime:
    """Naive datetimes are treated as UTC; aware ones are converted to UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(database.get_db),
) -> models.User:
    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        user_id = security.decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise unauthorized
    user = db.get(models.User, user_id)
    if user is None:
        raise unauthorized
    return user


# ---------- auth ----------
@app.post("/auth/signup", response_model=schemas.User, status_code=201)
@limiter.limit(SIGNUP_LIMIT)
def signup(request: Request, payload: schemas.UserCreate, db: Session = Depends(database.get_db)):
    email = payload.email.lower()
    taken = db.query(models.User).filter(
        (models.User.email == email) | (models.User.username == payload.username)
    ).first()
    if taken:
        raise HTTPException(409, "Username or email already registered")

    user = models.User(
        username=payload.username,
        email=email,
        hashed_password=security.hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Username or email already registered")
    db.refresh(user)
    
    # 🌟 Added metrics logging for signup
    log.info(f"user signed up id={user.id}")
    return user


@app.post("/auth/login", response_model=schemas.Token)
@limiter.limit(LOGIN_LIMIT)
def login(request:Request,payload: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not user or not security.verify_password(payload.password, user.hashed_password):
        # 🌟 Added warning logging before throwing unauthorized error
        log.warning(f"failed login for email={payload.email.lower()}")
        raise HTTPException(401, "Incorrect email or password")
    return schemas.Token(access_token=security.create_access_token(user.id))


@app.get("/me", response_model=schemas.User)
def me(user: models.User = Depends(get_current_user)):
    return user


# ---------- expenses (always scoped to the logged-in user) ----------
@app.post("/me/expenses/", response_model=schemas.Expense, status_code=201)
def create_expense(
    expense: schemas.ExpenseCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    category = expense.category.value
    amount_paise = int(expense.amount * 100)     # exact: Decimal * 100 has no float error
    history = [
        paise / 100 for (paise,) in db.query(models.Expense.amount_paise).filter(
            models.Expense.owner_id == user.id,
            models.Expense.category == category,
        )
    ]
    flagged = ml.is_anomaly(expense.amount, CATEGORY_MAP[category], history)

    db_expense = models.Expense(
        amount_paise=amount_paise,
        category=category,
        description=expense.description,
        owner_id=user.id,
        is_anomaly=flagged,
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    # Added audit metric tracking logging to satisfy all string assertions
    log.info(f"expense created user={user.id} category={category} anomaly={flagged}")
    return db_expense


@app.get("/me/expenses/", response_model=schemas.ExpensePage)
def list_expenses(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: schemas.Category | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    anomaly_only: bool = False,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.Expense).filter(models.Expense.owner_id == user.id)
    if category:
        q = q.filter(models.Expense.category == category.value)
    if start:
        q = q.filter(models.Expense.timestamp >= _to_utc(start))
    if end:
        q = q.filter(models.Expense.timestamp < _to_utc(end))
    if anomaly_only:
        q = q.filter(models.Expense.is_anomaly.is_(True))

    total = q.count()
    items = (
        q.order_by(models.Expense.timestamp.desc(), models.Expense.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@app.get("/me/summary", response_model=schemas.Summary)
def summary(
    start: datetime,
    end: datetime,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    start, end = _to_utc(start), _to_utc(end)
    if end <= start:
        raise HTTPException(422, "end must be after start")

    rows = (
        db.query(
            models.Expense.category,
            func.sum(models.Expense.amount_paise),
            func.count(models.Expense.id),
        )
        .filter(
            models.Expense.owner_id == user.id,
            models.Expense.timestamp >= start,
            models.Expense.timestamp < end,
        )
        .group_by(models.Expense.category)
        .all()
    )
    return {
        "total": sum(int(paise) for _, paise, _ in rows) / 100,
        "count": sum(n for _, _, n in rows),
        "by_category": [
            {"category": cat, "total": int(paise) / 100} for cat, paise, _ in rows
        ],
    }

@app.delete("/me/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    expense = (
        db.query(models.Expense)
        .filter(models.Expense.id == expense_id, models.Expense.owner_id == user.id)
        .first()
    )
    if not expense:
        raise HTTPException(404, "Expense not found")   # same answer for "not yours" and "doesn't exist"
    db.delete(expense)
    db.commit()

@app.patch("/me/expenses/{expense_id}", response_model=schemas.Expense)
def update_expense(
    expense_id: int,
    payload: schemas.ExpenseUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    expense = (
        db.query(models.Expense)
        .filter(models.Expense.id == expense_id, models.Expense.owner_id == user.id)
        .first()
    )
    if not expense:
        raise HTTPException(404, "Expense not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "No fields to update")
    for field in ("amount", "category"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")

    if "amount" in changes:
        expense.amount_paise = int(changes["amount"] * 100)
    if "category" in changes:
        expense.category = changes["category"].value
    if "description" in changes:
        expense.description = changes["description"] or ""

    # Re-calculate the anomaly flag using the clean, calculated float values
    if "amount" in changes or "category" in changes:
        history = [
            paise / 100
            for (paise,) in db.query(models.Expense.amount_paise).filter(
                models.Expense.owner_id == user.id,
                models.Expense.category == expense.category,
                models.Expense.id != expense.id,
            )
        ]
        
        # Pull explicitly from amount_paise converted back to standard float dollars/rupees
        current_amount_float = float(expense.amount_paise) / 100
        
        expense.is_anomaly = ml.is_anomaly(
            current_amount_float, CATEGORY_MAP[expense.category], history
        )

    db.commit()
    db.refresh(expense)
    log.info("expense updated id=%s user=%s fields=%s", expense.id, user.id, sorted(changes))
    return expense
