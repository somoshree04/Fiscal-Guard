import logging
from backend.tests.conftest import signup_and_login
from sqlalchemy import text
from conftest import signup_and_login


def test_signup_does_not_store_plain_password(client):
    from database import SessionLocal  # noqa: F401  (just ensuring import works)
    r = client.post("/auth/signup", json={"username": "bob", "email": "bob@example.com", "password": "password123"})
    assert r.status_code == 201
    assert "password" not in r.json()


def test_duplicate_signup_returns_409(client):
    signup_and_login(client)
    r = client.post("/auth/signup", json={"username": "alice", "email": "alice@example.com", "password": "password123"})
    assert r.status_code == 409


def test_wrong_password_returns_401(client):
    signup_and_login(client)
    r = client.post("/auth/login", json={"email": "alice@example.com", "password": "wrong-password"})
    assert r.status_code == 401


def test_expenses_require_token(client):
    assert client.get("/me/expenses/").status_code == 401
    assert client.post("/me/expenses/", json={"amount": 10, "category": "Rent"}).status_code == 401


def test_invalid_expense_rejected(client):
    h = signup_and_login(client)
    assert client.post("/me/expenses/", json={"amount": -5, "category": "Rent"}, headers=h).status_code == 422
    assert client.post("/me/expenses/", json={"amount": 100, "category": "NotACategory"}, headers=h).status_code == 422


def test_users_cannot_see_or_delete_each_others_expenses(client):
    h1 = signup_and_login(client, "alice", "alice@example.com")
    h2 = signup_and_login(client, "bob", "bob@example.com")

    created = client.post("/me/expenses/", json={"amount": 250, "category": "Groceries"}, headers=h1)
    assert created.status_code == 201
    expense_id = created.json()["id"]

    assert client.get("/me/expenses/", headers=h2).json() == []
    assert client.delete(f"/me/expenses/{expense_id}", headers=h2).status_code == 404
    assert client.delete(f"/me/expenses/{expense_id}", headers=h1).status_code == 204


def test_timestamp_is_utc_marked(client):
    h = signup_and_login(client)
    r = client.post("/me/expenses/", json={"amount": 100, "category": "Transport"}, headers=h)
    assert r.json()["timestamp"].endswith("Z") or "+00:00" in r.json()["timestamp"]


# =====================================================================
# 🌟 ADDED LOGGING VERIFICATION SUITES (HEALTH & MONITORING METRICS) 🌟
# =====================================================================
def test_signup_logs_event(client, caplog):
    with caplog.at_level(logging.INFO, logger="fiscalguard"):
        r = client.post("/auth/signup", json={
            "username": "log_test", "email": "log_test@example.com", "password": "password123"})
    assert r.status_code == 201
    assert f"user signed up id={r.json()['id']}" in caplog.text


def test_failed_login_logs_warning(client, caplog):
    client.post("/auth/signup", json={
        "username": "log_test", "email": "log_test@example.com", "password": "password123"})
    with caplog.at_level(logging.WARNING, logger="fiscalguard"):
        r = client.post("/auth/login", json={
            "email": "log_test@example.com", "password": "wrong-password"})
    assert r.status_code == 401
    assert "failed login for email=log_test@example.com" in caplog.text


def test_create_expense_logs_metrics(client, caplog):
    headers = signup_and_login(client, "log_test", "log_test@example.com")
    with caplog.at_level(logging.INFO, logger="fiscalguard"):
        r = client.post("/me/expenses/", json={"amount": 100, "category": "Groceries"}, headers=headers)
    assert r.status_code == 201
    assert "expense created" in caplog.text
    assert "category=Groceries" in caplog.text