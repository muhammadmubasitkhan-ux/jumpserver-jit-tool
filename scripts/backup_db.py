"""Create timestamped backups of the SQLite database file."""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

from app.config import get_settings


def sqlite_path_from_url(url: str) -> Path:
    if url.startswith("sqlite:///"):
        return Path(url.replace("sqlite:///", "", 1))
    return Path("jit_access.db")


def main() -> None:
    settings = get_settings()
    db_path = sqlite_path_from_url(settings.database_url)
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    backup_dir = Path("backups")
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"jit_access-{timestamp}.db"
    shutil.copy2(db_path, backup_path)
    print(f"Backup created: {backup_path}")


if __name__ == "__main__":
    main()
