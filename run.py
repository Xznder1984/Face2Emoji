#!/usr/bin/env python3
"""Build and serve the app.

    python3 run.py            build, then serve the production build
    python3 run.py dev        run the Vite dev server instead
    python3 run.py build      build only
    python3 run.py serve      serve an existing build
    python3 run.py test       unit tests and the contrast check
    python3 run.py e2e        Playwright checks against the fake camera

The server binds to 127.0.0.1 so the page is treated as a secure context,
which is what getUserMedia needs. Ctrl-C stops it.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 4173


def run(command: list[str]) -> None:
    print(f"\n$ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def build() -> None:
    run(["npm", "run", "build"])


def serve() -> None:
    if not (ROOT / "dist" / "index.html").exists():
        print("No dist/ yet. Building first.", flush=True)
        build()
    run(["npx", "vite", "preview", "--host", HOST, "--port", str(PORT), "--strictPort"])


def dev() -> None:
    run(["npx", "vite", "--host", HOST, "--port", str(PORT), "--strictPort"])


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
    args = parser.parse_args()

    if not (ROOT / "node_modules").exists():
        print("node_modules is missing. Run npm install first.", file=sys.stderr)
        return 1
    if shutil.which("npm") is None:
        print("npm was not found on PATH.", file=sys.stderr)
        return 1

    {"serve": serve, "dev": dev, "build": build, "test": test, "e2e": e2e}[args.command]()
    return 0


if __name__ == "__main__":
    os.chdir(ROOT)
    sys.exit(main())
