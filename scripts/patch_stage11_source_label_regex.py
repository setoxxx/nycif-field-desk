#!/usr/bin/env python3
"""Replace accidental backspace regexes with JavaScript word boundaries."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app-schema-v1-major-all-v01.js"


def main() -> int:
    text = APP.read_text(encoding="utf-8")
    good = ".replace(/\\b\\w/g, letter => letter.toUpperCase())"
    bad = ".replace(/\x08\\w/g, letter => letter.toUpperCase())"
    malformed = text.count(bad)
    if malformed == 0:
        if good in text:
            print("Stage 11 title-casing regexes already corrected")
            return 0
        raise RuntimeError("Stage 11 title-casing regex was not found")
    APP.write_text(text.replace(bad, good), encoding="utf-8")
    print(f"Stage 11 title-casing regexes corrected: {malformed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
