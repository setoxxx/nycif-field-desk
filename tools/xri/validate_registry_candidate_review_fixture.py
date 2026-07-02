#!/usr/bin/env python3
"""Validate XRI-G8 registry candidate review fixtures.

This validator is offline-only. It reads only the XRI-G8 review fixture and checks
that review states, operator actions, evidence, hard blocks, and safety flags
follow the G7 decision model.

It does not read location_cache.json, production feeds, public map runtime files,
WordPress files, remote URLs, SODA endpoints, or external APIs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = ROOT / "data" / "fixtures" / "registry_candidate_review_fixtures.sample.json"

REVIEW_STATES = {
    "pending_review",
    "needs_more_evidence",
    "conflict_hold",
    "duplicate_hold",
    "borough_mismatch_hold",
    "coordinate_conflict_hold",
    "rejected",
    "excluded",
    "seed_eligible_pending_final_gate",
}

OPERATOR_ACTIONS = {
    "mark_needs_more_evidence",
    "mark_duplicate_hold",
    "mark_conflict_hold",
    "mark_borough_mismatch_hold",
    "mark_coordinate_conflict_hold",
    "mark_rejected",
    "mark_excluded",
    "mark_seed_eligible_pending_final_gate",
}

HARD_BLOCKS = {
    "coordinate_conflict",
    "duplicate_conflict",
    "borough_mismatch",
    "missing_source_identity",
    "missing_provenance",
    "rejected_or_excluded_source",
    "unclear_location_text",
    "public_map_flag_true_before_final_gate",
}

REQUIRED_EVIDENCE = [
    "source_identity_present",
    "source_path_present",
    "normalized_name_present",
    "borough_confidence_present",
    "location_confidence_present",
    "coordinate_provenance_present",
    "duplicate_check_complete",
    "conflict_check_complete",
    "operator_note_present",
]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def require(condition: bool, errors: list[str], message: str) -> None:
    if not condition:
        errors.append(message)


def validate_record(record: dict[str, Any], index: int) -> list[str]:
    errors: list[str] = []
    prefix = f"records[{index}]"

    for key in [
        "review_id",
        "candidate_id",
        "preview_group",
        "review_state",
        "operator_action",
        "evidence",
        "hard_blocks",
        "soft_warnings",
        "decision",
        "production_allowed",
        "public_map_allowed",
        "next_allowed_step",
    ]:
        require(key in record, errors, f"{prefix}: missing required field {key}")

    if errors:
        return errors

    require(str(record["review_id"]).startswith("xri-g8-review-"), errors, f"{prefix}: review_id must start with xri-g8-review-")
    require(record["review_state"] in REVIEW_STATES, errors, f"{prefix}: invalid review_state {record['review_state']}")
    require(record["operator_action"] in OPERATOR_ACTIONS, errors, f"{prefix}: invalid operator_action {record['operator_action']}")
    require(record["production_allowed"] is False, errors, f"{prefix}: production_allowed must be false")
    require(record["public_map_allowed"] is False, errors, f"{prefix}: public_map_allowed must be false")

    evidence = record["evidence"]
    require(isinstance(evidence, dict), errors, f"{prefix}: evidence must be an object")
    if isinstance(evidence, dict):
        for field in REQUIRED_EVIDENCE:
            require(field in evidence, errors, f"{prefix}: evidence missing {field}")
            if field in evidence:
                require(isinstance(evidence[field], bool), errors, f"{prefix}: evidence.{field} must be boolean")

    hard_blocks = record["hard_blocks"]
    require(isinstance(hard_blocks, list), errors, f"{prefix}: hard_blocks must be a list")
    if isinstance(hard_blocks, list):
        for block in hard_blocks:
            require(block in HARD_BLOCKS, errors, f"{prefix}: invalid hard block {block}")

    decision = record["decision"]
    require(isinstance(decision, dict), errors, f"{prefix}: decision must be an object")
    if isinstance(decision, dict):
        require(bool(decision.get("note")), errors, f"{prefix}: decision.note is required")
        require(bool(decision.get("operator")), errors, f"{prefix}: decision.operator is required")
        require(bool(decision.get("timestamp")), errors, f"{prefix}: decision.timestamp is required")

    state = record["review_state"]
    if state == "seed_eligible_pending_final_gate":
        require(not hard_blocks, errors, f"{prefix}: seed eligible fixture cannot have hard blocks")
        if isinstance(evidence, dict):
            missing_evidence = [field for field in REQUIRED_EVIDENCE if evidence.get(field) is not True]
            require(not missing_evidence, errors, f"{prefix}: seed eligible fixture missing evidence {missing_evidence}")
        require(record["next_allowed_step"] == "eligible_for_future_seed_artifact_only", errors, f"{prefix}: seed eligible next step must remain artifact-only")

    if state in {"duplicate_hold", "coordinate_conflict_hold", "borough_mismatch_hold", "conflict_hold"}:
        require(bool(hard_blocks), errors, f"{prefix}: hold state must include at least one hard block")

    if state in {"rejected", "excluded"}:
        require("rejected_or_excluded_source" in hard_blocks, errors, f"{prefix}: rejected/excluded state must include rejected_or_excluded_source hard block")

    return errors


def validate_fixture(path: Path) -> dict[str, Any]:
    data = load_json(path)
    errors: list[str] = []
    warnings: list[str] = []

    require(data.get("artifact_type") == "xri_registry_candidate_review_fixture", errors, "artifact_type must be xri_registry_candidate_review_fixture")
    require(data.get("phase") == "XRI-G8", errors, "phase must be XRI-G8")
    require(data.get("production_allowed") is False, errors, "top-level production_allowed must be false")
    require(data.get("public_map_allowed") is False, errors, "top-level public_map_allowed must be false")
    require(data.get("runtime_wiring_allowed") is False, errors, "top-level runtime_wiring_allowed must be false")

    records = data.get("records")
    require(isinstance(records, list) and len(records) > 0, errors, "records must be a non-empty list")

    reviewed_states: dict[str, int] = {}
    if isinstance(records, list):
        seen_ids: set[str] = set()
        for index, record in enumerate(records):
            if isinstance(record, dict):
                review_id = record.get("review_id")
                if review_id in seen_ids:
                    errors.append(f"records[{index}]: duplicate review_id {review_id}")
                seen_ids.add(str(review_id))
                reviewed_states[str(record.get("review_state"))] = reviewed_states.get(str(record.get("review_state")), 0) + 1
                errors.extend(validate_record(record, index))
            else:
                errors.append(f"records[{index}]: record must be an object")

    if "seed_eligible_pending_final_gate" not in reviewed_states:
        warnings.append("No seed_eligible_pending_final_gate fixture present.")
    if "coordinate_conflict_hold" not in reviewed_states:
        warnings.append("No coordinate_conflict_hold fixture present.")
    if "duplicate_hold" not in reviewed_states:
        warnings.append("No duplicate_hold fixture present.")

    return {
        "validator": "tools/xri/validate_registry_candidate_review_fixture.py",
        "fixture_path": str(path.relative_to(ROOT)),
        "records_checked": len(records) if isinstance(records, list) else 0,
        "states_seen": reviewed_states,
        "errors": errors,
        "warnings": warnings,
        "passed": not errors,
        "production_allowed": False,
        "public_map_allowed": False,
        "runtime_wiring_allowed": False,
    }


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT_FIXTURE
    if not path.is_absolute():
        path = ROOT / path
    result = validate_fixture(path)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
