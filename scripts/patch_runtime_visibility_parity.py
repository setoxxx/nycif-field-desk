#!/usr/bin/env python3
"""Apply the approved fail-closed runtime visibility parity repair.

Every replacement must match exactly once. The cluster-default block uses a
narrowly anchored regex only to tolerate harmless whitespace or quote drift.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app-schema-v1-major-all-v01.js"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source match, found {count}")
    return text.replace(old, new, 1)


def replace_regex(text: str, pattern: str, new: str, label: str) -> str:
    matches = list(re.finditer(pattern, text, flags=re.MULTILINE))
    if len(matches) != 1:
        raise SystemExit(f"{label}: expected exactly one regex source match, found {len(matches)}")
    return re.sub(pattern, lambda _match: new, text, count=1, flags=re.MULTILINE)


def main() -> int:
    original = APP.read_text(encoding="utf-8")
    updated = original

    updated = replace_regex(
        updated,
        r"^  const clusterEnabled = \(\(\) => \{\r?\n"
        r"    try \{\r?\n"
        r"      return new URL\(location\.href\)\.searchParams\.get\((['\"])clusters\1\) === (['\"])1\2;\r?\n"
        r"    \} catch \{\r?\n"
        r"      return false;\r?\n"
        r"    \}\r?\n"
        r"  \}\)\(\);$",
        """  const clusterEnabled = (() => {
    try {
      // Clustering is the production default so every map-eligible event can be
      // represented without dropping lower-priority neighborhood events. The
      // explicit ?clusters=0 escape hatch remains available for diagnostics.
      return new URL(location.href).searchParams.get('clusters') !== '0';
    } catch {
      return true;
    }
  })();""",
        "cluster default",
    )

    updated = replace_exact(
        updated,
        """    markerObjects: 0,
    peakMarkerObjects: 0,""",
        """    markerObjects: 0,
    markerEvents: 0,
    peakMarkerObjects: 0,""",
        "marker event state",
    )

    updated = replace_exact(
        updated,
        """    const mapReady = visible.filter(e => markerEligible(e));
    const bounds = expandedBounds();
    const inView = bounds ? mapReady.filter(e => bounds.contains([e.lat, e.lng])) : mapReady;
    const candidates = (inView.length ? inView : mapReady).slice(0, MARKER_SOFT_CAP);""",
        """    const mapReady = visible.filter(e => markerEligible(e));
    const bounds = expandedBounds();
    const inView = bounds ? mapReady.filter(e => bounds.contains([e.lat, e.lng])) : mapReady;
    const eligibleInScope = inView.length ? inView : mapReady;
    // With clustering available, represent every eligible event in scope. The
    // legacy soft cap is retained only for the explicit no-cluster diagnostic
    // mode, where rendering thousands of independent DOM markers is unsafe.
    const candidates = useCluster
      ? eligibleInScope
      : eligibleInScope.slice(0, MARKER_SOFT_CAP);""",
        "marker candidate allocation",
    )

    updated = replace_exact(
        updated,
        """    state.markerObjects = batch.length;
    state.peakMarkerObjects = Math.max(state.peakMarkerObjects, batch.length);""",
        """    state.markerObjects = batch.length;
    state.markerEvents = candidates.length;
    state.peakMarkerObjects = Math.max(state.peakMarkerObjects, batch.length);""",
        "marker event accounting",
    )

    updated = replace_exact(
        updated,
        """    if (drawn.length < mapEligibleCount) {
      meta += ' · move or zoom the map to see more pins';
    }""",
        """    if (state.markerEvents < mapEligibleCount) {
      meta += ' · move or zoom the map to see more pins';
    }""",
        "list metadata parity message",
    )

    updated = replace_exact(
        updated,
        """        markers: drawn.length,
        peakMarkerObjects: state.peakMarkerObjects,""",
        """        markers: drawn.length,
        markerEvents: state.markerEvents,
        mapEligibleVisible: mapEligibleCount,
        markerParityComplete: state.markerEvents >= mapEligibleCount,
        peakMarkerObjects: state.peakMarkerObjects,""",
        "debug parity fields",
    )

    updated = replace_exact(
        updated,
        """        markerObjects: state.markerObjects,
        peakMarkerObjects: state.peakMarkerObjects,""",
        """        markerObjects: state.markerObjects,
        markerEvents: state.markerEvents,
        visible: state.events.filter(eventMatches).length,
        mapEligibleVisible: state.events.filter(e => eventMatches(e) && markerEligible(e)).length,
        markerParityComplete: state.markerEvents >= state.events.filter(e => eventMatches(e) && markerEligible(e)).length,
        peakMarkerObjects: state.peakMarkerObjects,""",
        "public viewer parity fields",
    )

    if updated == original:
        raise SystemExit("runtime visibility patch produced no changes")
    APP.write_text(updated, encoding="utf-8")
    print("runtime visibility parity patch applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
