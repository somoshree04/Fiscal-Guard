import os
import sys
from contextlib import asynccontextmanager

import logging
import jwt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.http import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


# --- UPDATE THIS LOGIC TO CLEAR THE ERROR ---
current_dir = os.path.dirname(os.path.abspath(__file__)) # points to backend/
root_dir = os.path.dirname(current_dir)                 # points to ai-finance-tracker/

sys.path.append(current_dir)   # Let's Python find sibling backend files (models, database, security)
sys.path.append(root_dir)      # Let's Python find root directory folders (ml_logic)
# ---------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fiscalguard")


import models, schemas, database, security
import ml_logic.model as ml
from ml_logic.categories import CATEGORY_MAP



@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=database.engine)
    ml.load_model()          # fail loudly at startup if the model is missing
    yield


app = FastAPI(title="FiscalGuard API", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    except Exception:
        raise unauthorized
    user = db.get(models.User, user_id)
    if user is None:
        raise unauthorized
    return user


# ---------- auth ----------
@app.post("/auth/signup", response_model=schemas.User, status_code=201)
def signup(payload: schemas.UserCreate, db: Session = Depends(database.get_db)):
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
def login(payload: schemas.UserLogin, db: Session = Depends(database.get_db)):
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
    history = [
        amount for (amount,) in db.query(models.Expense.amount).filter(
            models.Expense.owner_id == user.id,
            models.Expense.category == category,
        )
    ]
    flagged = ml.is_anomaly(expense.amount, CATEGORY_MAP[category], history)

    db_expense = models.Expense(
        amount=expense.amount,
        category=category,
        description=expense.description,
        owner_id=user.id,
        is_anomaly=flagged,
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    # 🌟 Added audit metric tracking logging to satisfy all string assertions
    log.info(f"expense created user={user.id} category={category} anomaly={flagged}")
    return db_expense


@app.get("/me/expenses/", response_model=list[schemas.Expense])
def list_expenses(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    return (
        db.query(models.Expense)
        .filter(models.Expense.owner_id == user.id)
        .order_by(models.Expense.id)
        .all()
    )

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
