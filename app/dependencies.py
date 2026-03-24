"""Shared FastAPI dependencies."""

from app.jumpserver_client import JumpServerClient


def create_jumpserver_client() -> JumpServerClient:
    """Create a JumpServerClient using PAM HMAC-SHA256 auth."""
    return JumpServerClient()
