"""Routes for reviewing and managing JIT access approvals (admin-only)."""

from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.models import ReviewAction
from app.services.jit_service import JITService
from app.services.notification import notify_request_approved, notify_request_denied
from app.dependencies import create_jumpserver_client
from app.auth import require_admin
from app import database as db

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse)
async def approvals_page(request: Request):
    admin_user = require_admin(request)
    pending = db.list_requests(status="pending")
    active = db.get_active_grants()
    return templates.TemplateResponse(
        "approvals.html",
        {"request": request, "pending": pending, "active": active, "admin_user": admin_user},
    )


@router.post("/approve/{request_id}", response_class=HTMLResponse)
async def approve(request: Request, request_id: str, comment: str = Form("")):
    admin_user = require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        result = await service.approve_request(request_id, admin_user, comment)
        notify_request_approved(result)
        return RedirectResponse(url="/approvals", status_code=303)
    except ValueError as e:
        pending = db.list_requests(status="pending")
        active = db.get_active_grants()
        return templates.TemplateResponse(
            "approvals.html",
            {"request": request, "pending": pending, "active": active, "error": str(e), "admin_user": admin_user},
        )
    finally:
        await client.close()


@router.post("/deny/{request_id}", response_class=HTMLResponse)
async def deny(request: Request, request_id: str, comment: str = Form("")):
    admin_user = require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        result = await service.deny_request(request_id, admin_user, comment)
        notify_request_denied(result)
        return RedirectResponse(url="/approvals", status_code=303)
    except ValueError as e:
        pending = db.list_requests(status="pending")
        active = db.get_active_grants()
        return templates.TemplateResponse(
            "approvals.html",
            {"request": request, "pending": pending, "active": active, "error": str(e), "admin_user": admin_user},
        )
    finally:
        await client.close()


@router.post("/revoke/{request_id}")
async def revoke(request: Request, request_id: str):
    require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        result = await service.revoke_access(request_id)
        return RedirectResponse(url="/approvals", status_code=303)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


# ── JSON API endpoints (also protected) ───────────────────

@router.post("/api/requests/{request_id}/approve")
async def api_approve(request: Request, request_id: str, body: ReviewAction):
    require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        result = await service.approve_request(request_id, body.reviewer, body.comment)
        notify_request_approved(result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


@router.post("/api/requests/{request_id}/deny")
async def api_deny(request: Request, request_id: str, body: ReviewAction):
    require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        result = await service.deny_request(request_id, body.reviewer, body.comment)
        notify_request_denied(result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


@router.post("/api/requests/{request_id}/revoke")
async def api_revoke(request: Request, request_id: str):
    require_admin(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        return await service.revoke_access(request_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()
