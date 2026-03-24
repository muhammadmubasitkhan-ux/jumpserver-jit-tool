"""Admin routes — dashboard, cleanup, and JumpServer health (admin-only)."""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.services.jit_service import JITService
from app.dependencies import create_jumpserver_client
from app.auth import require_admin
from app import database as db

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    admin_user = require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        stats = await service.get_dashboard_stats()
        recent = db.list_requests(limit=20)
        active = db.get_active_grants()
        healthy = await client.health_check()
        return templates.TemplateResponse(
            "dashboard.html",
            {
                "request": request,
                "stats": stats,
                "recent": recent,
                "active": active,
                "jumpserver_healthy": healthy,
                "admin_user": admin_user,
            },
        )
    finally:
        await client.close()


@router.post("/cleanup")
async def run_cleanup(request: Request):
    require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        cleaned = await service.cleanup_expired()
        return {"cleaned": cleaned}
    finally:
        await client.close()


@router.get("/api/stats")
async def api_stats(request: Request):
    require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        return await service.get_dashboard_stats()
    finally:
        await client.close()


@router.get("/api/active-grants")
async def api_active_grants(request: Request):
    require_admin(request)
    return db.get_active_grants()


@router.get("/api/health")
async def api_health(request: Request):
    require_admin(request)
    client = create_jumpserver_client()
    try:
        healthy = await client.health_check()
        return {"jumpserver": "ok" if healthy else "unreachable", "jit_tool": "ok"}
    finally:
        await client.close()


@router.get("/api/test-auth")
async def test_auth(request: Request):
    require_admin(request)
    client = create_jumpserver_client()
    results = {}
    endpoints = {
        "users": "/api/v1/users/users/?limit=1",
        "permissions": "/api/v1/perms/asset-permissions/?limit=1",
        "assets_v1": "/api/v1/assets/assets/?limit=1",
        "assets_v1_hosts": "/api/v1/assets/hosts/?limit=1",
        "assets_v2": "/api/v2/assets/assets/?limit=1",
        "assets_v2_hosts": "/api/v2/assets/hosts/?limit=1",
    }
    for name, path in endpoints.items():
        try:
            resp = client._raw_request("GET", path)
            results[name] = {"status": resp.status_code, "body": resp.text[:200]}
        except Exception as e:
            results[name] = {"status": "error", "body": str(e)}
    await client.close()
    return results
