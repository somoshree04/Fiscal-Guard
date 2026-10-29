import logging

from backend.tests.conftest import signup_and_login

from limiter import limiter


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

    assert client.get("/me/expenses/", headers=h2).json()["items"] == []
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

def test_amount_round_trips_exactly(client):
    h = signup_and_login(client)
    r = client.post("/me/expenses/", json={"amount": 10.55, "category": "Groceries"}, headers=h)
    assert r.status_code == 201
    assert r.json()["amount"] == 10.55


def test_more_than_two_decimals_rejected(client):
    h = signup_and_login(client)
    r = client.post("/me/expenses/", json={"amount": 10.999, "category": "Groceries"}, headers=h)
    assert r.status_code == 422

def _add(client, h, amount, category="Groceries"):
    r = client.post("/me/expenses/", json={"amount": amount, "category": category}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def test_pagination_returns_newest_first(client):
    h = signup_and_login(client)
    ids = [_add(client, h, 10 + i)["id"] for i in range(5)]

    page = client.get("/me/expenses/?limit=2&offset=0", headers=h).json()
    assert page["total"] == 5
    assert [e["id"] for e in page["items"]] == [ids[4], ids[3]]

    page2 = client.get("/me/expenses/?limit=2&offset=2", headers=h).json()
    assert [e["id"] for e in page2["items"]] == [ids[2], ids[1]]


def test_filter_by_category(client):
    h = signup_and_login(client)
    _add(client, h, 100, "Rent")
    _add(client, h, 50, "Groceries")
    page = client.get("/me/expenses/?category=Rent", headers=h).json()
    assert page["total"] == 1
    assert page["items"][0]["category"] == "Rent"


def test_limit_is_capped(client):
    h = signup_and_login(client)
    assert client.get("/me/expenses/?limit=101", headers=h).status_code == 422
    assert client.get("/me/expenses/?limit=0", headers=h).status_code == 422
    assert client.get("/me/expenses/?category=Nope", headers=h).status_code == 422


def test_summary_totals_and_isolation(client):
    h1 = signup_and_login(client, "alice", "alice@example.com")
    h2 = signup_and_login(client, "bob", "bob@example.com")
    _add(client, h1, 100, "Rent")
    _add(client, h1, 50.25, "Groceries")
    _add(client, h2, 999, "Rent")

    params = {"start": "2000-01-01T00:00:00Z", "end": "2100-01-01T00:00:00Z"}
    s = client.get("/me/summary", params=params, headers=h1).json()
    assert s["total"] == 150.25
    assert s["count"] == 2
    assert {c["category"]: c["total"] for c in s["by_category"]} == {"Rent": 100.0, "Groceries": 50.25}


def test_summary_rejects_inverted_range(client):
    h = signup_and_login(client)
    params = {"start": "2100-01-01T00:00:00Z", "end": "2000-01-01T00:00:00Z"}
    assert client.get("/me/summary", params=params, headers=h).status_code == 422


def test_login_is_rate_limited(client):
    client.post("/auth/signup", json={
        "username": "rl_user", "email": "rl@example.com", "password": "password123"})

    limiter.enabled = True
    limiter.reset()
    bad = {"email": "rl@example.com", "password": "wrong-password"}

    statuses = [client.post("/auth/login", json=bad).status_code for _ in range(6)]
    assert statuses[:5] == [401] * 5
    assert statuses[5] == 429

    r = client.post("/auth/login", json=bad)
    assert r.status_code == 429
    assert "Too many attempts" in r.json()["detail"]

def test_update_expense_changes_fields(client):
    h = signup_and_login(client)
    e = _add(client, h, 100, "Groceries")
    r = client.patch(f"/me/expenses/{e['id']}",
                     json={"amount": 250.5, "description": "weekly shop"}, headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["amount"] == 250.5
    assert body["description"] == "weekly shop"
    assert body["category"] == "Groceries"      # untouched fields stay as they were


def test_update_cannot_touch_other_users_expense(client):
    h1 = signup_and_login(client, "alice", "alice@example.com")
    h2 = signup_and_login(client, "bob", "bob@example.com")
    e = _add(client, h1, 100, "Rent")
    r = client.patch(f"/me/expenses/{e['id']}", json={"amount": 1}, headers=h2)
    assert r.status_code == 404


def test_update_rejects_bad_input(client):
    h = signup_and_login(client)
    e = _add(client, h, 100, "Rent")
    url = f"/me/expenses/{e['id']}"
    assert client.patch(url, json={}, headers=h).status_code == 422
    assert client.patch(url, json={"amount": -5}, headers=h).status_code == 422
    assert client.patch(url, json={"amount": None}, headers=h).status_code == 422
    assert client.patch(url, json={"category": "Nope"}, headers=h).status_code == 422