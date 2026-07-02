#!/usr/bin/env python3
"""XRI-G10 read-only registry lookup prototype.

Reads only data/registry/registry_seed.sample.json unless a different local seed
path is explicitly supplied. Does not write files, modify caches, touch feeds,
call APIs, fetch SODA, update WordPress, or wire runtime behavior.
"""

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SEED = ROOT / "data" / "registry" / "registry_seed.sample.json"


def normalize(value: str) -> str:
    return " ".join(value.lower().replace("_", " ").replace("-", " ").split())


def load_seed(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("artifact_type") != "xri_registry_seed_sample":
        raise ValueError("seed artifact_type must be xri_registry_seed_sample")
    if data.get("production_allowed") is not False:
        raise ValueError("seed production_allowed must remain false")
    if data.get("public_map_allowed") is not False:
        raise ValueError("seed public_map_allowed must remain false")
    if data.get("runtime_wiring_allowed") is not False:
        raise ValueError("seed runtime_wiring_allowed must remain false")
    return data


def lookup(seed: dict[str, Any], query: str) -> dict[str, Any]:
    q = normalize(query)
    records = seed.get("records", [])
    if not isinstance(records, list):
        records = []

    exact_matches = []
    possible_matches = []

    for record in records:
        if not isinstance(record, dict):
            continue
        canonical = normalize(str(record.get("canonical_name", "")))
        key = normalize(str(record.get("normalized_location_key", "")))
        location_text = normalize(str(record.get("address_or_location_text", "")))
        if q and q in {canonical, key}:
            exact_matches.append(record)
        elif q and (q in canonical or q in key or q in location_text):
            possible_matches.append(record)

    if exact_matches:
        outcome = "exact_registry_match"
        matches = exact_matches
    elif possible_matches:
        outcome = "manual_review_required"
        matches = possible_matches
    else:
        outcome = "no_match"
        matches = []

    return {
        "query": query,
        "normalized_query": q,
        "outcome": outcome,
        "match_count": len(matches),
        "matches": [
            {
                "registry_seed_id": record.get("registry_seed_id"),
                "canonical_name": record.get("canonical_name"),
                "normalized_location_key": record.get("normalized_location_key"),
                "borough": record.get("borough"),
                "seed_status": record.get("seed_status"),
                "production_allowed": False,
                "public_map_allowed": False,
                "runtime_wiring_allowed": False,
                "next_allowed_step": record.get("next_allowed_step"),
            }
            for record in matches
        ],
        "production_allowed": False,
        "public_map_allowed": False,
        "runtime_wiring_allowed": False,
    }


def run_demo(seed: dict[str, Any]) -> dict[str, Any]:
    queries = [
        "Sample Seed-Ready Location",
        "sample seed ready",
        "Unknown Location",
        "Coordinate Conflict Example",
        "Duplicate Hold Example",
    ]
    results = [lookup(seed, query) for query in queries]

    excluded = seed.get("excluded_review_records", [])
    blocked_examples = []
    if isinstance(excluded, list):
        for item in excluded:
            if isinstance(item, dict):
                blocked_examples.append(
                    {
                        "source_review_id": item.get("source_review_id"),
                        "source_candidate_id": item.get("source_candidate_id"),
                        "review_state": item.get("review_state"),
                        "reason": item.get("reason"),
                        "lookup_outcome": "manual_review_required",
                        "production_allowed": False,
                        "public_map_allowed": False,
                    }
                )

    return {
        "phase": "XRI-G10",
        "prototype": "read_only_registry_lookup_prototype",
        "seed_artifact_type": seed.get("artifact_type"),
        "seed_record_count": len(seed.get("records", [])) if isinstance(seed.get("records"), list) else 0,
        "lookup_results": results,
        "blocked_review_examples": blocked_examples,
        "supported_outcomes": [
            "exact_registry_match",
            "no_match",
            "manual_review_required",
            "seed_record_available_offline_only",
        ],
        "production_allowed": False,
        "public_map_allowed": False,
        "runtime_wiring_allowed": False,
        "writes_performed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only XRI-G10 registry lookup prototype")
    parser.add_argument("--seed", default=str(DEFAULT_SEED), help="Local seed artifact path")
    parser.add_argument("--query", help="Lookup query. Omit for demo output.")
    args = parser.parse_args()

    seed_path = Path(args.seed)
    if not seed_path.is_absolute():
        seed_path = ROOT / seed_path
    seed = load_seed(seed_path)

    if args.query:
        output = lookup(seed, args.query)
    else:
        output = run_demo(seed)

    print(json.dumps(output, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
