#!/usr/bin/env python3
"""Enable canonical-ID and mismatched-record reporting in the Stage 10 audit."""
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
    if "expected_only_visible_records" in text and "auditParity=1" in text:
        print("Stage 10 record differences already enabled")
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
  const auditRecord = id => {
    const event = ingestedById.get(id) || {};
    const nycif = event.nycif && typeof event.nycif === 'object' ? event.nycif : {};
    const source = event.source && typeof event.source === 'object' ? event.source : {};
    return {
      id,
      title: event.title || null,
      start_date_time: event.start_date_time || null,
      end_date_time: event.end_date_time || null,
      category: event.category || null,
      event_role: event.event_role || null,
      parent_event_id: event.parent_event_id || null,
      borough: event.borough || null,
      latitude: event.latitude ?? event.lat ?? null,
      longitude: event.longitude ?? event.lng ?? null,
      source_dataset: source.dataset || null,
      source_event_id: source.source_event_id || null,
      coordinate_status: nycif.coordinate_status || null,
      display_disposition: nycif.display_disposition || null,
      event_date: nycif.event_date || null,
      data_layer: nycif.data_layer || null,
      status: event.status || event.event_status || nycif.lifecycle_status || null
    };
  };
  const listDomCount""",
        "ID and field differences",
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
      actual_only_map_ids: actualOnlyMapIds,
      expected_only_visible_records: expectedOnlyVisibleIds.map(auditRecord),
      actual_only_visible_records: actualOnlyVisibleIds.map(auditRecord),
      expected_only_map_records: expectedOnlyMapIds.map(auditRecord),
      actual_only_map_records: actualOnlyMapIds.map(auditRecord)
    },
    list_dom_count:""",
        "difference report",
    )
    TEST.write_text(text, encoding="utf-8")
    print("Stage 10 canonical ID and field difference reporting enabled")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
