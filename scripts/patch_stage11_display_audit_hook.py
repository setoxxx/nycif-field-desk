#!/usr/bin/env python3
"""Expose the production popup component only under auditDisplay=1."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app-schema-v1-major-all-v01.js"


def main() -> int:
    text = APP.read_text(encoding="utf-8")
    if "NYCIF_DISPLAY_AUDIT" in text and "nycif-display-audit-host" in text:
        print("Stage 11 display audit hook already installed")
        return 0
    anchor = """    return root;
  }

  function makeStackMarker(events) {"""
    replacement = """    return root;
  }

  const displayAuditEnabled = (() => {
    try {
      return new URL(location.href).searchParams.get('auditDisplay') === '1';
    } catch {
      return false;
    }
  })();

  if (displayAuditEnabled) {
    window.NYCIF_DISPLAY_AUDIT = {
      renderDetail(id) {
        const event = state.byId.get(String(id || ''));
        if (!event) return false;
        let host = document.getElementById('nycif-display-audit-host');
        if (!host) {
          host = document.createElement('section');
          host.id = 'nycif-display-audit-host';
          host.setAttribute('aria-label', 'Display audit detail');
          document.body.appendChild(host);
        }
        clearChildren(host);
        host.appendChild(popupRoot(event));
        return true;
      }
    };
  }

  function makeStackMarker(events) {"""
    if text.count(anchor) != 1:
        raise RuntimeError(f"expected one Stage 11 popupRoot anchor, found {text.count(anchor)}")
    APP.write_text(text.replace(anchor, replacement, 1), encoding="utf-8")
    print("Stage 11 query-gated display audit hook installed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
