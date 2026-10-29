"""Integration test for Alembic migrations on real PostgreSQL."""

import asyncio
from pathlib import Path

import pytest
from alembic.config import Config

from alembic import command
from tests.conftest import TEST_DB_URL


@pytest.mark.asyncio
async def test_alembic_migrations_lifecycle() -> None:
    """Verifies that Alembic can successfully upgrade to head, downgrade to base, and re-upgrade."""
    backend_dir = Path(__file__).resolve().parent.parent.parent
    alembic_ini_path = backend_dir / "alembic.ini"

    cfg = Config(str(alembic_ini_path))
    cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))

    # Alembic's env.py calls asyncio.run(), so run command in a worker thread
    def run_upgrade() -> None:
        command.upgrade(cfg, "head")

    def run_downgrade() -> None:
        command.downgrade(cfg, "base")

    # Step 1: Upgrade to head
    await asyncio.to_thread(run_upgrade)

    # Step 2: Downgrade to base
    await asyncio.to_thread(run_downgrade)

    # Step 3: Re-upgrade to head
    await asyncio.to_thread(run_upgrade)
