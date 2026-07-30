#!/usr/bin/env python3
"""Replace the accidental backspace regex with a JavaScript word boundary."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app-schema-v1-major-all-v01.js"


def main() -> int:
    text = APP.read_text(encoding="utf-8")
    good = ".replace(/\\b\\w/g, letter => letter.toUpperCase())"
    bad = ".replace(/\x08\\w/g, letter => letter.toUpperCase())"
    if good in text:
        print("Stage 11 source-label regex already corrected")
        return 0
    if text.count(bad) != 1:
        raise RuntimeError(f"expected one malformed Stage 11 source-label regex, found {text.count(bad)}")
    APP.write_text(text.replace(bad, good, 1), encoding="utf-8")
    print("Stage 11 source-label title casing corrected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
