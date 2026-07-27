## Getting Started

### 0. Environment files (first time only)

  cp .env.prod.example .env.prod
  cp frontend/.env.local.example frontend/.env.local

  Fill in `.env.prod` — at minimum `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` /
  `DATABASE_URL` (must match the Postgres credentials) and `JWT_SECRET_KEY` (generate with
  `python -c "import secrets; print(secrets.token_hex(32))"`).

---
### Option 1: Docker (easiest — runs Postgres + backend together)

  docker compose -f docker-compose.prod.yml --env-file .env.prod up --build

  `--env-file .env.prod` is required — the compose file's `${POSTGRES_USER}` etc. placeholders
  are only substituted from that flag (there's no plain `.env` in this repo).

  This starts:
  - PostgreSQL on port 5432
  - Backend (FastAPI) on port 8000 — Alembic migrations run automatically on container start
  - Nginx on port 80 (reverse proxy in front of the API; safe to ignore for local dev)

  Seed demo data (users, sites, parts, permissions — safe to re-run):
  docker compose -f docker-compose.prod.yml exec api python scripts/seed_ut.py

  Then start the frontend separately:
  cd frontend
  npm install
  npm run dev

  Frontend will be at http://localhost:3000.

  ---
  Option 2: Run each piece manually

  1. Database — you still need Postgres running. Either via Docker:
  docker compose -f docker-compose.prod.yml --env-file .env.prod up db
  Or use a local Postgres instance with credentials matching `DATABASE_URL` in `.env.prod`
  (or `backend/app/core/config.py`'s defaults if you skip `.env.prod` entirely).

  2. Backend (FastAPI):
  cd backend
  pip install -r requirements.txt
  alembic upgrade head
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  Seed demo data (optional, safe to re-run):
  python scripts/seed_ut.py

  3. Frontend (Next.js):
  cd frontend
  npm install
  npm run dev

  ---
  Ports summary:

  ┌─────────────┬────────────────────────────┐
  │   Service   │            URL             │
  ├─────────────┼────────────────────────────┤
  │ Frontend    │ http://localhost:3000      │
  ├─────────────┼────────────────────────────┤
  │ Backend API │ http://localhost:8000      │
  ├─────────────┼────────────────────────────┤
  │ API Docs    │ http://localhost:8000/docs │
  └─────────────┴────────────────────────────┘

  ---
  Demo accounts (after running `scripts/seed_ut.py`):

  ┌───────────────────────┬──────────────┬─────────────┬──────┐
  │ Email                 │ Password     │ Role        │ Site │
  ├───────────────────────┼──────────────┼─────────────┼──────┤
  │ superadmin@kpp.co.id  │ awokawok663  │ super_admin │ ALL  │
  │ admin.agmr@kpp.co.id  │ admin123     │ admin       │ AGMR │
  │ admin.rant@kpp.co.id  │ admin123     │ admin       │ RANT │
  │ admin.sput@kpp.co.id  │ admin123     │ admin       │ SPUT │
  │ pic.ut@ut.co.id       │ ut123456     │ supplier    │ ALL  │
  └───────────────────────┴──────────────┴─────────────┴──────┘
