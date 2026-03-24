"""SQLite database for tracking JIT access requests and approvals."""

import sqlite3
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Optional

DB_PATH = "jit_access.db"


def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS access_requests (
                id              TEXT PRIMARY KEY,
                requester       TEXT NOT NULL,
                requester_email TEXT,
                jumpserver_user TEXT NOT NULL,
                asset_hostname  TEXT NOT NULL,
                accounts        TEXT NOT NULL,
                reason          TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                status          TEXT NOT NULL DEFAULT 'pending',
                reviewer        TEXT,
                review_comment  TEXT,
                reviewed_at     TEXT,
                permission_id   TEXT,
                permission_name TEXT,
                access_start    TEXT,
                access_expiry   TEXT,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_status ON access_requests(status);
            CREATE INDEX IF NOT EXISTS idx_requester ON access_requests(requester);
            CREATE INDEX IF NOT EXISTS idx_expiry ON access_requests(access_expiry);
        """)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_request(
    requester: str,
    requester_email: str,
    jumpserver_user: str,
    asset_hostname: str,
    accounts: str,
    reason: str,
    duration_minutes: int,
) -> dict:
    request_id = str(uuid.uuid4())
    now = _now()
    with get_db() as db:
        db.execute(
            """INSERT INTO access_requests
               (id, requester, requester_email, jumpserver_user, asset_hostname,
                accounts, reason, duration_minutes, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
            (request_id, requester, requester_email, jumpserver_user,
             asset_hostname, accounts, reason, duration_minutes, now, now),
        )
    return get_request(request_id)


def get_request(request_id: str) -> Optional[dict]:
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM access_requests WHERE id = ?", (request_id,)
        ).fetchone()
    return dict(row) if row else None


def list_requests(status: Optional[str] = None, limit: int = 50) -> list[dict]:
    with get_db() as db:
        if status:
            rows = db.execute(
                "SELECT * FROM access_requests WHERE status = ? ORDER BY created_at DESC LIMIT ?",
                (status, limit),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM access_requests ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def approve_request(
    request_id: str,
    reviewer: str,
    permission_id: str,
    permission_name: str,
    access_start: str,
    access_expiry: str,
    comment: str = "",
) -> Optional[dict]:
    now = _now()
    with get_db() as db:
        db.execute(
            """UPDATE access_requests
               SET status = 'approved', reviewer = ?, review_comment = ?,
                   reviewed_at = ?, permission_id = ?, permission_name = ?,
                   access_start = ?, access_expiry = ?, updated_at = ?
               WHERE id = ? AND status = 'pending'""",
            (reviewer, comment, now, permission_id, permission_name,
             access_start, access_expiry, now, request_id),
        )
    return get_request(request_id)


def deny_request(
    request_id: str, reviewer: str, comment: str = ""
) -> Optional[dict]:
    now = _now()
    with get_db() as db:
        db.execute(
            """UPDATE access_requests
               SET status = 'denied', reviewer = ?, review_comment = ?,
                   reviewed_at = ?, updated_at = ?
               WHERE id = ? AND status = 'pending'""",
            (reviewer, comment, now, now, request_id),
        )
    return get_request(request_id)


def revoke_request(request_id: str) -> Optional[dict]:
    now = _now()
    with get_db() as db:
        db.execute(
            """UPDATE access_requests
               SET status = 'revoked', updated_at = ?
               WHERE id = ? AND status = 'approved'""",
            (now, request_id),
        )
    return get_request(request_id)


def get_active_grants() -> list[dict]:
    """Get all approved requests where access hasn't expired yet."""
    now = _now()
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM access_requests
               WHERE status = 'approved' AND access_expiry > ?
               ORDER BY access_expiry ASC""",
            (now,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_expired_grants() -> list[dict]:
    """Get approved requests that have expired but not yet cleaned up."""
    now = _now()
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM access_requests
               WHERE status = 'approved' AND access_expiry <= ?""",
            (now,),
        ).fetchall()
    return [dict(r) for r in rows]


def mark_expired(request_id: str):
    now = _now()
    with get_db() as db:
        db.execute(
            """UPDATE access_requests
               SET status = 'expired', updated_at = ?
               WHERE id = ?""",
            (now, request_id),
        )
