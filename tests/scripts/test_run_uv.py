from __future__ import annotations

import importlib.util
import os
from pathlib import Path


def load_run_uv_module():
    script_path = Path(__file__).resolve().parents[2] / "scripts" / "run_uv.py"
    spec = importlib.util.spec_from_file_location("run_uv", script_path)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_run_uv_forwards_arguments_environment_and_exit_code(monkeypatch) -> None:
    module = load_run_uv_module()
    calls: list[tuple[list[str], Path, dict[str, str]]] = []

    def fake_call(command: list[str], cwd: Path, env: dict[str, str]) -> int:
        calls.append((command, cwd, env))
        return 17

    monkeypatch.setattr(module.subprocess, "call", fake_call)
    monkeypatch.setattr(module.sys, "argv", ["run_uv.py", "run", "pytest"])

    assert module.main() == 17
    assert len(calls) == 1

    command, cwd, env = calls[0]
    assert command[-3:] == ["uv", "run", "pytest"]
    assert cwd == Path(__file__).resolve().parents[2]
    assert env["UV_CACHE_DIR"] == os.fspath(cwd / ".uv-cache")
