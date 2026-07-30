#!/usr/bin/env python3
"""Match the independent Stage 10 model to the public disposition contract."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "tests" / "same-snapshot-feed-browser-parity.mjs"


def main() -> int:
    text = TEST.read_text(encoding="utf-8")
    old = """function sourceVisible(event) {
  const role = roleOf(event);
  if (role === 'maintenance_or_closure') return false;
  if (role === 'public_event') return true;
  return categoryOf(event) === 'media' && (role === 'street_closure' || role === 'supporting_permit');
}"""
    new = """function sourceVisible(event) {
  const nycif = event.nycif && typeof event.nycif === 'object' ? event.nycif : {};
  if (nycif.display_disposition === 'list_only') return false;
  const role = roleOf(event);
  if (role === 'maintenance_or_closure') return false;
  if (role === 'public_event') return true;
  return categoryOf(event) === 'media' && (role === 'street_closure' || role === 'supporting_permit');
}"""
    if new in text:
        print("Stage 10 display-disposition expectation already installed")
        return 0
    if text.count(old) != 1:
        raise RuntimeError(f"expected one Stage 10 sourceVisible block, found {text.count(old)}")
    TEST.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("Stage 10 display-disposition expectation installed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
