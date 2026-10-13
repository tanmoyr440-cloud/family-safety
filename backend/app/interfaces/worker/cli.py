"""Command Line Interface for scheduler worker.

Usage:
  python -m app.interfaces.worker evaluate [--as-of ISO_DATE] [--dry-run]
  python -m app.interfaces.worker dispatch [--dry-run]
  python -m app.interfaces.worker run [--dry-run] [--interval SECONDS]
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import UTC, datetime

import structlog

from app.config import settings
from app.infrastructure.persistence.database import create_engine, create_session_factory
from app.infrastructure.security import redact_sensitive_data
from app.interfaces.worker.service import WorkerService

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        redact_sensitive_data,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger("worker")


def parse_iso_datetime(value: str) -> datetime:
    """Parse ISO 8601 string to timezone-aware UTC datetime."""
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except ValueError as err:
        raise argparse.ArgumentTypeError(f"Invalid ISO 8601 datetime: '{value}'") from err


def build_parser() -> argparse.ArgumentParser:
    """Construct CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="python -m app.interfaces.worker",
        description="Family Safety Net Background Scheduler & Dispatch Worker",
    )
    subparsers = parser.add_subparsers(dest="command", help="Worker commands")

    # Command: evaluate
    eval_parser = subparsers.add_parser("evaluate", help="Run evaluation cycle for all owners")
    eval_parser.add_argument(
        "--as-of",
        type=parse_iso_datetime,
        default=None,
        help="Replay evaluation as of specific timestamp (e.g. 2026-12-24T09:00:00+05:30)",
    )
    eval_parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Simulate sending without invoking external notification APIs",
    )

    # Command: dispatch
    disp_parser = subparsers.add_parser("dispatch", help="Dispatch pending outbox messages")
    disp_parser.add_argument(
        "--as-of",
        type=parse_iso_datetime,
        default=None,
        help="Replay dispatch as of specific timestamp",
    )
    disp_parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Simulate sending without invoking external notification APIs",
    )

    # Command: run (daemon mode)
    run_parser = subparsers.add_parser("run", help="Start long-running scheduler worker process")
    run_parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Simulate sending without invoking external notification APIs",
    )
    run_parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Outbox polling interval in seconds (default: 60)",
    )

    return parser


async def run_worker(args: argparse.Namespace) -> int:
    """Execute selected worker command."""
    db_url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("TEST_DATABASE_URL")
        or settings.database_url
    )
    engine = create_engine(db_url)
    session_factory = create_session_factory(engine)
    worker_service = WorkerService(session_factory=session_factory)

    try:
        if args.command == "evaluate":
            dry_run = args.dry_run or settings.dry_run
            as_of = args.as_of
            logger.info("Running evaluation (as_of=%s, dry_run=%s)", as_of, dry_run)
            results = await worker_service.run_evaluation_cycle(as_of=as_of, dry_run=dry_run)
            logger.info("Evaluation results: %s", results)
            return 0

        if args.command == "dispatch":
            dry_run = args.dry_run or settings.dry_run
            as_of = args.as_of
            logger.info("Running outbox dispatch (as_of=%s, dry_run=%s)", as_of, dry_run)
            count = await worker_service.dispatch_outbox(as_of=as_of, dry_run=dry_run)
            logger.info("Dispatched %d messages", count)
            return 0

        if args.command == "run":
            dry_run = args.dry_run or settings.dry_run
            interval = args.interval
            logger.info(
                "Starting background scheduler daemon (interval=%ds, dry_run=%s)",
                interval,
                dry_run,
            )

            # Continuous polling loop
            while True:
                try:
                    await worker_service.dispatch_outbox(dry_run=dry_run)
                except Exception as exc:
                    logger.error("Error in dispatch cycle: %s", exc, exc_info=True)

                await asyncio.sleep(interval)

        logger.error("Unknown command. Run with --help for usage.")
        return 1

    finally:
        await engine.dispose()


def main() -> None:
    """Main CLI entrypoint."""
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    sys.exit(asyncio.run(run_worker(args)))
