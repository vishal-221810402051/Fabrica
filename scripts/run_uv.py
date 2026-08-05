from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env.setdefault("UV_CACHE_DIR", str(root / ".uv-cache"))

    command = [sys.executable, "-m", "uv", *sys.argv[1:]]
    return subprocess.call(command, cwd=root, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
