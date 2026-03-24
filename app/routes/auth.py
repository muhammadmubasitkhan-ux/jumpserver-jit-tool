"""Single login page — role is determined automatically from JumpServer."""

from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.auth import (
    set_admin_session,
    clear_admin_session,
    get_current_admin,
    get_current_requester,
    set_requester_session,
    clear_requester_session,
)
from app.dependencies import create_jumpserver_client

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if get_current_admin(request):
        return RedirectResponse(url="/dashboard", status_code=303)
    if get_current_requester(request):
        return RedirectResponse(url="/request", status_code=303)
    return templates.TemplateResponse(request, "login.html", {"request": request})


@router.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
):
    client = create_jumpserver_client()
    try:
        user_info = client.authenticate_user(username, password)
        if not user_info:
            return templates.TemplateResponse(
                request,
                "login.html",
                {"request": request, "error": "Invalid JumpServer credentials"},
            )

        full_user = await client.get_user_by_username(username)
        if full_user:
            user_info["name"] = full_user.get("name", user_info.get("name", username))
            user_info["email"] = full_user.get("email", user_info.get("email", ""))
            user_info["id"] = full_user.get("id", user_info.get("id", ""))
            user_info["username"] = full_user.get("username", username)
        else:
            full_user = {}

        is_admin = client.is_system_admin(full_user)
    finally:
        await client.close()

    if is_admin:
        resp = RedirectResponse(url="/dashboard", status_code=303)
        set_admin_session(resp, user_info["username"], user_info.get("name", ""))
    else:
        resp = RedirectResponse(url="/request", status_code=303)
        set_requester_session(resp, user_info)

    return resp


@router.get("/logout")
async def logout():
    resp = RedirectResponse(url="/auth/login", status_code=303)
    clear_admin_session(resp)
    clear_requester_session(resp)
    return resp


@router.post("/logout")
async def logout_api():
    resp = RedirectResponse(url="/auth/login", status_code=303)
    clear_admin_session(resp)
    clear_requester_session(resp)
    return resp


@router.get("/me")
async def me(request: Request):
    admin_user = get_current_admin(request)
    if admin_user:
        return {
            "username": admin_user,
            "role": "admin",
            "is_authenticated": True,
        }

    requester = get_current_requester(request)
    if requester:
        return {
            "username": requester.get("username", ""),
            "role": "requester",
            "is_authenticated": True,
        }

    return {
        "username": "",
        "role": "requester",
        "is_authenticated": False,
    }
