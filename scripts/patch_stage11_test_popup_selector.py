#!/usr/bin/env python3
"""Correct the Stage 11 fixture to select the dialog inside Leaflet's wrapper."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "tests" / "stage11-public-display-fields.mjs"


def main() -> int:
    text = TEST.read_text(encoding="utf-8")
    old = ".leaflet-popup-content[role=\"dialog\"]"
    new = ".leaflet-popup-content [role=\"dialog\"]"
    if new in text:
        print("Stage 11 popup selector already corrected")
        return 0
    if text.count(old) != 1:
        raise RuntimeError(f"expected one Stage 11 popup selector, found {text.count(old)}")
    TEST.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("Stage 11 popup selector corrected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
