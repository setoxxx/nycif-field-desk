#!/usr/bin/env python3
"""Apply the approved fail-closed runtime visibility parity repair.

This script performs exact source replacements only. It exits without writing if
any expected production snippet has drifted, preventing a broad or ambiguous edit.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app-schema-v1-major-all-v01.js"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source match, found {count}")
    return text.replace(old, new, 1)


def main() -> int:
    original = APP.read_text(encoding="utf-8")
    updated = original

    updated = replace_exact(
        updated,
        """  const clusterEnabled = (() => {\n    try {\n      return new URL(location.href).searchParams.get('clusters') === '1';\n    } catch {\n      return false;\n    }\n  })();""",
        """  const clusterEnabled = (() => {\n    try {\n      // Clustering is the production default so every map-eligible event can be\n      // represented without dropping lower-priority neighborhood events. The\n      // explicit ?clusters=0 escape hatch remains available for diagnostics.\n      return new URL(location.href).searchParams.get('clusters') !== '0';\n    } catch {\n      return true;\n    }\n  })();""",
        "cluster default",
    )

    updated = replace_exact(
        updated,
        """    markerObjects: 0,\n    peakMarkerObjects: 0,""",
        """    markerObjects: 0,\n    markerEvents: 0,\n    peakMarkerObjects: 0,""",
        "marker event state",
    )

    updated = replace_exact(
        updated,
        """    const mapReady = visible.filter(e => markerEligible(e));\n    const bounds = expandedBounds();\n    const inView = bounds ? mapReady.filter(e => bounds.contains([e.lat, e.lng])) : mapReady;\n    const candidates = (inView.length ? inView : mapReady).slice(0, MARKER_SOFT_CAP);""",
        """    const mapReady = visible.filter(e => markerEligible(e));\n    const bounds = expandedBounds();\n    const inView = bounds ? mapReady.filter(e => bounds.contains([e.lat, e.lng])) : mapReady;\n    const eligibleInScope = inView.length ? inView : mapReady;\n    // With clustering available, represent every eligible event in scope. The\n    // legacy soft cap is retained only for the explicit no-cluster diagnostic\n    // mode, where rendering thousands of independent DOM markers is unsafe.\n    const candidates = useCluster\n      ? eligibleInScope\n      : eligibleInScope.slice(0, MARKER_SOFT_CAP);""",
        "marker candidate allocation",
    )

    updated = replace_exact(
        updated,
        """    state.markerObjects = batch.length;\n    state.peakMarkerObjects = Math.max(state.peakMarkerObjects, batch.length);""",
        """    state.markerObjects = batch.length;\n    state.markerEvents = candidates.length;\n    state.peakMarkerObjects = Math.max(state.peakMarkerObjects, batch.length);""",
        "marker event accounting",
    )

    updated = replace_exact(
        updated,
        """    if (drawn.length < mapEligibleCount) {\n      meta += ' · move or zoom the map to see more pins';\n    }""",
        """    if (state.markerEvents < mapEligibleCount) {\n      meta += ' · move or zoom the map to see more pins';\n    }""",
        "list metadata parity message",
    )

    updated = replace_exact(
        updated,
        """        markers: drawn.length,\n        peakMarkerObjects: state.peakMarkerObjects,""",
        """        markers: drawn.length,\n        markerEvents: state.markerEvents,\n        mapEligibleVisible: mapEligibleCount,\n        markerParityComplete: state.markerEvents >= mapEligibleCount,\n        peakMarkerObjects: state.peakMarkerObjects,""",
        "debug parity fields",
    )

    updated = replace_exact(
        updated,
        """        markerObjects: state.markerObjects,\n        peakMarkerObjects: state.peakMarkerObjects,""",
        """        markerObjects: state.markerObjects,\n        markerEvents: state.markerEvents,\n        visible: state.events.filter(eventMatches).length,\n        mapEligibleVisible: state.events.filter(e => eventMatches(e) && markerEligible(e)).length,\n        markerParityComplete: state.markerEvents >= state.events.filter(e => eventMatches(e) && markerEligible(e)).length,\n        peakMarkerObjects: state.peakMarkerObjects,""",
        "public viewer parity fields",
    )

    if updated == original:
        raise SystemExit("runtime visibility patch produced no changes")
    APP.write_text(updated, encoding="utf-8")
    print("runtime visibility parity patch applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
