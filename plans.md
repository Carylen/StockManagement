# VPS Minimum Specifications — Backend + Database

## Context

The app is a small internal stock management tool (United Tractors / AGMR site) with:
- FastAPI + async PostgreSQL (asyncpg)
- 6 database tables, 26 API endpoints
- No background jobs, no Redis, no caching
- Pandas-based Excel/CSV upload (in-memory processing — causes memory spikes)
- asyncpg connection pool: pool_size=10, max_overflow=20
- Expected users: <100 concurrent, single organization

---

## Minimum VPS Specification

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU**  | 1 vCPU  | 2 vCPU      |
| **RAM**  | 2 GB    | 4 GB        |
| **Storage** | 20 GB SSD | 40 GB SSD |
| **OS**   | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Network** | 1 Gbps shared | 1 Gbps shared |

### Why 2 GB RAM minimum?
- PostgreSQL (with default config): ~400–600 MB
- FastAPI + Uvicorn workers: ~200–300 MB
- Pandas during Excel upload (5–10× file size in memory): ~100–500 MB spike
- OS overhead: ~300 MB
- **Total comfortable floor: ~2 GB**

### Why 20 GB SSD minimum?
- OS + packages: ~5 GB
- Docker images (postgres:alpine + python): ~1–2 GB
- PostgreSQL data (6 tables, parts/inquiries for a fleet op): ~1–3 GB
- Logs + room to grow: ~5 GB
- Buffer: ~5 GB

---

## Deployment Stack on VPS

```
VPS (Ubuntu 22.04)
├── Docker + Docker Compose
│   ├── postgres:16-alpine  (port 5432, internal only)
│   └── utstock_backend     (port 8000, exposed or behind nginx)
└── Nginx (reverse proxy, optional but recommended)
    └── proxy_pass → localhost:8000
```

Frontend (Next.js) stays on the user's machine or a separate static host (Vercel, Netlify — free tier).

---

## Recommended Affordable VPS Providers

| Provider | Plan | Price/month | Specs |
|----------|------|-------------|-------|
| **Contabo** | VPS S | ~$6–8 | 4 vCPU, 4 GB RAM, 100 GB SSD |
| **Hetzner** | CX22 | ~$4–5 | 2 vCPU, 4 GB RAM, 40 GB SSD |
| **DigitalOcean** | Basic | ~$12 | 2 vCPU, 2 GB RAM, 60 GB SSD |
| **Vultr** | Regular | ~$10 | 1 vCPU, 2 GB RAM, 55 GB SSD |

**Best value:** Hetzner CX22 (Europe) or Contabo VPS S — both comfortably exceed the minimum at very low cost.

---

## What Does NOT Need to Run on VPS

- **Frontend (Next.js)** — deploy free to Vercel (just update `CORS_ORIGINS` in backend `.env`)
- No Redis, no Celery, no message queue needed for this app's scale

---

## Verification After Subscribing

1. `docker-compose up -d` on the VPS
2. `curl http://<vps-ip>:8000/` → should return `{"status": "ok"}`
3. `curl http://<vps-ip>:8000/docs` → Swagger UI accessible
4. Update frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://<vps-ip>:8000`
