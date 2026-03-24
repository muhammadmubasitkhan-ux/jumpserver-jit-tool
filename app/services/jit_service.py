"""Core JIT access service — orchestrates requests, approvals, and cleanup."""

import logging
from datetime import datetime, timedelta, timezone

from app.jumpserver_client import JumpServerClient
from app import database as db
from app.config import get_settings

logger = logging.getLogger(__name__)


class JITService:
    def __init__(self, client: JumpServerClient):
        self.client = client
        self.settings = get_settings()

    async def submit_request(
        self,
        requester: str,
        requester_email: str,
        jumpserver_user: str,
        asset_hostname: str,
        accounts: str,
        reason: str,
        duration_minutes: int,
    ) -> dict:
        if duration_minutes > self.settings.max_access_duration_minutes:
            raise ValueError(
                f"Duration exceeds maximum of {self.settings.max_access_duration_minutes} minutes"
            )

        user = await self.client.get_user_by_username(jumpserver_user)
        if not user:
            raise ValueError(f"JumpServer user '{jumpserver_user}' not found")

        asset_names = [a.strip() for a in asset_hostname.split(",") if a.strip()]
        if not asset_names:
            raise ValueError("At least one asset must be selected")

        for name in asset_names:
            asset = await self.client.get_asset_by_hostname(name)
            if not asset:
                raise ValueError(f"Asset '{name}' not found in JumpServer")

        request = db.create_request(
            requester=requester,
            requester_email=requester_email,
            jumpserver_user=jumpserver_user,
            asset_hostname=asset_hostname,
            accounts=accounts,
            reason=reason,
            duration_minutes=duration_minutes,
        )

        logger.info(
            "JIT request %s created by %s for %s -> %s (%d min)",
            request["id"], requester, jumpserver_user, asset_hostname, duration_minutes,
        )
        return request

    async def approve_request(
        self, request_id: str, reviewer: str, comment: str = ""
    ) -> dict:
        req = db.get_request(request_id)
        if not req:
            raise ValueError("Request not found")
        if req["status"] != "pending":
            raise ValueError(f"Request is already '{req['status']}', cannot approve")

        user = await self.client.get_user_by_username(req["jumpserver_user"])
        if not user:
            raise ValueError(f"JumpServer user '{req['jumpserver_user']}' no longer exists")

        asset_names = [a.strip() for a in req["asset_hostname"].split(",") if a.strip()]
        asset_ids = []
        for name in asset_names:
            asset = await self.client.get_asset_by_hostname(name)
            if not asset:
                raise ValueError(f"Asset '{name}' no longer exists")
            asset_ids.append(asset["id"])

        now = datetime.now(timezone.utc)
        expiry = now + timedelta(minutes=req["duration_minutes"])

        accounts = [a.strip() for a in req["accounts"].split(",")]
        short_assets = asset_names[0] if len(asset_names) == 1 else f"{asset_names[0]}+{len(asset_names)-1}"
        perm_name = f"jit-{req['jumpserver_user']}-{short_assets}-{now.strftime('%Y%m%d%H%M%S')}"

        permission = await self.client.create_permission(
            name=perm_name,
            user_ids=[user["id"]],
            asset_ids=asset_ids,
            accounts=accounts,
            actions=["connect", "upload", "download"],
            date_start=now,
            date_expired=expiry,
        )

        result = db.approve_request(
            request_id=request_id,
            reviewer=reviewer,
            permission_id=permission["id"],
            permission_name=perm_name,
            access_start=now.isoformat(),
            access_expiry=expiry.isoformat(),
            comment=comment,
        )

        logger.info(
            "JIT request %s approved by %s — permission %s expires at %s",
            request_id, reviewer, permission["id"], expiry.isoformat(),
        )
        return result

    async def deny_request(
        self, request_id: str, reviewer: str, comment: str = ""
    ) -> dict:
        req = db.get_request(request_id)
        if not req:
            raise ValueError("Request not found")
        if req["status"] != "pending":
            raise ValueError(f"Request is already '{req['status']}', cannot deny")

        result = db.deny_request(request_id, reviewer, comment)
        logger.info("JIT request %s denied by %s", request_id, reviewer)
        return result

    async def revoke_access(self, request_id: str) -> dict:
        req = db.get_request(request_id)
        if not req:
            raise ValueError("Request not found")
        if req["status"] != "approved":
            raise ValueError("Only approved requests can be revoked")

        if req["permission_id"]:
            await self.client.deactivate_permission(req["permission_id"])
            await self.client.delete_permission(req["permission_id"])

        result = db.revoke_request(request_id)
        logger.info("JIT access revoked for request %s", request_id)
        return result

    async def cleanup_expired(self) -> int:
        """Delete expired JumpServer permissions and update local records."""
        expired = db.get_expired_grants()
        cleaned = 0
        for req in expired:
            if req["permission_id"]:
                try:
                    await self.client.delete_permission(req["permission_id"])
                except Exception as e:
                    logger.warning(
                        "Failed to delete permission %s: %s", req["permission_id"], e
                    )
            db.mark_expired(req["id"])
            cleaned += 1
            logger.info("Cleaned up expired grant: request %s", req["id"])
        return cleaned

    async def get_dashboard_stats(self) -> dict:
        all_requests = db.list_requests(limit=1000)
        active = db.get_active_grants()
        pending = db.list_requests(status="pending")
        return {
            "total_requests": len(all_requests),
            "active_grants": len(active),
            "pending_approvals": len(pending),
            "status_breakdown": _count_by_status(all_requests),
        }


def _count_by_status(requests: list[dict]) -> dict:
    counts = {}
    for r in requests:
        s = r["status"]
        counts[s] = counts.get(s, 0) + 1
    return counts
