"""Request-id propagation + centralized logging (tahap 1-3).

Single source for cross-cutting observability:

  * ``request_id_ctx``      — contextvar holding the current request id, so any
                              log line emitted during a request is stamped with it.
  * ``RequestIDMiddleware`` — reads an inbound ``X-Request-ID`` (from nginx /
                              Cloudflare) or mints one, exposes it on the response
                              header + request scope, and logs one access line.
  * ``configure_logging()`` — installs one stdout formatter that prints the id on
                              every line and re-points uvicorn's loggers at it.

Implemented as a *pure ASGI* middleware (not ``BaseHTTPMiddleware``) on purpose:
BaseHTTPMiddleware runs the downstream app in a separate task, which breaks
contextvar propagation to the endpoint. A plain ASGI wrapper shares the context.

The id is also stashed on ``scope["request_id"]`` so it survives past this
middleware's ``finally`` (where the contextvar is reset) and stays reachable from
the global exception handler, which runs in an outer layer (ServerErrorMiddleware).
"""
from __future__ import annotations

import logging
import re
import sys
import time
import uuid
from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# Trust an inbound id only if it looks sane; otherwise mint our own.
# Guards against header injection and oversized values from the edge.
_SAFE_ID = re.compile(r"^[A-Za-z0-9._\-]{1,64}$")

_access_logger = logging.getLogger("app.access")


def get_request_id() -> str:
    """Current request id, or '-' outside a request."""
    return request_id_ctx.get()


def _resolve_request_id(raw: bytes | None) -> str:
    if raw:
        candidate = raw.decode("latin-1", "ignore").strip()
        if _SAFE_ID.match(candidate):
            return candidate
    return uuid.uuid4().hex


class RequestIDMiddleware:
    """Pure-ASGI middleware: assigns a request id, logs access, sets header."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        rid = _resolve_request_id(headers.get(b"x-request-id"))
        scope["request_id"] = rid          # survives the contextvar reset below
        token = request_id_ctx.set(rid)
        start = time.perf_counter()
        status_code = 0

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", rid.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            if status_code:
                _access_logger.info(
                    "method=%s | url_path=%s | status_code=%s | latency=%.1fms",
                    scope.get("method", "-"),
                    scope.get("path", "-"),
                    status_code,
                    elapsed,
                )
            request_id_ctx.reset(token)


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


def configure_logging(level: str | int = "INFO") -> None:
    """Install a single stdout handler that stamps every line with the request id.

    Idempotent — safe to call again (e.g. on lifespan startup, after uvicorn has
    set up its own handlers). uvicorn's loggers are re-pointed at the root handler
    so app, error, and access lines share one format; uvicorn's own access logger
    is silenced because ``RequestIDMiddleware`` already emits the access line.
    """
    if isinstance(level, str):
        level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    ))
    handler.addFilter(_RequestIdFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)

    # Route uvicorn's framework loggers through the root formatter…
    for name in ("uvicorn", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True
    # …but silence uvicorn.access — our middleware owns the access line.
    access = logging.getLogger("uvicorn.access")
    access.handlers = []
    access.propagate = False
