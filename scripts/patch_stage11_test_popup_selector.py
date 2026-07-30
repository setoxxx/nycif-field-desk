#!/usr/bin/env python3
"""Correct the Stage 11 popup selector unless the detail-hook fixture superseded it."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "tests" / "stage11-public-display-fields.mjs"


def main() -> int:
    text = TEST.read_text(encoding="utf-8")
    if "NYCIF_DISPLAY_AUDIT" in text and "#nycif-display-audit-host .popup-card" in text:
        print("Stage 11 popup selector superseded by deterministic detail hook")
        return 0
    candidates = (
        '.leaflet-popup-content[role="dialog"]',
        '.leaflet-popup-content [role="dialog"]',
    )
    new = '.leaflet-popup-content'
    if new in text and all(old not in text for old in candidates):
        print("Stage 11 popup selector already corrected")
        return 0
    matches = [old for old in candidates if old in text]
    if len(matches) != 1:
        raise RuntimeError(f"expected one Stage 11 popup selector variant, found {matches}")
    TEST.write_text(text.replace(matches[0], new, 1), encoding="utf-8")
    print("Stage 11 popup selector corrected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
