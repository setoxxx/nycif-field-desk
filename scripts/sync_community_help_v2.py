#!/usr/bin/env python3
"""Build public Community Help location files from authoritative NYC datasets.

The sync is intentionally conservative: only datasets with public physical locations,
usable coordinates, and an official source URL are emitted as map-ready records.
Locator-only services remain in links.json and are never converted into guessed pins.
"""
from __future__ import annotations

import json
import math
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "community-help"
API = "https://data.cityofnewyork.us/resource"
TODAY = date.today().isoformat()
BOROUGHS = {
    "bronx": "Bronx",
    "brooklyn": "Brooklyn",
    "manhattan": "Manhattan",
    "new york": "Manhattan",
    "queens": "Queens",
    "staten island": "Staten Island",
}


def fetch(dataset_id: str, *, limit: int = 50000, where: str | None = None) -> list[dict[str, Any]]:
    params = {"$limit": str(limit)}
    if where:
        params["$where"] = where
    url = f"{API}/{dataset_id}.json?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "NYCInFocus-CommunityHelp/2.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.load(response)
    if not isinstance(payload, list):
        raise RuntimeError(f"{dataset_id}: expected list")
    return [row for row in payload if isinstance(row, dict)]


def text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def stable(value: Any) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", text(value).lower()).strip("-")
    return cleaned[:90] or "unknown"


def borough(value: Any) -> str:
    key = text(value).lower()
    if key in BOROUGHS:
        return BOROUGHS[key]
    if key in {"1", "mn"}:
        return "Manhattan"
    if key in {"2", "bx"}:
        return "Bronx"
    if key in {"3", "bk"}:
        return "Brooklyn"
    if key in {"4", "qn"}:
        return "Queens"
    if key in {"5", "si"}:
        return "Staten Island"
    return ""


def number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def point_from_geometry(value: Any) -> tuple[float | None, float | None]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None, None
    if not isinstance(value, dict):
        return None, None
    coordinates = value.get("coordinates")
    points: list[tuple[float, float]] = []

    def walk(node: Any) -> None:
        if isinstance(node, list) and len(node) >= 2 and all(isinstance(item, (int, float)) for item in node[:2]):
            lng, lat = float(node[0]), float(node[1])
            if -74.3 <= lng <= -73.65 and 40.45 <= lat <= 40.95:
                points.append((lng, lat))
            return
        if isinstance(node, list):
            for child in node:
                walk(child)

    walk(coordinates)
    if not points:
        return None, None
    return sum(lat for _, lat in points) / len(points), sum(lng for lng, _ in points) / len(points)


def location(
    *,
    row_id: str,
    title: str,
    category: str,
    address: str,
    row_borough: str,
    services: list[str],
    source_url: str,
    lat: float | None,
    lng: float | None,
    phone: str = "",
    hours: str = "",
    access_note: str = "",
    status: str = "active",
    source_name: str = "NYC Open Data",
) -> dict[str, Any] | None:
    title = text(title)
    address = text(address)
    boro = borough(row_borough)
    if not title or not address or not boro or lat is None or lng is None:
        return None
    if not (40.45 <= lat <= 40.95 and -74.3 <= lng <= -73.65):
        return None
    return {
        "id": stable(row_id),
        "title": title,
        "category": category,
        "address": address,
        "borough": boro,
        "services": [text(item) for item in services if text(item)],
        "phone": text(phone),
        "hours": text(hours),
        "access_note": text(access_note),
        "status": status,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "source_name": source_name,
        "source_url": source_url,
        "last_verified": TODAY,
    }


def build_homebase() -> list[dict[str, Any]]:
    dataset = "ntcm-2w4k"
    source = f"https://data.cityofnewyork.us/resource/{dataset}.json"
    rows = []
    for raw in fetch(dataset):
        item = location(
            row_id=f"homebase-{raw.get('homebase_office')}-{raw.get('address')}",
            title=f"{text(raw.get('homebase_office'))} Homebase",
            category="homebase",
            address=f"{text(raw.get('address'))}, {borough(raw.get('borough'))}, NY {text(raw.get('postcode'))}",
            row_borough=text(raw.get("borough")),
            services=["Homelessness prevention", "Eviction prevention", "Housing and benefits assistance"],
            phone=text(raw.get("phone_number")),
            hours="Confirm current hours before travel.",
            access_note=f"Service area ZIP codes: {text(raw.get('service_area_zip_code'))}. Call before visiting.",
            source_url=source,
            lat=number(raw.get("latitude")),
            lng=number(raw.get("longitude")),
        )
        if item:
            rows.append(item)
    return rows


def build_senior() -> list[dict[str, Any]]:
    dataset = "u7wp-np5k"
    source = f"https://data.cityofnewyork.us/resource/{dataset}.json"
    rows = []
    for raw in fetch(dataset):
        address = ", ".join(part for part in [text(raw.get("site_address")), text(raw.get("address_line_2")), f"{text(raw.get('borough'))}, NY {text(raw.get('zip_code'))}"] if part)
        item = location(
            row_id=f"aging-{raw.get('dfta_id')}-{raw.get('site_name')}",
            title=text(raw.get("site_name")),
            category="senior",
            address=address,
            row_borough=text(raw.get("borough")),
            services=[text(raw.get("provider_type")), text(raw.get("site_type")), "Older-adult services"],
            hours="Confirm program schedule with the provider.",
            access_note=f"Sponsor: {text(raw.get('sponsor_vendor'))}. Publicly listed NYC Aging site.",
            source_url=source,
            lat=number(raw.get("latitude")),
            lng=number(raw.get("longitude")),
        )
        if item:
            rows.append(item)
    return rows


def build_family_justice() -> list[dict[str, Any]]:
    dataset = "xggi-kgx9"
    source = f"https://data.cityofnewyork.us/resource/{dataset}.json"
    rows = []
    for raw in fetch(dataset):
        item = location(
            row_id=f"family-justice-{raw.get('facility_name')}",
            title=text(raw.get("facility_name")),
            category="family",
            address=f"{text(raw.get('street_address'))}, {text(raw.get('city'))}, NY {text(raw.get('zip_code'))}",
            row_borough=text(raw.get("borough")),
            services=["Domestic and gender-based violence support", "Legal and social-service referrals", "Safety planning"],
            phone=text(raw.get("telephone_number")),
            hours=text(raw.get("timings")),
            access_note=text(raw.get("comments")) or "Call ahead when safe to do so. Emergency help is available through 911.",
            source_url=source,
            lat=number(raw.get("latitude")),
            lng=number(raw.get("longitude")),
        )
        if item:
            rows.append(item)
    return rows


def build_digital() -> list[dict[str, Any]]:
    dataset = "sejx-2gn3"
    source = f"https://data.cityofnewyork.us/resource/{dataset}.json"
    rows = []
    for raw in fetch(dataset):
        if text(raw.get("status")).lower() not in {"", "active", "open"}:
            continue
        services = ["Public computers", "Internet or Wi-Fi access"]
        if text(raw.get("job_readiness_ex_resume_help")).lower() in {"yes", "true", "1"}:
            services.append("Job-readiness assistance")
        if text(raw.get("digital_literacy")).lower() in {"yes", "true", "1"}:
            services.append("Digital-literacy assistance")
        provider_url = text(raw.get("url"))
        safe_source = provider_url if provider_url.startswith("https://") else source
        item = location(
            row_id=f"digital-{raw.get('oid')}-{raw.get('location_name')}",
            title=text(raw.get("location_name")),
            category="digital",
            address=text(raw.get("full_location_address")) or f"{text(raw.get('address_street'))}, {borough(raw.get('borough_name'))}, NY {text(raw.get('zipcode'))}",
            row_borough=text(raw.get("borough_name")),
            services=services,
            phone=text(raw.get("full_location_phone_number")),
            hours="; ".join(text(raw.get(key)) for key in ("mon_open", "tue_open", "wed_open", "thu_open", "fri_open", "sat_open", "sun_open") if text(raw.get(key))),
            access_note="; ".join(part for part in [text(raw.get("access_notes")), text(raw.get("wheelchair_access_notes")), text(raw.get("access_requirements"))] if part),
            source_url=safe_source,
            lat=number(raw.get("latitude")),
            lng=number(raw.get("longitude")),
        )
        if item:
            rows.append(item)
    return rows


def build_restrooms() -> list[dict[str, Any]]:
    dataset = "n8q6-i44s"
    source = f"https://data.cityofnewyork.us/resource/{dataset}.json"
    rows = []
    for raw in fetch(dataset):
        restroom = text(raw.get("public_restroom")).lower()
        if restroom not in {"yes", "y", "true", "1"}:
            continue
        lat, lng = point_from_geometry(raw.get("multipolygon"))
        title = text(raw.get("description")) or text(raw.get("location")) or "NYC Parks Public Restroom"
        item = location(
            row_id=f"restroom-{raw.get('doitt_id')}-{raw.get('gispropnum')}-{title}",
            title=title,
            category="restroom",
            address=text(raw.get("location")) or f"NYC Parks property {text(raw.get('gispropnum'))}, {borough(raw.get('borough'))}",
            row_borough=text(raw.get("borough")),
            services=["Public restroom"],
            hours="Park and facility hours vary.",
            access_note="Confirm seasonal availability and accessibility before travel.",
            source_url=source,
            lat=lat,
            lng=lng,
        )
        if item:
            rows.append(item)
    return rows


BUILDERS: dict[str, Callable[[], list[dict[str, Any]]]] = {
    "homebase": build_homebase,
    "senior": build_senior,
    "family": build_family_justice,
    "digital": build_digital,
    "restroom": build_restrooms,
}


def dedupe(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_semantic: set[tuple[str, str]] = set()
    for row in sorted(rows, key=lambda item: (item["borough"], item["title"], item["address"])):
        semantic = (row["title"].casefold(), row["address"].casefold())
        if row["id"] in seen_ids or semantic in seen_semantic:
            continue
        seen_ids.add(row["id"])
        seen_semantic.add(semantic)
        result.append(row)
    return result


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    summary: dict[str, int] = {}
    for category, builder in BUILDERS.items():
        rows = dedupe(builder())
        payload = {
            "schema_version": "2.0.0",
            "category": category,
            "last_verified_date": TODAY,
            "locations": rows,
        }
        (OUT / f"{category}.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        summary[category] = len(rows)
    (OUT / "sync-summary-v2.json").write_text(json.dumps({"generated": TODAY, "counts": summary}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if all(summary.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
