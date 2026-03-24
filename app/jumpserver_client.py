"""JumpServer REST API client using Private Token authentication."""

import requests as req
import urllib3
from datetime import datetime, timezone
from typing import Optional
from app.config import get_settings


class JumpServerClient:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.jumpserver_url.rstrip("/")
        self.org_id = settings.jumpserver_org_id
        self.token = settings.jumpserver_private_token
        self.verify_ssl = settings.jumpserver_verify_ssl
        self.session = req.Session()
        self.session.verify = self.verify_ssl
        if not self.verify_ssl:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        self.session.headers.update({
            "Authorization": f"Token {self.token}",
            "Content-Type": "application/json",
            "X-JMS-ORG": self.org_id,
        })

    def _get(self, path: str, params: dict = None) -> req.Response:
        resp = self.session.get(f"{self.base_url}{path}", params=params, timeout=30)
        resp.raise_for_status()
        return resp

    def _post(self, path: str, json: dict = None) -> req.Response:
        resp = self.session.post(f"{self.base_url}{path}", json=json, timeout=30)
        resp.raise_for_status()
        return resp

    def _patch(self, path: str, json: dict = None) -> req.Response:
        resp = self.session.patch(f"{self.base_url}{path}", json=json, timeout=30)
        resp.raise_for_status()
        return resp

    def _delete(self, path: str) -> req.Response:
        return self.session.delete(f"{self.base_url}{path}", timeout=30)

    def _raw_request(self, method: str, path: str, params: dict = None) -> req.Response:
        return self.session.request(method, f"{self.base_url}{path}", params=params, timeout=30)

    async def close(self):
        self.session.close()

    # ── Users ──────────────────────────────────────────────

    async def get_user_by_username(self, username: str) -> Optional[dict]:
        resp = self._get("/api/v1/users/users/", params={"username": username})
        users = resp.json()
        if isinstance(users, dict) and "results" in users:
            users = users["results"]
        return users[0] if users else None

    def is_system_admin(self, user_data: dict) -> bool:
        """Check if a JumpServer user has the System Admin role."""
        if user_data.get("role") == "Admin":
            return True
        for sr in user_data.get("system_roles", []):
            name = sr.get("name", "") if isinstance(sr, dict) else str(sr)
            if "admin" in name.lower():
                return True
        if user_data.get("is_superuser"):
            return True
        return False

    async def list_users(self, search: str = "") -> list[dict]:
        params = {"search": search} if search else {}
        resp = self._get("/api/v1/users/users/", params=params)
        data = resp.json()
        return data.get("results", data) if isinstance(data, dict) else data

    # ── Assets ─────────────────────────────────────────────

    async def get_asset_by_hostname(self, hostname: str) -> Optional[dict]:
        resp = self._get("/api/v1/assets/assets/", params={"name": hostname})
        assets = resp.json()
        if isinstance(assets, dict) and "results" in assets:
            assets = assets["results"]
        return assets[0] if assets else None

    async def list_assets(self, search: str = "") -> list[dict]:
        params = {"search": search} if search else {}
        resp = self._get("/api/v1/assets/assets/", params=params)
        data = resp.json()
        return data.get("results", data) if isinstance(data, dict) else data

    async def list_asset_nodes(self) -> list[dict]:
        candidates = [
            "/api/v1/assets/nodes/",
            "/api/v1/assets/asset-nodes/",
            "/api/v2/assets/nodes/",
        ]
        for path in candidates:
            try:
                resp = self._get(path, params={"limit": 1000})
                data = resp.json()
                nodes = data.get("results", data) if isinstance(data, dict) else data
                if isinstance(nodes, list):
                    return nodes
            except Exception:
                continue
        return []

    async def get_asset_accounts(self, asset_id: str) -> list[dict]:
        candidates = [
            ("/api/v1/accounts/accounts/", {"asset": asset_id, "limit": 100}),
            ("/api/v1/accounts/accounts/", {"assets": asset_id, "limit": 100}),
            ("/api/v1/accounts/accounts/", {"asset_id": asset_id, "limit": 100}),
            (f"/api/v1/assets/assets/{asset_id}/accounts/", {"limit": 100}),
            (f"/api/v2/assets/assets/{asset_id}/accounts/", {"limit": 100}),
        ]

        for path, params in candidates:
            try:
                resp = self._get(path, params=params)
                data = resp.json()
                accounts = data.get("results", data) if isinstance(data, dict) else data
                if isinstance(accounts, list) and accounts:
                    return accounts
            except Exception:
                continue

        # Fallback: some JumpServer versions ignore/rename account filter params.
        # Fetch a wider list and filter client-side by asset identifier.
        try:
            resp = self._get("/api/v1/accounts/accounts/", params={"limit": 500})
            data = resp.json()
            accounts = data.get("results", data) if isinstance(data, dict) else data
            if not isinstance(accounts, list):
                return []

            filtered = []
            for account in accounts:
                if not isinstance(account, dict):
                    continue
                account_asset = account.get("asset")
                account_asset_id = account.get("asset_id")

                if account_asset_id == asset_id:
                    filtered.append(account)
                    continue

                if isinstance(account_asset, str) and account_asset == asset_id:
                    filtered.append(account)
                    continue

                if isinstance(account_asset, dict) and account_asset.get("id") == asset_id:
                    filtered.append(account)
                    continue

            return filtered
        except Exception:
            pass

        return []

    # ── Permissions (JIT core) ─────────────────────────────

    async def create_permission(
        self,
        name: str,
        user_ids: list[str],
        asset_ids: list[str],
        accounts: list[str],
        actions: list[str],
        date_start: datetime,
        date_expired: datetime,
    ) -> dict:
        payload = {
            "name": name,
            "users": user_ids,
            "assets": asset_ids,
            "accounts": accounts,
            "actions": actions,
            "date_start": date_start.isoformat(),
            "date_expired": date_expired.isoformat(),
            "is_active": True,
        }
        resp = self._post("/api/v1/perms/asset-permissions/", json=payload)
        return resp.json()

    async def deactivate_permission(self, permission_id: str) -> bool:
        resp = self._patch(
            f"/api/v1/perms/asset-permissions/{permission_id}/",
            json={"is_active": False},
        )
        return resp.status_code == 200

    async def delete_permission(self, permission_id: str) -> bool:
        resp = self._delete(f"/api/v1/perms/asset-permissions/{permission_id}/")
        return resp.status_code in (200, 204)

    async def get_permission(self, permission_id: str) -> Optional[dict]:
        try:
            resp = self._get(f"/api/v1/perms/asset-permissions/{permission_id}/")
            return resp.json()
        except req.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                return None
            raise

    async def list_jit_permissions(self, prefix: str = "jit-") -> list[dict]:
        resp = self._get(
            "/api/v1/perms/asset-permissions/",
            params={"name": prefix, "limit": 100},
        )
        data = resp.json()
        return data.get("results", data) if isinstance(data, dict) else data

    # ── Sessions ───────────────────────────────────────────

    async def get_active_sessions(self) -> list[dict]:
        resp = self._get("/api/v1/terminal/sessions/", params={"is_finished": False})
        data = resp.json()
        return data.get("results", data) if isinstance(data, dict) else data

    async def terminate_session(self, session_id: str) -> bool:
        resp = self._post(f"/api/v1/terminal/sessions/{session_id}/terminate/")
        return resp.status_code in (200, 204)

    # ── Authentication ────────────────────────────────────

    def authenticate_user(self, username: str, password: str) -> dict | None:
        """Validate user credentials via JumpServer auth API (LDAP-backed).
        Returns user info dict on success, None on failure.
        A 'mfa_required' response still means credentials were valid."""
        try:
            resp = req.post(
                f"{self.base_url}/api/v1/authentication/auth/",
                json={"username": username, "password": password},
                verify=self.verify_ssl,
                timeout=15,
            )
            data = resp.json()

            if resp.status_code == 200 and data.get("token"):
                user = data.get("user") or {}
                return {"username": user.get("username", username),
                        "name": user.get("name", username),
                        "email": user.get("email", ""),
                        "id": user.get("id", "")}

            if data.get("error") == "mfa_required" or data.get("code") == "mfa_required":
                user = data.get("user") or data.get("data", {}).get("user") or {}
                return {"username": user.get("username", username),
                        "name": user.get("name", username),
                        "email": user.get("email", ""),
                        "id": user.get("id", "")}

            return None
        except Exception:
            return None

    # ── Health check ───────────────────────────────────────

    async def health_check(self) -> bool:
        try:
            resp = self.session.get(f"{self.base_url}/api/health/", timeout=10)
            return resp.status_code == 200
        except Exception:
            return False
