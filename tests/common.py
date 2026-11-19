"""Shared helpers for the Playwright tests.

- Serves the project folder on a local web server, because the game's
  scripts and voice MP3s do not load when it is opened straight from disk (file://).
- Drives Playwright's own Chromium by default. Set CHROME_PATH to use an
  installed Chrome instead.
- Uses software WebGL (SwiftShader) so results match on any machine. Set
  VELVET_GPU=1 to use the real GPU (faster, but screenshots may differ).
- three.js and the fonts live in the project (vendor/, fonts/), so the tests
  need no internet access.
"""
import functools
import http.server
import os
import pathlib
import socket
import threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "out"
OUT.mkdir(exist_ok=True)


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def _serve():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return port


PORT = _serve()
URL = f"http://127.0.0.1:{PORT}/index.html"


def shot(name):
    """Path for a screenshot. All screenshots go to tests/out/."""
    return str(OUT / name)


LAUNCH_ARGS = ["--autoplay-policy=no-user-gesture-required"]
if os.environ.get("VELVET_GPU") != "1":
    LAUNCH_ARGS += ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
else:  # without these, headless Chromium on Windows falls back to a very slow renderer
    LAUNCH_ARGS += ["--enable-gpu", "--ignore-gpu-blocklist"] + (["--use-angle=d3d11"] if os.name == "nt" else [])


async def launch(pw):
    chrome = os.environ.get("CHROME_PATH")
    if chrome:
        return await pw.chromium.launch(executable_path=chrome, args=LAUNCH_ARGS)
    return await pw.chromium.launch(args=LAUNCH_ARGS)


async def setup_routes(ctx):
    """Kept so older tests still run. three.js now ships in vendor/, so nothing needs rerouting."""
    return
