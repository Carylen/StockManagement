from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, dashboard, parts, inquiries, upload, users, employees, export, master, templates


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="UT STOCK — KPP Mining API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router, prefix="/v1")
app.include_router(dashboard.router, prefix="/v1")
app.include_router(parts.router, prefix="/v1")
app.include_router(inquiries.router, prefix="/v1")
app.include_router(upload.router, prefix="/v1")
app.include_router(users.router, prefix="/v1")
app.include_router(employees.router, prefix="/v1")
app.include_router(export.router, prefix="/v1")
app.include_router(master.router, prefix="/v1")
app.include_router(templates.router, prefix="/v1")


@app.get("/")
async def root():
    return {"status": "ok", "service": "UT STOCK API", "version": "1.0.0"}
