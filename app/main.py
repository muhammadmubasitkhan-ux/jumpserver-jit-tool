"""FastAPI application — JumpServer JIT Access Portal."""

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import database as db
from app.config import get_settings
from app.auth import NotAuthenticatedError
from app.dependencies import create_jumpserver_client
from app.services.jit_service import JITService
from app.routes import requests, approvals, admin, auth

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def periodic_cleanup(interval_minutes: int):
    """Background task that cleans up expired JumpServer permissions."""
    while True:
        await asyncio.sleep(interval_minutes * 60)
        client = create_jumpserver_client()
        service = JITService(client)
        try:
            cleaned = await service.cleanup_expired()
            if cleaned:
                logger.info("Periodic cleanup: removed %d expired grants", cleaned)
        except Exception as e:
            logger.error("Periodic cleanup failed: %s", e)
        finally:
            await client.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    db.init_db()
    logger.info("Database initialized")

    cleanup_task = asyncio.create_task(
        periodic_cleanup(settings.auto_cleanup_interval_minutes)
    )
    logger.info(
        "Cleanup task started (every %d min)", settings.auto_cleanup_interval_minutes
    )

    yield

    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutdown complete")


app = FastAPI(
    title="JumpServer JIT Access Portal",
    description="Just-In-Time privileged access management via JumpServer API",
    version="1.0.0",
    lifespan=lifespan,
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.exception_handler(NotAuthenticatedError)
async def not_authenticated_handler(request: Request, exc: NotAuthenticatedError):
    return RedirectResponse(url=exc.redirect_to, status_code=303)


@app.middleware("http")
async def inject_auth_state(request: Request, call_next):
    from app.auth import get_current_admin, get_current_requester
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()
    request.state.request_id = request_id
    request.state.admin_user = get_current_admin(request)
    request.state.requester = get_current_requester(request)
    response = await call_next(request)
    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response

@app.get("/")
async def root():
    return RedirectResponse(url="/auth/login", status_code=303)


@app.get("/healthz")
async def healthz():
    return JSONResponse({"status": "ok"})


@app.get("/readyz")
async def readyz():
    try:
        db.init_db()
        return JSONResponse({"status": "ready"})
    except Exception as exc:
        logger.error("Readiness check failed: %s", exc)
        return JSONResponse({"status": "not_ready"}, status_code=503)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(requests.router, prefix="/request", tags=["requests"])
app.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
app.include_router(admin.router, prefix="/dashboard", tags=["dashboard"])
