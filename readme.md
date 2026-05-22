 Option 1: Docker (easiest — runs everything together)

  docker-compose up --build

  This starts:
  - PostgreSQL on port 5432
  - Backend (FastAPI) on port 8000

  Then start the frontend separately:
  cd frontend
  npm install
  npm run dev

  Frontend will be at http://localhost:3000.

  ---
  Option 2: Run each piece manually

  1. Database — you still need Postgres running. Either via Docker:
  docker-compose up postgres
  Or use a local Postgres instance.

  2. Backend (FastAPI):
  cd backend
  pip install -r requirements.txt
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  3. Frontend (Next.js):
  cd frontend
  npm install
  npm run dev

  ---
  Ports summary:

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