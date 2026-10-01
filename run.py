#!/usr/bin/env python3
"""Build and serve the app, open it in a browser, and stop when it is left idle.

    python3 run.py            build, serve, and open the site
    python3 run.py dev        run the Vite dev server instead
    python3 run.py build      build only
    python3 run.py serve      serve an existing build
    python3 run.py test       unit tests and the contrast check
    python3 run.py e2e        Playwright checks against the fake camera

    python3 run.py --no-open  serve without opening a browser
    python3 run.py --idle 30  stop after 30s with no activity (default 60)

The server binds to 127.0.0.1 so the page is treated as a secure context,
which is what getUserMedia needs. Ctrl-C stops it, and so does closing the
tab: the page sends a heartbeat, and the server stops itself once they stop.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 4173
URL = f"http://{HOST}:{PORT}/"
IDLE_SECONDS = 60


def run(command: list[str]) -> None:
    print(f"\n$ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def build() -> None:
    run(["npm", "run", "build"])


def wait_for_server() -> None:
    """Wait until the server answers, so the browser opens a ready page."""
    for _ in range(120):
        try:
            with urllib.request.urlopen(URL, timeout=1):
                return
        except OSError:
            time.sleep(0.5)
    print("\nThe server did not answer in time.", file=sys.stderr)


def serve(open_browser: bool = True, idle_seconds: int = IDLE_SECONDS) -> None:
    if not (ROOT / "dist" / "index.html").exists():
        print("No dist/ yet. Building first.", flush=True)
        build()
    # Imported here so the other commands do not need the server around.
    sys.path.insert(0, str(ROOT))
    from server import serve as serve_with_idle

    print(f"\n$ python3 server.py --host {HOST} --port {PORT} --idle {idle_seconds}", flush=True)
    server = subprocess.Popen(
        [sys.executable, "server.py", "--host", HOST, "--port", str(PORT), "--idle", str(idle_seconds)],
        cwd=ROOT,
    )
    wait_for_server()
    finish(server, open_browser)


def dev(open_browser: bool = True) -> None:
    print(f"\n$ npx vite --host {HOST} --port {PORT} --strictPort", flush=True)
    server = subprocess.Popen(
        ["npx", "vite", "--host", HOST, "--port", str(PORT), "--strictPort"],
        cwd=ROOT,
    )
    wait_for_server()
    finish(server, open_browser)


def finish(server: subprocess.Popen, open_browser: bool) -> None:
    """Open the site, then wait for the server to be stopped."""
    if open_browser:
        print(f"\nOpening {URL} in your browser.", flush=True)
        if not webbrowser.open(URL):
            print("Could not open a browser. Visit the address above.", flush=True)
    else:
        print(f"\nServing at {URL}", flush=True)

    print("Press Ctrl-C to stop.\n", flush=True)
    try:
        server.wait()
    except KeyboardInterrupt:
        pass
    finally:
        server.terminate()
        server.wait()


def test() -> None:
    run(["npm", "test"])


def e2e() -> None:
    run(["npx", "playwright", "test"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        nargs="?",
        default="serve",
        choices=["serve", "dev", "build", "test", "e2e"],
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="serve without opening a browser",
    )
    parser.add_argument(
        "--idle",
        type=int,
        default=IDLE_SECONDS,
        metavar="SECONDS",
        help=f"stop after this long with no activity (default {IDLE_SECONDS})",
    )
    args = parser.parse_args()

    if not (ROOT / "node_modules").exists():
        print("node_modules is missing. Run npm install first.", file=sys.stderr)
        return 1
    if shutil.which("npm") is None:
        print("npm was not found on PATH.", file=sys.stderr)
        return 1

    open_browser = not args.no_open
    if args.command == "serve":
        serve(open_browser, args.idle)
    elif args.command == "dev":
        dev(open_browser)
    elif args.command == "build":
        build()
    elif args.command == "test":
        test()
    elif args.command == "e2e":
        e2e()
    return 0


if __name__ == "__main__":
    os.chdir(ROOT)
    sys.exit(main())
