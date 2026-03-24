"""Restore SQLite database from a backup file."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from app.config import get_settings


def sqlite_path_from_url(url: str) -> Path:
    if url.startswith("sqlite:///"):
        return Path(url.replace("sqlite:///", "", 1))
    return Path("jit_access.db")


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore JIT SQLite database from backup file.")
    parser.add_argument("--backup", required=True, help="Path to backup .db file")
    args = parser.parse_args()

    backup_path = Path(args.backup)
    if not backup_path.exists():
        raise SystemExit(f"Backup file not found: {backup_path}")

    settings = get_settings()
    db_path = sqlite_path_from_url(settings.database_url)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backup_path, db_path)
    print(f"Database restored from {backup_path} to {db_path}")


if __name__ == "__main__":
    main()
