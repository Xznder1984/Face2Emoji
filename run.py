#!/usr/bin/env python3
"""Build and serve the app, and open it in a browser.

    python3 run.py            build, serve, and open the site
    python3 run.py dev        run the Vite dev server instead
    python3 run.py build      build only
    python3 run.py serve      serve an existing build
    python3 run.py test       unit tests and the contrast check
    python3 run.py e2e        Playwright checks against the fake camera

    python3 run.py --no-open  serve without opening a browser

The server binds to 127.0.0.1 so the page is treated as a secure context,
which is what getUserMedia needs. Ctrl-C stops it.
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


def run(command: list[str]) -> None:
    print(f"\n$ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def build() -> None:
    run(["npm", "run", "build"])


def start_server(command: list[str]) -> subprocess.Popen:
    """Start the server in the background and wait until it answers."""
    print(f"\n$ {' '.join(command)}", flush=True)
    server = subprocess.Popen(command, cwd=ROOT)

    for _ in range(120):
        if server.poll() is not None:
            print("\nThe server exited before it was ready.", file=sys.stderr)
            return server
        try:
            with urllib.request.urlopen(URL, timeout=1):
                return server
        except OSError:
            time.sleep(0.5)

    print("\nThe server did not answer in time.", file=sys.stderr)
    return server


def serve(open_browser: bool = True) -> None:
    if not (ROOT / "dist" / "index.html").exists():
        print("No dist/ yet. Building first.", flush=True)
        build()
    server = start_server(
        ["npx", "vite", "preview", "--host", HOST, "--port", str(PORT), "--strictPort"]
    )
    finish(server, open_browser)


def dev(open_browser: bool = True) -> None:
    server = start_server(
        ["npx", "vite", "--host", HOST, "--port", str(PORT), "--strictPort"]
    )
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
    args = parser.parse_args()

    if not (ROOT / "node_modules").exists():
        print("node_modules is missing. Run npm install first.", file=sys.stderr)
        return 1
    if shutil.which("npm") is None:
        print("npm was not found on PATH.", file=sys.stderr)
        return 1

    open_browser = not args.no_open
    {"serve": serve, "dev": dev, "build": build, "test": test, "e2e": e2e}[args.command](
        **({"open_browser": open_browser} if args.command in {"serve", "dev"} else {})
    )
    return 0


if __name__ == "__main__":
    os.chdir(ROOT)
    sys.exit(main())
