#!/usr/bin/env python3
"""Build the Field Desk retirement-only GitHub Pages artifact.

This intentionally publishes no Field Desk application, admin, preview, test,
feed, or operator surface. Source remains in Git; the Pages artifact contains
only the canonical redirect and cache-retirement service worker.

The output location is deliberately fixed beneath GitHub Actions RUNNER_TEMP.
The builder accepts no caller-controlled filesystem path and fails closed if the
expected output directory already exists or any relevant path is symlinked.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIRECTORY_NAME = "field-desk-pages"


def _validated_runner_temp() -> Path:
    raw = os.environ.get("RUNNER_TEMP")
    if not raw:
        raise SystemExit("RUNNER_TEMP is required for retirement artifact construction")

    candidate = Path(raw)
    if not candidate.is_absolute():
        raise SystemExit("RUNNER_TEMP must be an absolute path")
    if candidate.is_symlink() or not candidate.is_dir():
        raise SystemExit("RUNNER_TEMP must be an existing non-symlink directory")

    return candidate.resolve(strict=True)


def _validated_output_directory(runner_temp: Path) -> Path:
    output = runner_temp / OUTPUT_DIRECTORY_NAME
    if output.is_symlink():
        raise SystemExit("retirement artifact output must not be a symlink")
    if output.exists():
        raise SystemExit("retirement artifact output must not already exist")
    if output.parent.resolve(strict=True) != runner_temp:
        raise SystemExit("retirement artifact output escaped RUNNER_TEMP")
    return output


def build() -> Path:
    runner_temp = _validated_runner_temp()
    output = _validated_output_directory(runner_temp)
    output.mkdir(mode=0o700)

    for name in ("index.html", "service-worker.js"):
        source = ROOT / name
        if source.is_symlink() or not source.is_file() or source.stat().st_size == 0:
            raise SystemExit(f"missing or unsafe required retirement surface: {name}")
        shutil.copy2(source, output / name)

    (output / ".nojekyll").touch(mode=0o600)

    allowed = {"index.html", "service-worker.js", ".nojekyll"}
    actual = {path.relative_to(output).as_posix() for path in output.rglob("*") if path.is_file()}
    if actual != allowed:
        raise SystemExit(f"unexpected Pages artifact files: {sorted(actual - allowed)}")

    for forbidden in (
        "admin",
        "approved-export-preview.html",
        "desk.html",
        "live-alerts.html",
        "live-qa-standalone.html",
        "mobile.html",
        "nightlife-preview.html",
        "preview-major-feed-review.html",
        "prototype-major-events-review.html",
        "public.html",
        "special-overlays-test.html",
        "web.html",
    ):
        if (output / forbidden).exists():
            raise SystemExit(f"legacy route leaked into Pages artifact: {forbidden}")

    print("FIELD_DESK_RETIREMENT_ONLY_PAGES_ARTIFACT_PASS")
    print("\n".join(sorted(actual)))
    return output


if __name__ == "__main__":
    build()
