#!/usr/bin/env python3
"""Enable canonical-ID difference reporting in the Stage 10 browser audit."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "tests" / "same-snapshot-feed-browser-parity.mjs"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def main() -> int:
    text = TEST.read_text(encoding="utf-8")
    if "expected_only_visible_ids" in text and "auditParity=1" in text:
        print("Stage 10 ID differences already enabled")
        return 0
    text = replace_once(
        text,
        "http://127.0.0.1:4173/index.html?resetFilters=1",
        "http://127.0.0.1:4173/index.html?resetFilters=1&auditParity=1",
        "audit URL",
    )
    text = replace_once(
        text,
        """  const mapEligibleEvents = visibleEvents.filter(markerEligible);
  const listDomCount""",
        """  const mapEligibleEvents = visibleEvents.filter(markerEligible);
  const expectedVisibleIds = new Set(visibleEvents.map(event => event.id));
  const expectedMapIds = new Set(mapEligibleEvents.map(event => event.id));
  const actualVisibleIds = new Set(actual.visibleIds || []);
  const actualMapIds = new Set(actual.mapEligibleVisibleIds || []);
  const expectedOnlyVisibleIds = [...expectedVisibleIds].filter(id => !actualVisibleIds.has(id)).sort();
  const actualOnlyVisibleIds = [...actualVisibleIds].filter(id => !expectedVisibleIds.has(id)).sort();
  const expectedOnlyMapIds = [...expectedMapIds].filter(id => !actualMapIds.has(id)).sort();
  const actualOnlyMapIds = [...actualMapIds].filter(id => !expectedMapIds.has(id)).sort();
  const listDomCount""",
        "ID set differences",
    )
    text = replace_once(
        text,
        """    actual,
    list_dom_count:""",
        """    actual,
    differences: {
      expected_only_visible_ids: expectedOnlyVisibleIds,
      actual_only_visible_ids: actualOnlyVisibleIds,
      expected_only_map_ids: expectedOnlyMapIds,
      actual_only_map_ids: actualOnlyMapIds
    },
    list_dom_count:""",
        "difference report",
    )
    TEST.write_text(text, encoding="utf-8")
    print("Stage 10 canonical ID difference reporting enabled")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
