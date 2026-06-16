import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.observability import RequestIDMiddleware, configure_logging, request_id_ctx
from app.routers import auth, dashboard, parts, inquiries, upload, users, employees, export, master, templates, sites, ho, scheduled_plans

logger = logging.getLogger("app.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Install logging here (after uvicorn has set up its own) so our formatter wins.
    configure_logging(settings.LOG_LEVEL)
    logging.getLogger("app").info("UT STOCK API started (log level=%s)", settings.LOG_LEVEL)
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
    expose_headers=["Content-Disposition", "X-Request-ID"],
)

# Added last → outermost: every response carries the request id, every request
# is logged with it. Kept above the routers so it wraps all of them.
app.add_middleware(RequestIDMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log any unhandled error with its request id and echo the id to the client
    so a user can quote it when reporting the problem."""
    rid = request.scope.get("request_id", "-")
    # Re-bind the contextvar: this handler runs in an outer layer, after the
    # middleware's finally has reset it, so the log line would otherwise lose the id.
    request_id_ctx.set(rid)
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": rid},
        headers={"X-Request-ID": rid},
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
app.include_router(sites.router, prefix="/v1")
app.include_router(ho.router, prefix="/v1")
app.include_router(scheduled_plans.router, prefix="/v1")


@app.get("/")
async def root():
    return {"status": "ok", "service": "UT STOCK API", "version": "1.0.0"}
