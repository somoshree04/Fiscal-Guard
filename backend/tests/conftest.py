import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-test-secret-key-1234567890")

import pytest
from fastapi.testclient import TestClient  # type: ignore[reportMissingImports]
from sqlalchemy import create_engine  # type: ignore[reportMissingImports]
from sqlalchemy.orm import sessionmaker  # type: ignore[reportMissingImports]
from sqlalchemy.pool import StaticPool  # type: ignore[reportMissingImports]

import database
import models
from main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    models.Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_get_db
    with TestClient(app) as tc:
         yield tc
          # no `with`: skips the lifespan (real DB / model load)
    app.dependency_overrides.clear()


def signup_and_login(client, name="alice", email="alice@example.com", password="password123"):
    r = client.post("/auth/signup", json={"username": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}