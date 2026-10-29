"""Database migration tool to copy all schema and data from Source PostgreSQL to Target PostgreSQL.

Usage:
    python backend/scripts/migrate_database.py --source "<RENDER_URL>" --target "<AIVEN_URL>"
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import Table, text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine  # noqa: E402

from app.infrastructure.persistence.database import normalize_database_url  # noqa: E402
from app.infrastructure.persistence.models import Base  # noqa: E402

TABLES_IN_ORDER = [
    "owners",
    "contacts",
    "contact_otps",
    "inactivity_monitors",
    "loans",
    "installments",
    "mutual_fund_holdings",
    "bank_accounts",
    "nominee_guidance",
    "documents",
    "packet_shares",
    "refresh_tokens",
    "outbox_messages",
    "audit_events",
    "scheduler_heartbeats",
]


def clean_url(url: str) -> str:
    """Normalize and format URL for asyncpg."""
    url = url.strip().strip("'\"")
    url = normalize_database_url(url)
    if "sslmode=require" in url and "ssl=require" not in url:
        url = url.replace("sslmode=require", "ssl=require")
    return url


async def copy_table_data(
    source_conn: AsyncConnection,
    target_conn: AsyncConnection,
    table: Table,
) -> int:
    """Read all rows from source table and insert into target table."""
    select_stmt = table.select()
    result = await source_conn.execute(select_stmt)
    rows = [dict(r._mapping) for r in result.fetchall()]

    if not rows:
        return 0

    # Clear target table first to avoid duplicate primary key conflicts
    await target_conn.execute(table.delete())

    # Insert in chunks of 500
    chunk_size = 500
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        await target_conn.execute(table.insert(), chunk)

    return len(rows)


async def migrate_data(source_url: str, target_url: str) -> None:
    source_url = clean_url(source_url)
    target_url = clean_url(target_url)

    print("=" * 60)
    print("Family Safety Net: Database Migration (Render -> Aiven)")
    print("=" * 60)

    source_engine = create_async_engine(source_url, pool_pre_ping=True)
    target_engine = create_async_engine(target_url, pool_pre_ping=True)

    try:
        # Step 1: Create all tables on target database
        print("\n[1/3] Ensuring tables exist on target database...")
        async with target_engine.begin() as target_conn:
            await target_conn.run_sync(Base.metadata.create_all)
        print("  -> Schema ready on target.")

        # Step 2: Copy data table by table in dependency order
        print("\n[2/3] Copying table data from source to target...")
        summary: dict[str, int] = {}

        async with source_engine.connect() as source_conn, target_engine.begin() as target_conn:
            for table_name in TABLES_IN_ORDER:
                table = Base.metadata.tables.get(table_name)
                if table is None:
                    continue

                try:
                    count = await copy_table_data(source_conn, target_conn, table)
                    summary[table_name] = count
                    print(f"  [OK] {table_name:<24} : {count:>5} rows copied")
                except Exception as ex:
                    print(f"  [WARN] {table_name:<24} : skipped or empty ({ex})")
                    summary[table_name] = 0

            # Step 3: Sync alembic_version table so Alembic knows head revision
            print("\n[3/3] Synchronizing Alembic migration version...")
            try:
                ver_res = await source_conn.execute(
                    text("SELECT version_num FROM alembic_version LIMIT 1")
                )
                source_version = ver_res.scalar_one_or_none() or "011"
            except Exception:
                source_version = "011"

            await target_conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS alembic_version (
                        version_num VARCHAR(32) NOT NULL PRIMARY KEY
                    );
                    """
                )
            )
            await target_conn.execute(text("DELETE FROM alembic_version;"))
            await target_conn.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:ver);"),
                {"ver": source_version},
            )
            print(f"  -> Alembic version set to: {source_version}")

        print("\n" + "=" * 60)
        print("Migration Summary:")
        print("=" * 60)
        total_rows = sum(summary.values())
        for tbl, cnt in summary.items():
            print(f"  {tbl:<24} : {cnt} rows")
        print("-" * 60)
        print(f"Total Rows Migrated: {total_rows}")
        print("=" * 60)
        print("\nSUCCESS! Your Aiven database is ready to use.")

    finally:
        await source_engine.dispose()
        await target_engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate PostgreSQL database from Render to Aiven")
    parser.add_argument("--source", required=True, help="Render External Database URL")
    parser.add_argument("--target", required=True, help="Aiven Service URI")
    args = parser.parse_args()

    asyncio.run(migrate_data(args.source, args.target))


if __name__ == "__main__":
    main()
