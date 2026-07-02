#!/usr/bin/env python3
"""Offline validator for XRI-G9 registry seed sample.

Reads only data/registry/registry_seed.sample.json. Does not read caches,
feeds, public map files, WordPress files, remote URLs, APIs, or SODA.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_PATH = ROOT / "data" / "registry" / "registry_seed.sample.json"


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else SEED_PATH
    if not path.is_absolute():
        path = ROOT / path

    data = json.loads(path.read_text(encoding="utf-8"))
    errors = []
    warnings = []

    if data.get("artifact_type") != "xri_registry_seed_sample":
        errors.append("artifact_type must be xri_registry_seed_sample")
    if data.get("phase") != "XRI-G9":
        errors.append("phase must be XRI-G9")
    if data.get("production_allowed") is not False:
        errors.append("top-level production_allowed must be false")
    if data.get("public_map_allowed") is not False:
        errors.append("top-level public_map_allowed must be false")
    if data.get("runtime_wiring_allowed") is not False:
        errors.append("top-level runtime_wiring_allowed must be false")

    records = data.get("records", [])
    if not isinstance(records, list) or not records:
        errors.append("records must be a non-empty list")
        records = []

    excluded = data.get("excluded_review_records", [])
    if not isinstance(excluded, list):
        errors.append("excluded_review_records must be a list")
        excluded = []

    seen = set()
    for index, record in enumerate(records):
        prefix = f"records[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{prefix}: record must be an object")
            continue
        seed_id = str(record.get("registry_seed_id", ""))
        if not seed_id.startswith("xri-g9-seed-"):
            errors.append(f"{prefix}: registry_seed_id must start with xri-g9-seed-")
        if seed_id in seen:
            errors.append(f"{prefix}: duplicate registry_seed_id")
        seen.add(seed_id)
        for flag in ["production_allowed", "public_map_allowed", "runtime_wiring_allowed"]:
            if record.get(flag) is not False:
                errors.append(f"{prefix}: {flag} must be false")
        if record.get("seed_status") != "offline_seed_candidate_only":
            errors.append(f"{prefix}: seed_status must be offline_seed_candidate_only")
        if record.get("next_allowed_step") != "xri_g10_read_only_lookup_prototype_only":
            errors.append(f"{prefix}: next_allowed_step must be G10 read-only lookup prototype only")
        evidence = record.get("evidence_summary", {})
        if evidence.get("hard_blocks") != []:
            errors.append(f"{prefix}: seed record must have no hard blocks")
        for field in [
            "source_identity_present",
            "source_path_present",
            "normalized_name_present",
            "borough_confidence_present",
            "location_confidence_present",
            "coordinate_provenance_present",
            "duplicate_check_complete",
            "conflict_check_complete",
            "operator_note_present",
        ]:
            if evidence.get(field) is not True:
                errors.append(f"{prefix}: evidence_summary.{field} must be true")
        provenance = record.get("provenance", {})
        if provenance.get("review_state") != "seed_eligible_pending_final_gate":
            errors.append(f"{prefix}: provenance.review_state must be seed_eligible_pending_final_gate")

    if not excluded:
        warnings.append("No excluded review records present.")

    result = {
        "validator": "tools/xri/validate_registry_seed_sample.py",
        "seed_path": str(path.relative_to(ROOT)),
        "records_checked": len(records),
        "excluded_records_checked": len(excluded),
        "errors": errors,
        "warnings": warnings,
        "passed": not errors,
        "production_allowed": False,
        "public_map_allowed": False,
        "runtime_wiring_allowed": False,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
