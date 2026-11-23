"""Keep-Alive Background Pinger Script.

Pings your Render backend (/health) and Vercel frontend at a configurable interval
to keep free-tier instances awake 24/7.

Usage:
    python backend/scripts/keep_alive.py --backend "https://your-app.onrender.com" --frontend "https://your-app.vercel.app"
    python backend/scripts/keep_alive.py --backend "https://your-app.onrender.com" --interval 10
"""

import argparse
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime


def ping_url(url: str, timeout: int = 45) -> tuple[int, str]:
    """Ping a URL and return HTTP status code and message."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "FamilySafetyNet-KeepAlive/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, "OK"
    except urllib.error.HTTPError as exc:
        return exc.code, exc.reason
    except urllib.error.URLError as exc:
        return 0, str(exc.reason)
    except Exception as exc:
        return 0, str(exc)


def run_pinger(backend_url: str | None, frontend_url: str | None, interval_minutes: int) -> None:
    """Continuously ping backend and frontend at the specified interval."""
    interval_seconds = max(60, interval_minutes * 60)

    print("=" * 60)
    print("Family Safety Net: Keep-Alive Pinger Service")
    print(f"Ping Interval: Every {interval_minutes} minutes")
    if backend_url:
        clean_backend = backend_url.rstrip("/")
        if not clean_backend.endswith("/health"):
            backend_target = f"{clean_backend}/health"
        else:
            backend_target = clean_backend
        print(f"Backend Target : {backend_target}")
    else:
        backend_target = None

    if frontend_url:
        frontend_target = frontend_url.rstrip("/")
        print(f"Frontend Target: {frontend_target}")
    else:
        frontend_target = None
    print("=" * 60)
    print("Pinger started. Press Ctrl+C to stop.\n")

    while True:
        now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(f"[{now_str}] Sending keep-alive pings...")

        if backend_target:
            code, reason = ping_url(backend_target, timeout=60)
            status_text = "ALIVE" if 200 <= code < 400 else "ERROR"
            print(f"  -> Backend ({backend_target}) : HTTP {code} [{status_text}] ({reason})")

        if frontend_target:
            code, reason = ping_url(frontend_target, timeout=30)
            status_text = "ALIVE" if 200 <= code < 400 else "ERROR"
            print(f"  -> Frontend ({frontend_target}) : HTTP {code} [{status_text}] ({reason})")

        print(f"Sleeping for {interval_minutes} minutes until next ping...\n")
        time.sleep(interval_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Keep Render and Vercel deployments awake by periodic HTTP pinging."
    )
    parser.add_argument(
        "--backend",
        "-b",
        help="URL of your Render backend (e.g. https://your-backend.onrender.com)",
        default=None,
    )
    parser.add_argument(
        "--frontend",
        "-f",
        help="URL of your Vercel frontend (e.g. https://your-frontend.vercel.app)",
        default=None,
    )
    parser.add_argument(
        "--interval",
        "-i",
        type=int,
        default=10,
        help="Ping interval in minutes (default: 10 minutes; Render sleeps after 15 min)",
    )

    args = parser.parse_args()

    if not args.backend and not args.frontend:
        print("Error: You must provide at least --backend or --frontend URL.")
        parser.print_help()
        sys.exit(1)

    try:
        run_pinger(args.backend, args.frontend, args.interval)
    except KeyboardInterrupt:
        print("\nKeep-alive pinger stopped by user.")


if __name__ == "__main__":
    main()
