#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

CATALOG = "https://api.us.socrata.com/api/catalog/v1"
CONTEXT = "data.cityofnewyork.us"
QUERIES = [
    ("01-legal", "free legal services tenant immigration civil legal NYC"),
    ("01-tax", "free tax preparation VITA NYC"),
    ("01-faith", "places of worship religious institutions NYC"),
    ("02-food", "food pantry soup kitchen NYC"),
    ("02-homebase", "Homebase homelessness prevention NYC"),
    ("02-naloxone", "naloxone harm reduction locations NYC"),
    ("03-wic", "WIC locations NYC"),
    ("03-clinics", "health clinics locations NYC"),
    ("03-mental-health", "mental health service locations NYC"),
    ("03-benefits", "benefits enrollment assistance NYC"),
    ("04-senior", "older adult centers senior centers NYC"),
    ("04-disability", "disability services locations NYC"),
    ("04-family-justice", "family justice centers NYC"),
    ("04-immigration", "immigration service providers NYC"),
    ("05-libraries", "library locations NYC"),
    ("05-restrooms", "public restrooms NYC"),
    ("05-cooling", "cooling centers NYC"),
    ("06-mome", "film permits MOME NYC"),
    ("06-dob", "DOB permits construction NYC"),
    ("06-dot", "DOT permits street closures NYC"),
]
KNOWN_IDS = ["tvpp-9vvx", "tg4x-b46p", "rbx6-tga4", "6v4b-5gp4", "ji82-xba5", "hjae-yuav"]


def get_json(url: str) -> object:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "NYCInFocus-CommunityHelp-SourceAudit/2.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def compact_resource(result: dict) -> dict:
    resource = result.get("resource") or {}
    classification = result.get("classification") or {}
    metadata = result.get("metadata") or {}
    return {
        "name": resource.get("name"),
        "id": resource.get("id"),
        "type": resource.get("type"),
        "description": resource.get("description"),
        "updatedAt": resource.get("updatedAt"),
        "page_views": resource.get("page_views"),
        "columns_field_name": resource.get("columns_field_name"),
        "columns_name": resource.get("columns_name"),
        "domain": metadata.get("domain"),
        "permalink": result.get("permalink"),
        "categories": classification.get("categories"),
    }


def search_catalog(query: str) -> list[dict]:
    params = urllib.parse.urlencode({"q": query, "search_context": CONTEXT, "limit": 20})
    payload = get_json(f"{CATALOG}?{params}")
    return [compact_resource(item) for item in (payload.get("results") or [])]


def sample_dataset(dataset_id: str) -> dict:
    url = f"https://data.cityofnewyork.us/resource/{dataset_id}.json?$limit=3"
    try:
        payload = get_json(url)
        return {"id": dataset_id, "ok": True, "url": url, "rows": payload}
    except Exception as exc:
        return {"id": dataset_id, "ok": False, "url": url, "error": f"{type(exc).__name__}: {exc}"}


def main() -> int:
    output = Path(os.environ.get("OUTPUT_DIR", "artifacts/community-source-probe"))
    output.mkdir(parents=True, exist_ok=True)
    report: dict[str, object] = {"catalog": {}, "known_samples": []}
    for key, query in QUERIES:
        try:
            report["catalog"][key] = {"query": query, "results": search_catalog(query)}
        except Exception as exc:
            report["catalog"][key] = {
                "query": query,
                "error": f"{type(exc).__name__}: {exc}",
                "results": [],
            }
    report["known_samples"] = [sample_dataset(item) for item in KNOWN_IDS]
    (output / "source-probe.json").write_text(
        json.dumps(report, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    lines = ["# NYCIF community and city-source probe", ""]
    for key, _query in QUERIES:
        section = report["catalog"][key]
        lines.extend([f"## {key}", "", f"Query: `{section['query']}`", ""])
        if section.get("error"):
            lines.extend([f"ERROR: {section['error']}", ""])
        for item in section.get("results", [])[:10]:
            lines.append(
                f"- `{item.get('id')}` — {item.get('name')} — updated `{item.get('updatedAt')}`"
            )
        lines.append("")
    lines.extend(["## Known dataset samples", ""])
    for sample in report["known_samples"]:
        lines.append(f"- `{sample['id']}`: {'OK' if sample['ok'] else sample.get('error')}")
        if sample.get("rows"):
            fields = sorted({field for row in sample["rows"] for field in row})
            lines.append(f"  - fields: {', '.join(fields)}")
    (output / "source-probe.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {"output": str(output), "queries": len(QUERIES), "known_samples": len(KNOWN_IDS)},
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
