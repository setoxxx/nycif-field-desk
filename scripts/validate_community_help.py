#!/usr/bin/env python3
"""Fail-closed validation for the public NYCIF Community Help directory."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "community-help"
LOCATION_CATEGORIES = ("benefits", "food", "health", "jobs", "naloxone", "shelter", "youth")
ALLOWED_BOROUGHS = {"Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"}
REQUIRED_LOCATION_FIELDS = {
    "id", "title", "category", "address", "borough", "services",
    "source_url", "last_verified",
}


def load(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def valid_https(value: object) -> bool:
    try:
        parsed = urlparse(str(value or ""))
    except ValueError:
        return False
    return parsed.scheme == "https" and bool(parsed.netloc)


def validate() -> dict[str, object]:
    errors: list[str] = []
    ids: set[str] = set()
    semantic_keys: set[tuple[str, str, str]] = set()
    category_counts: Counter[str] = Counter()

    for category in LOCATION_CATEGORIES:
        path = DATA / f"{category}.json"
        if not path.exists():
            errors.append(f"missing category file: {path.relative_to(ROOT)}")
            continue
        payload = load(path)
        if payload.get("schema_version") != "1.0.0":
            errors.append(f"{category}: unsupported schema_version")
        if payload.get("category") != category:
            errors.append(f"{category}: payload category mismatch")
        rows = payload.get("locations")
        if not isinstance(rows, list) or not rows:
            errors.append(f"{category}: locations must be a non-empty list")
            continue

        for index, row in enumerate(rows):
            prefix = f"{category}[{index}]"
            if not isinstance(row, dict):
                errors.append(f"{prefix}: row must be an object")
                continue
            missing = sorted(field for field in REQUIRED_LOCATION_FIELDS if field not in row)
            if missing:
                errors.append(f"{prefix}: missing fields {missing}")
                continue
            row_id = str(row.get("id") or "").strip()
            if not row_id:
                errors.append(f"{prefix}: blank id")
            elif row_id in ids:
                errors.append(f"duplicate id: {row_id}")
            ids.add(row_id)

            if row.get("category") != category:
                errors.append(f"{prefix}: row category mismatch")
            if row.get("borough") not in ALLOWED_BOROUGHS:
                errors.append(f"{prefix}: invalid borough {row.get('borough')!r}")
            if not str(row.get("title") or "").strip():
                errors.append(f"{prefix}: blank title")
            if not str(row.get("address") or "").strip():
                errors.append(f"{prefix}: blank public address")
            services = row.get("services")
            if not isinstance(services, list) or not any(str(item).strip() for item in services):
                errors.append(f"{prefix}: services must be a non-empty list")
            if not valid_https(row.get("source_url")):
                errors.append(f"{prefix}: source_url must be HTTPS")
            if not str(row.get("last_verified") or "").startswith("2026-"):
                errors.append(f"{prefix}: last_verified is missing or malformed")

            semantic_key = (
                category,
                str(row.get("title") or "").strip().casefold(),
                str(row.get("address") or "").strip().casefold(),
            )
            if semantic_key in semantic_keys:
                errors.append(f"duplicate semantic location: {semantic_key}")
            semantic_keys.add(semantic_key)
            category_counts[category] += 1

    links_path = DATA / "links.json"
    if not links_path.exists():
        errors.append("missing data/community-help/links.json")
        links = []
    else:
        link_payload = load(links_path)
        links = link_payload.get("directory_links")
        if not isinstance(links, list) or not links:
            errors.append("links.json: directory_links must be a non-empty list")
            links = []
        link_ids: set[str] = set()
        for index, link in enumerate(links):
            prefix = f"links[{index}]"
            if not isinstance(link, dict):
                errors.append(f"{prefix}: link must be an object")
                continue
            link_id = str(link.get("id") or "").strip()
            if not link_id:
                errors.append(f"{prefix}: blank id")
            elif link_id in link_ids:
                errors.append(f"duplicate directory link id: {link_id}")
            link_ids.add(link_id)
            if not str(link.get("title") or "").strip():
                errors.append(f"{prefix}: blank title")
            if not valid_https(link.get("url")):
                errors.append(f"{prefix}: url must be HTTPS")
            if not str(link.get("category") or "").strip():
                errors.append(f"{prefix}: blank category")

    if sum(category_counts.values()) < 70:
        errors.append(f"expected at least 70 public locations; found {sum(category_counts.values())}")
    required_link_categories = {"benefits", "food", "health", "legal", "naloxone", "shelter", "tax"}
    link_categories = {str(link.get("category") or "") for link in links if isinstance(link, dict)}
    missing_link_categories = sorted(required_link_categories - link_categories)
    if missing_link_categories:
        errors.append(f"missing official locator categories: {missing_link_categories}")

    return {
        "qa_pass": not errors,
        "location_count": sum(category_counts.values()),
        "category_counts": dict(sorted(category_counts.items())),
        "directory_link_count": len(links),
        "duplicate_id_count": 0 if not any(item.startswith("duplicate id:") for item in errors) else 1,
        "errors": errors,
    }


def main() -> int:
    report = validate()
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["qa_pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
