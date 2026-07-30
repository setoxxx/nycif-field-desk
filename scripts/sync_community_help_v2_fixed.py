#!/usr/bin/env python3
"""Corrected execution wrapper for the Community Help v2 source sync.

Keeps the reviewed v2 source adapters, while fixing two dataset-specific schema
issues discovered by CI:
- Family Justice Center records need borough/address in their stable IDs.
- NYC Parks Structures uses B/M/Q/R/X borough codes and featurestatus.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location(
    "nycif_sync_community_help_v2",
    HERE / "sync_community_help_v2.py",
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load sync_community_help_v2.py")
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)

sync.BOROUGHS.update({
    "b": "Brooklyn",
    "m": "Manhattan",
    "q": "Queens",
    "r": "Staten Island",
    "x": "Bronx",
})


def build_family_justice() -> list[dict[str, Any]]:
    dataset = "xggi-kgx9"
    source = f"https://data.cityofnewyork.us/resource/{dataset}.json"
    rows: list[dict[str, Any]] = []
    for raw in sync.fetch(dataset):
        boro = sync.text(raw.get("borough"))
        street = sync.text(raw.get("street_address"))
        zip_code = sync.text(raw.get("zip_code"))
        item = sync.location(
            row_id=f"family-justice-{boro}-{street}-{zip_code}",
            title=sync.text(raw.get("facility_name")),
            category="family",
            address=f"{street}, {sync.text(raw.get('city'))}, NY {zip_code}",
            row_borough=boro,
            services=[
                "Domestic and gender-based violence support",
                "Legal and social-service referrals",
                "Safety planning",
            ],
            phone=sync.text(raw.get("telephone_number")),
            hours=sync.text(raw.get("timings")),
            access_note=sync.text(raw.get("comments"))
            or "Call ahead when safe to do so. Emergency help is available through 911.",
            source_url=source,
            lat=sync.number(raw.get("latitude")),
            lng=sync.number(raw.get("longitude")),
        )
        if item:
            rows.append(item)
    return rows


def build_restrooms() -> list[dict[str, Any]]:
    dataset = "n8q6-i44s"
    source = f"https://data.cityofnewyork.us/resource/{dataset}.json"
    rows: list[dict[str, Any]] = []
    for raw in sync.fetch(dataset):
        if sync.text(raw.get("public_restroom")).lower() not in {"yes", "y", "true", "1"}:
            continue
        if sync.text(raw.get("featurestatus")).lower() not in {"", "active"}:
            continue
        lat, lng = sync.point_from_geometry(raw.get("multipolygon"))
        title = (
            sync.text(raw.get("description"))
            or sync.text(raw.get("location"))
            or "NYC Parks Public Restroom"
        )
        boro_code = sync.text(raw.get("borough"))
        item = sync.location(
            row_id=f"restroom-{raw.get('system') or raw.get('doitt_id')}-{raw.get('gispropnum')}-{title}",
            title=title,
            category="restroom",
            address=sync.text(raw.get("location"))
            or f"NYC Parks property {sync.text(raw.get('gispropnum'))}, {sync.borough(boro_code)}",
            row_borough=boro_code,
            services=["Public restroom"],
            hours="Park and facility hours vary.",
            access_note="Official NYC Parks structure marked active with a public restroom. Confirm seasonal availability and accessibility before travel.",
            source_url=source,
            lat=lat,
            lng=lng,
        )
        if item:
            rows.append(item)
    return rows


sync.BUILDERS["family"] = build_family_justice
sync.BUILDERS["restroom"] = build_restrooms

if __name__ == "__main__":
    raise SystemExit(sync.main())
