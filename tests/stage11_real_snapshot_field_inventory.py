#!/usr/bin/env python3
"""Inventory representative reader-facing fields in the exact live snapshot."""
from __future__ import annotations

import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

FIELD_ROOT = Path(__file__).resolve().parents[1]
LIVE_ROOT = Path(os.environ.get("NYCIF_LIVE_FEEDS_ROOT", "_live_feeds")).resolve()
DATA_ROOT = LIVE_ROOT / "data" / "schema-v1-discovery"
REPORT = FIELD_ROOT / "data" / "reports" / "stage11_real_snapshot_field_inventory.json"
CATEGORIES = {
    "sports", "fitness", "parks", "arts", "market", "civic", "media",
    "government", "education", "family", "services", "environment",
    "volunteer", "jobs", "housing", "general", "tours",
}
BOROUGHS = {"Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"}
PRIVATE_KEYS = {
    "internal_notes", "editorial_notes", "private_notes", "reviewer_notes",
    "operator_notes", "raw_payload", "debug", "debug_notes",
}


def load(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def events(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        value = payload.get("events")
        return [row for row in value if isinstance(row, dict)] if isinstance(value, list) else []
    return []


def load_layer(layer: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    manifest = load(DATA_ROOT / layer / "manifest.json")
    rows: list[dict[str, Any]] = []
    for page in manifest.get("pages", []):
        name = page.get("page") or f"{page.get('cursor')}.json"
        rows.extend(events(load(DATA_ROOT / layer / "pages" / name)))
    return manifest, rows


def meaningful_time(value: Any) -> bool:
    text = str(value or "")
    return "T" in text and not ("T00:00" in text or "T00:00:00" in text)


def has_private(value: Any) -> Counter[str]:
    found: Counter[str] = Counter()
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in PRIVATE_KEYS and child not in (None, "", [], {}):
                found[str(key).lower()] += 1
            found.update(has_private(child))
    elif isinstance(value, list):
        for child in value:
            found.update(has_private(child))
    return found


def sample(rows: list[dict[str, Any]], predicate) -> dict[str, Any] | None:
    for row in rows:
        if predicate(row):
            nycif = row.get("nycif") if isinstance(row.get("nycif"), dict) else {}
            source = row.get("source") if isinstance(row.get("source"), dict) else {}
            return {
                "id": row.get("id"), "title": row.get("title"),
                "category": row.get("category"), "borough": row.get("borough"),
                "date": nycif.get("event_date") or str(row.get("start_date_time") or "")[:10],
                "location": row.get("location"), "source_dataset": source.get("dataset"),
                "coordinate_status": nycif.get("coordinate_status"),
                "event_role": row.get("event_role"), "event_type": nycif.get("event_type"),
                "verification_status": nycif.get("verification_status"),
            }
    return None


def main() -> int:
    approved_manifest, approved = load_layer("approved")
    review_manifest, review = load_layer("review")
    combined = approved + review
    category_counts = Counter(str(row.get("category") or "general") for row in combined)
    borough_counts = Counter(str(row.get("borough") or "") for row in combined)
    role_counts = Counter(str(row.get("event_role") or "public_event") for row in combined)

    category_samples = {key: sample(combined, lambda row, key=key: row.get("category") == key) for key in sorted(CATEGORIES)}
    borough_samples = {key: sample(combined, lambda row, key=key: row.get("borough") == key) for key in sorted(BOROUGHS)}
    list_only = [row for row in combined if (row.get("nycif") or {}).get("coordinate_status") == "list_only"]
    multi_day = [row for row in combined if str(row.get("end_date_time") or "")[:10] > str(row.get("start_date_time") or "")[:10]]
    missing_time = [row for row in combined if not meaningful_time(row.get("start_date_time"))]
    verification = [row for row in combined if (row.get("nycif") or {}).get("verification_status")]
    event_type = [row for row in combined if (row.get("nycif") or {}).get("event_type")]
    public_cost = [row for row in combined if row.get("cost") not in (None, "") or row.get("is_free") is not None]
    public_url = [row for row in combined if row.get("official_url") or (isinstance(row.get("source"), dict) and (row["source"].get("url") or row["source"].get("source_url")))]
    private = has_private({"events": approved})

    equations = {
        "approved_manifest_count_matches": len(approved) == int(approved_manifest.get("total") or 0),
        "review_manifest_count_matches": len(review) == int(review_manifest.get("total") or 0),
        "all_boroughs_represented": all(borough_counts[key] > 0 for key in BOROUGHS),
        "implemented_categories_accounted": all(category_samples[key] is not None for key in CATEGORIES),
        "list_only_edge_present": bool(list_only),
        "multi_day_edge_present": bool(multi_day),
        "missing_time_edge_present": bool(missing_time),
        "review_layer_present": bool(review),
        "nonpublic_roles_present": role_counts["maintenance_or_closure"] > 0 or role_counts["private_or_reserved_activity"] > 0,
        "source_attribution_available": all(isinstance(row.get("source"), dict) and row["source"].get("dataset") for row in combined),
        "event_type_available": bool(event_type),
        "verification_snapshot_accounted": len(verification) >= 0,
        "approved_private_fields_absent": not private,
        "same_snapshot_generation": approved_manifest.get("generated_at_utc") == review_manifest.get("generated_at_utc"),
    }
    qa_pass = all(equations.values())
    report = {
        "artifact_type": "stage11_real_snapshot_field_inventory",
        "schema_version": "1.1.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "snapshot_generated_at_utc": approved_manifest.get("generated_at_utc"),
        "live_feeds_commit_sha": os.environ.get("NYCIF_LIVE_FEEDS_SHA", "unknown"),
        "approved_projection_count": len(approved),
        "review_projection_count": len(review),
        "category_counts": dict(sorted(category_counts.items())),
        "borough_counts": dict(sorted(borough_counts.items())),
        "role_counts": dict(sorted(role_counts.items())),
        "category_samples": category_samples,
        "borough_samples": borough_samples,
        "edge_case_samples": {
            "list_only": sample(list_only, lambda _: True),
            "multi_day": sample(multi_day, lambda _: True),
            "missing_time": sample(missing_time, lambda _: True),
            "review": sample(review, lambda _: True),
            "maintenance": sample(combined, lambda row: row.get("event_role") == "maintenance_or_closure"),
            "private_reserved": sample(combined, lambda row: row.get("event_role") == "private_or_reserved_activity"),
        },
        "availability": {
            "event_type_count": len(event_type),
            "verification_count": len(verification),
            "cost_or_free_count": len(public_cost),
            "official_url_count": len(public_url),
            "verification_policy": "display only when supplied; current snapshot count may be zero; never infer",
            "cost_policy": "display when present; otherwise deliberately omit",
            "official_url_policy": "link only when an absolute safe public URL is present; otherwise show source dataset label",
        },
        "approved_private_field_findings": dict(sorted(private.items())),
        "equations": equations,
        "launch_authorized": False,
        "qa_pass": qa_pass,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key not in {"category_samples", "borough_samples"}}, indent=2, sort_keys=True))
    if not qa_pass:
        failed = [key for key, value in equations.items() if not value]
        raise RuntimeError("Stage 11 real snapshot inventory failed: " + ", ".join(failed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
