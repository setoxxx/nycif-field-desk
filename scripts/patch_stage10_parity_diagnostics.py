#!/usr/bin/env python3
"""Expose filtered canonical IDs only when the explicit auditParity=1 flag is set."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app-schema-v1-major-all-v01.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def main() -> int:
    text = APP.read_text(encoding="utf-8")
    if "parityAuditEnabled" in text and "mapEligibleVisibleIds" in text:
        print("Stage 10 parity diagnostics already installed")
        return 0
    text = replace_once(
        text,
        """    window.NYCIF_UNIFIED_VIEWER = {
      version: VERSION,""",
        """    const parityAuditEnabled = (() => {
      try {
        return new URL(location.href).searchParams.get('auditParity') === '1';
      } catch {
        return false;
      }
    })();
    window.NYCIF_UNIFIED_VIEWER = {
      version: VERSION,""",
        "audit flag",
    )
    text = replace_once(
        text,
        """        visible: state.events.filter(eventMatches).length,
        mapEligibleVisible: state.events.filter(e => eventMatches(e) && markerEligible(e)).length,
        markerParityComplete:""",
        """        visible: state.events.filter(eventMatches).length,
        mapEligibleVisible: state.events.filter(e => eventMatches(e) && markerEligible(e)).length,
        ...(parityAuditEnabled ? {
          visibleIds: state.events.filter(eventMatches).map(e => e.id).sort(),
          mapEligibleVisibleIds: state.events.filter(e => eventMatches(e) && markerEligible(e)).map(e => e.id).sort()
        } : {}),
        markerParityComplete:""",
        "parity ID snapshot",
    )
    APP.write_text(text, encoding="utf-8")
    print("Stage 10 opt-in parity diagnostics installed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
