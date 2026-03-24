"""Session-based authentication — both requester and admin use JumpServer/LDAP."""

from datetime import datetime, timezone

from fastapi import Request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.config import get_settings

_settings = get_settings()
_serializer = URLSafeTimedSerializer(_settings.secret_key)

ADMIN_COOKIE = "jit_admin"
REQUESTER_COOKIE = "jit_requester"
SESSION_MAX_AGE = 8 * 3600  # 8 hours


class NotAuthenticatedError(Exception):
    def __init__(self, redirect_to: str):
        self.redirect_to = redirect_to


# ── Admin auth (JumpServer System Admin) ───────────────

def get_current_admin(request: Request) -> str | None:
    token = request.cookies.get(ADMIN_COOKIE)
    if not token:
        return None
    try:
        data = _serializer.loads(token, max_age=SESSION_MAX_AGE)
        if data.get("role") == "admin":
            return data.get("user")
        return None
    except (BadSignature, SignatureExpired):
        return None


def require_admin(request: Request) -> str:
    user = get_current_admin(request)
    if not user:
        raise NotAuthenticatedError("/auth/login")
    return user


def set_admin_session(response, username: str, name: str = ""):
    token = _serializer.dumps({
        "user": username, "name": name, "role": "admin",
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(ADMIN_COOKIE, token, max_age=SESSION_MAX_AGE, httponly=True, samesite="lax")
    return response


def clear_admin_session(response):
    response.delete_cookie(ADMIN_COOKIE)
    return response


# ── Requester auth (JumpServer / LDAP) ─────────────────

def get_current_requester(request: Request) -> dict | None:
    """Returns {'username', 'name', 'email', 'id'} or None."""
    token = request.cookies.get(REQUESTER_COOKIE)
    if not token:
        return None
    try:
        data = _serializer.loads(token, max_age=SESSION_MAX_AGE)
        if data.get("role") == "requester":
            return {
                "username": data.get("username", ""),
                "name": data.get("name", ""),
                "email": data.get("email", ""),
                "id": data.get("id", ""),
            }
        return None
    except (BadSignature, SignatureExpired):
        return None


def require_requester(request: Request) -> dict:
    user = get_current_requester(request)
    if not user:
        raise NotAuthenticatedError("/auth/login")
    return user


def set_requester_session(response, user_info: dict):
    token = _serializer.dumps({
        "role": "requester",
        "username": user_info["username"],
        "name": user_info["name"],
        "email": user_info.get("email", ""),
        "id": user_info.get("id", ""),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(REQUESTER_COOKIE, token, max_age=SESSION_MAX_AGE, httponly=True, samesite="lax")
    return response


def clear_requester_session(response):
    response.delete_cookie(REQUESTER_COOKIE)
    return response
