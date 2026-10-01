#!/usr/bin/env python3
"""A static file server that stops itself after a period of inactivity.

`run.py` serves the production build with this rather than `vite preview`, because knowing whether
the site is still being used needs a request to be observable. The page sends a heartbeat every few
seconds, so an open tab keeps the server alive; close the tab and the heartbeats stop, and the
server shuts itself down shortly after.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import sys
import threading
import time
from pathlib import Path

IDLE_SECONDS = 60
POLL_SECONDS = 5

# Make sure the types that matter are right, whatever the host's mimetypes
# database says. The WASM in particular has to be application/wasm or the
# browser will refuse to compile it.
EXTRA_TYPES = {
    ".wasm": "application/wasm",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
}


class ActivityHandler(http.server.SimpleHTTPRequestHandler):
    """Serves files and records every request as activity."""

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **EXTRA_TYPES}

    def _record(self) -> None:
        self.server.last_activity = time.time()

    def do_GET(self) -> None:
        self._record()
        super().do_GET()

    def do_HEAD(self) -> None:
        self._record()
        super().do_HEAD()

    def end_headers(self) -> None:
        # A build is a fixed set of files, but the point of this server is to
        # show the latest one, so nothing is cached.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        pass


class ActivityServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address: tuple[str, int], directory: Path) -> None:
        handler = functools.partial(ActivityHandler, directory=str(directory))
        super().__init__(address, handler)
        self.last_activity = time.time()

    def serve_until_idle(self, idle_seconds: int = IDLE_SECONDS, poll_seconds: int = POLL_SECONDS) -> None:
        monitor = threading.Thread(
            target=self._watch_for_idle,
            args=(idle_seconds, poll_seconds),
            daemon=True,
        )
        monitor.start()
        try:
            self.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            self.server_close()

    def _watch_for_idle(self, idle_seconds: int, poll_seconds: int) -> None:
        while True:
            time.sleep(poll_seconds)
            idle = time.time() - self.last_activity
            if idle >= idle_seconds:
                print(f"\nNo activity for {idle_seconds}s. Stopping the server.", flush=True)
                self.shutdown()
                return


def serve(directory: Path, host: str, port: int, idle_seconds: int = IDLE_SECONDS) -> None:
    with ActivityServer((host, port), directory) as server:
        print(f"Serving {directory} at http://{host}:{port}/", flush=True)
        print(f"Stops after {idle_seconds}s with no activity.", flush=True)
        server.serve_until_idle(idle_seconds)


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the built app and stop when it is idle.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--idle", type=int, default=IDLE_SECONDS, metavar="SECONDS")
    parser.add_argument(
        "--directory",
        type=Path,
        default=Path(__file__).resolve().parent / "dist",
    )
    args = parser.parse_args()

    if not (args.directory / "index.html").exists():
        print(f"{args.directory} has no index.html. Run the build first.", file=sys.stderr)
        return 1

    serve(args.directory, args.host, args.port, args.idle)
    return 0


if __name__ == "__main__":
    sys.exit(main())
