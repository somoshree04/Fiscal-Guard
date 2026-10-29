# FiscalGuard

[![CI](https://github.com/somoshree04/fiscalguard/actions/workflows/ci.yml/badge.svg)](https://github.com/somoshree04/fiscalguard/actions/workflows/ci.yml)

A full-stack personal expense tracker that flags unusually high spending the moment you log it. Each expense is checked against your own spending history, with a machine-learning model as a fallback while you are new.

**Live demo:** https://ai-finance-tracker-opal.vercel.app
**API docs (Swagger):** https://ai-finance-tracker-2-nm20.onrender.com/docs

> The backend runs on a free hosting tier and sleeps when idle, so the first request can take up to a minute. Sign-up needs no email verification; use a throwaway password, not one you use elsewhere.

![Dashboard with category breakdown and a flagged expense](docs/dashboard.png)

---

## Features

**Tracking**
- Create an account, log in, and keep a private expense history
- Log, edit and delete expenses across 11 categories, each with an optional description
- Daily and monthly totals and a category breakdown chart, computed in SQL
- Server-side pagination and category filtering

**Anomaly detection**
- Every new or edited expense is scored for being unusually high
- Flagged expenses are marked in the history and in the result panel right after you log them
- Editing an expense re-scores it, so the flag never goes stale

**Security and reliability**
- Passwords hashed with bcrypt; JWT access tokens that expire after 60 minutes
- Every expense query is scoped to the logged-in user, so one user can never read or change another's data
- Rate limiting on login (5 per minute) and signup (10 per hour) per IP
- Input validation: positive amounts with at most two decimal places, categories restricted to a fixed list
- The app refuses to start without a `SECRET_KEY`
- Money stored as integer paise, never floating point
- Health-check endpoint and structured logging

**Engineering**
- Database schema managed with Alembic migrations, applied automatically on deploy
- 38 automated tests (25 backend, 13 frontend) and a GitHub Actions pipeline
- Containerised with Docker Compose; deployed on Vercel and Render

![A flagged expense](docs/flagged-expense.png)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Recharts, React Router |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, SlowAPI |
| Database | PostgreSQL (SQLite in tests) |
| Machine learning | scikit-learn (Isolation Forest), NumPy, pandas |
| Testing and quality | pytest, Vitest, Testing Library, ruff, ESLint |
| CI and deployment | GitHub Actions, Docker Compose, Vercel (frontend), Render (backend and PostgreSQL) |

---

## Architecture

```
┌────────────────────┐   HTTPS + JSON     ┌──────────────────────┐        ┌──────────────┐
│ React (Vercel)     │  Bearer JWT token  │ FastAPI (Render)     │ ─────► │ PostgreSQL   │
│ Dashboard, auth    │ ─────────────────► │ auth · expenses ·    │        │ (Render)     │
└────────────────────┘                    │ summary · rate limit │        └──────────────┘
                                          │          │           │
                                          │          ▼           │
                                          │ ml_logic (anomaly    │
                                          │ scoring, loaded once │
                                          │ at startup)          │
                                          └──────────────────────┘
```

### Key design decisions

| Decision | Why |
|---|---|
| User id comes from the JWT, never from the URL | Prevents users from reading or editing each other's data by changing an id |
| Editing or deleting someone else's expense returns 404 | Indistinguishable from "does not exist", so ids cannot be probed |
| Money stored as integer paise | Binary floats cannot represent most decimals exactly, and errors accumulate in sums |
| Timestamps stored in UTC; the browser sends its own day and month ranges | The server stays timezone-neutral, and "today" is correct for the user's local midnight |
| Totals computed in SQL by a separate `/me/summary` endpoint | Stay correct regardless of which page of the list is shown |
| Composite indexes on `(owner_id, category)` and `(owner_id, timestamp)` | Match the filters used by the anomaly check and the dashboard |
| Alembic instead of `create_all` | Versioned, reviewable, reversible schema changes |

---

## How the anomaly detection works

`is_anomaly()` chooses a strategy based on how much history the user has in that category.

| Situation | Method |
|---|---|
| 10 or more past expenses in the category | **Personal baseline:** z-score of the new amount against the user's own history on a log scale; flagged when `z > 3` |
| New user or thin history | **Population fallback:** a per-category Isolation Forest trained on a public spending dataset |

Only unusually **high** amounts are flagged.

### Evaluation

The dataset has no anomaly labels, so the evaluation injects them: held-out real amounts are treated as normal, and the same amounts multiplied by *k* are treated as anomalies (about 1 anomaly per 10 normals). The personal baseline is evaluated on simulated users, because the dataset has no per-user history.

| Method | Spike size | Precision | Recall | F1 |
|---|---|---|---|---|
| Population fallback (Isolation Forest) | 5x | 0.72 | 0.45 | 0.55 |
| Population fallback (Isolation Forest) | 10x | 0.81 | 0.76 | 0.78 |
| Personal baseline, consistent spender (σ = 0.25) | 3x | 0.95 | 0.90 | 0.92 |
| Personal baseline, erratic spender (σ = 0.5) | 3x | 0.86 | 0.25 | 0.39 |

These numbers measure detection of **synthetic spikes**, not real fraud, and the personal-baseline results depend on an assumed spending variability. Both methods are deliberately conservative about mild increases (about 2x). The full method, all tables and caveats are in [`ml_logic/README.md`](ml_logic/README.md). Reproduce them with `python -m ml_logic.evaluate`.

---

## Getting started

### Run everything with Docker

Requires Docker Desktop.

```bash
cp .env.example .env        # then fill in SECRET_KEY and POSTGRES_PASSWORD
docker compose up --build
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API and Swagger docs | http://localhost:8000/docs |
| PostgreSQL (host port) | `localhost:5433` |

Generate a secret key with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Run without Docker

Requires Python 3.11 and Node 20.

```bash
# Backend (from backend/)
pip install -r requirements.txt
export DATABASE_URL=postgresql://user:password@localhost:5432/fiscalguard
export SECRET_KEY=<your secret>
python -m alembic upgrade head
python -m uvicorn main:app --reload

# Frontend (from frontend/)
npm install
npm run dev
```

On Windows PowerShell, set variables with `$env:SECRET_KEY = "..."` instead of `export`. If `DATABASE_URL` is not set, the backend falls back to a local SQLite file, which is meant for tests only; run migrations against PostgreSQL.

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `SECRET_KEY` | backend | Signs JWTs. At least 32 characters; the app will not start without it |
| `DATABASE_URL` | backend | PostgreSQL connection string |
| `CORS_ORIGINS` | backend | Comma-separated list of allowed frontend origins |
| `POSTGRES_PASSWORD` | Docker Compose | Password for the local PostgreSQL container |
| `VITE_API_URL` | frontend | Backend base URL, baked in at build time |
| `MODEL_PATH` | backend | Optional path to a different trained model file |

---

## Testing

```bash
cd backend && python -m pytest -v    # 25 tests
cd frontend && npm test              # 13 tests
python -m ml_logic.evaluate          # ML evaluation, run from the project root
```

| Area | What is covered |
|---|---|
| Backend | Signup and login, duplicate and wrong-credential handling, token requirement, input validation, per-user data isolation, exact money round-trips, pagination, filters, summaries, rate limiting, editing, logging, and the anomaly functions |
| Frontend | API client (auth header, error parsing, empty responses), route guard, login flow, and dashboard states (loaded, empty, flagged, delete) |

GitHub Actions runs linting and the test suites for both halves on every push, plus a production frontend build.

---

## API overview

Full interactive documentation is available at [`/docs`](https://ai-finance-tracker-2-nm20.onrender.com/docs).

| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Create an account (rate limited) |
| POST | `/auth/login` | Exchange credentials for an access token (rate limited) |
| GET | `/me` | The current user |
| POST | `/me/expenses/` | Create an expense; returns it with its anomaly flag |
| GET | `/me/expenses/` | List with `limit` (max 100), `offset`, `category`, `start`, `end`, `anomaly_only` |
| PATCH | `/me/expenses/{id}` | Edit an expense and re-score it |
| DELETE | `/me/expenses/{id}` | Delete an expense |
| GET | `/me/summary` | Total, count and per-category sums for a time range |
| GET | `/health` | Liveness and database check |

---

## Project structure

```
.
├── backend/
│   ├── main.py            # routes and dependencies
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic request/response models
│   ├── security.py        # password hashing and JWT
│   ├── limiter.py         # rate-limit configuration
│   ├── database.py        # engine and session
│   ├── alembic/           # migrations
│   └── tests/             # pytest suite
├── frontend/
│   └── src/               # pages, API client, route guard, tests
├── ml_logic/              # anomaly detection, training and evaluation
├── data/                  # training dataset
├── train_launcher.py      # trains and saves the model
├── docker-compose.yml
└── .github/workflows/     # CI
```

---

## Deployment

| Part | Platform | Notes |
|---|---|---|
| Frontend | Vercel | `VITE_API_URL` points at the backend; redeploy after changing it |
| Backend | Render web service (Python 3.11) | Root directory `backend`; build `pip install -r requirements.txt`; start `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"` |
| Database | Render PostgreSQL | Internal connection URL set as `DATABASE_URL` |

Migrations run on every start, so a new database is built from scratch automatically.

---

## Known limitations

- The layout is not yet optimised for mobile screens.
- The access token is kept in `localStorage`, which is exposed to cross-site scripting. An `httpOnly` cookie with refresh tokens would be safer.
- Rate limiting is held in memory per process; running several workers would need a shared store such as Redis.
- The anomaly evaluation uses synthetic spikes and simulated users, because no labelled real data exists.
- The population model is trained on monthly spending totals but scores individual transactions, so it is a rough prior.
- Offset pagination slows down on very deep pages; cursor pagination would scale better.
- The free hosting tier sleeps when idle.

## Roadmap

- Responsive layouts
- Budgets and alerts
- CSV import and export
- Monthly trend chart
- Let users mark a flagged expense as "normal" and use that feedback to tune thresholds
- Cookie-based sessions and Redis-backed rate limiting

---

Built by [@somoshree04](https://github.com/somoshree04).