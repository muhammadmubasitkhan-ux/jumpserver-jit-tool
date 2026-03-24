"""Routes for submitting and viewing JIT access requests."""

from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.models import AccessRequestCreate
from app.services.jit_service import JITService
from app.services.notification import notify_new_request
from app.dependencies import create_jumpserver_client
from app.auth import require_requester
from app import database as db
from app.config import get_settings

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse)
async def request_form(request: Request):
    requester = require_requester(request)
    client = create_jumpserver_client()
    try:
        assets = await client.list_assets()
        return templates.TemplateResponse(
            "request_access.html",
            {"request": request, "js_assets": assets, "requester_info": requester},
        )
    finally:
        await client.close()


@router.post("/", response_class=HTMLResponse)
async def submit_request(
    request: Request,
    asset_hostname: str = Form(...),
    accounts: str = Form("@ALL"),
    reason: str = Form(...),
    duration_minutes: int = Form(120),
):
    requester = require_requester(request)
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        access_req = await service.submit_request(
            requester=requester["name"],
            requester_email=requester.get("email", ""),
            jumpserver_user=requester["username"],
            asset_hostname=asset_hostname,
            accounts=accounts,
            reason=reason,
            duration_minutes=duration_minutes,
        )
        notify_new_request(access_req)
        assets = await client.list_assets()
        return templates.TemplateResponse(
            "request_access.html",
            {
                "request": request,
                "success": True,
                "req_id": access_req["id"],
                "js_assets": assets,
                "requester_info": requester,
            },
        )
    except ValueError as e:
        assets = await client.list_assets()
        return templates.TemplateResponse(
            "request_access.html",
            {"request": request, "error": str(e), "js_assets": assets, "requester_info": requester},
        )
    finally:
        await client.close()


@router.get("/my", response_class=HTMLResponse)
async def my_requests(request: Request):
    requester = require_requester(request)
    all_reqs = db.list_requests()
    user_reqs = [r for r in all_reqs if r["jumpserver_user"] == requester["username"]]
    return templates.TemplateResponse(
        "my_requests.html",
        {"request": request, "requests": user_reqs, "requester_info": requester},
    )


# ── JSON API endpoints ────────────────────────────────────

@router.get("/api/jumpserver/assets")
async def api_jumpserver_assets(search: str = ""):
    client = create_jumpserver_client()
    try:
        assets = await client.list_assets(search=search)
        return [{"id": a.get("id"), "name": a.get("name"), "address": a.get("address")} for a in assets]
    finally:
        await client.close()


@router.get("/api/jumpserver/accounts/{asset_id}")
async def api_jumpserver_accounts(asset_id: str):
    client = create_jumpserver_client()
    try:
        accounts = await client.get_asset_accounts(asset_id)
        return [
            {
                "id": a.get("id"),
                "name": a.get("name") or a.get("username", ""),
                "username": a.get("username", ""),
            }
            for a in accounts
        ]
    finally:
        await client.close()


@router.post("/api/requests")
async def api_submit_request(body: AccessRequestCreate):
    client = create_jumpserver_client()
    service = JITService(client)
    try:
        access_req = await service.submit_request(
            requester=body.requester,
            requester_email=body.requester_email,
            jumpserver_user=body.jumpserver_user,
            asset_hostname=body.asset_hostname,
            accounts=body.accounts,
            reason=body.reason,
            duration_minutes=body.duration_minutes,
        )
        notify_new_request(access_req)
        return access_req
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


@router.get("/api/requests")
async def api_list_requests(status: str = None, limit: int = 50):
    return db.list_requests(status=status, limit=limit)


@router.get("/api/requests/{request_id}")
async def api_get_request(request_id: str):
    req = db.get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req
