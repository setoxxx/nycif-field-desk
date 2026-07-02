#!/usr/bin/env python3
"""
XRI-G4 read-only candidate extractor prototype.

Reads ONLY data/fixtures/registry-candidate-fixtures.sample.json.
Writes sample/report outputs under data/reports/ only.
Does not read caches, feeds, APIs, or mutate source assets.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = REPO_ROOT / "data/fixtures/registry-candidate-fixtures.sample.json"
DEFAULT_OUTPUT = (
    REPO_ROOT / "data/reports/read_only_candidate_extractor_prototype_output.sample.json"
)

REQUIRED_SHAPE_FIELDS = (
    "candidate_id",
    "source_repo",
    "source_path",
    "source_asset_type",
    "source_key",
    "raw_name",
    "normalized_name",
    "normalized_location_key",
    "registry_type",
    "geometry_type",
    "geometry_source",
    "coordinate_quality",
    "source_approval_status",
    "proposed_registry_status",
    "provenance",
    "confidence",
    "generated_at",
)

SOURCE_ASSET_TYPES = {
    "location_cache",
    "approved_override",
    "geocode_audit_report",
    "match_sample_report",
    "feed_output",
    "source_adapter",
    "feed_generator",
    "validation_script",
    "review_ui",
    "map_runtime",
    "staging_gate",
    "documentation",
    "rollback_snapshot",
    "parks_event_locations",
    "unknown_location_related_asset",
}

PROPOSED_REGISTRY_STATUSES = {
    "seed_approved_candidate",
    "needs_schema_review",
    "possible_duplicate",
    "coordinate_conflict",
    "source_missing",
    "raw_unapproved",
    "excluded_runtime_patch",
    "excluded_public_feed_output",
    "rejected",
}

BLOCKED_STATUSES = {
    "raw_unapproved",
    "possible_duplicate",
    "coordinate_conflict",
    "source_missing",
    "excluded_runtime_patch",
    "excluded_public_feed_output",
    "rejected",
}

BLOCKED_MATCH_STATUSES = {"possible_match", "conflict", "unmatched", "rejected"}

REGISTRY_TYPES = {
    "venue",
    "park",
    "park_asset",
    "intersection",
    "street_segment",
    "address_point",
    "neighborhood",
    "borough",
    "source_specific_override",
    "manual_editorial_override",
    "unknown",
}

GEOMETRY_TYPES = {"point", "line", "polygon", "centroid", "unknown"}
COORDINATE_QUALITIES = {"approved", "provisional", "review_only", "missing"}

FORBIDDEN_PRODUCTION_FIELDS = (
    "production_approved",
    "publish_allowed",
    "production_ready",
    "production_allowed",
)

NYC_LAT_MIN, NYC_LAT_MAX = 40.45, 40.95
NYC_LNG_MIN, NYC_LNG_MAX = -74.30, -73.65

PRODUCTION_FEED_PATH_MARKERS = (
    "nycif_all_radar_map_events.json",
    "nycif_major_radar_map_events.json",
    "nycif_staged_live_events.json",
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def append_error(
    errors: list[dict[str, Any]],
    record: dict[str, Any],
    code: str,
    message: str,
    level: int,
) -> None:
    errors.append(
        {
            "candidate_id": record.get("candidate_id"),
            "source_path": record.get("source_path"),
            "error_code": code,
            "error_message": message,
            "severity": "error",
            "validation_level": level,
        }
    )


def append_warning(
    warnings: list[dict[str, Any]],
    record: dict[str, Any],
    action: str,
    message: str,
) -> None:
    warnings.append(
        {
            "candidate_id": record.get("candidate_id"),
            "conflict_flags": record.get("conflict_flags") or [],
            "recommended_review_action": action,
            "severity": "warning",
            "message": message,
        }
    )


def validate_level_0(record: dict[str, Any]) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []

    for field in REQUIRED_SHAPE_FIELDS:
        if field not in record or record[field] in (None, ""):
            append_error(
                errors,
                record,
                "SHAPE_MISSING_REQUIRED_FIELD",
                f"Missing required field: {field}",
                0,
            )

    status = record.get("proposed_registry_status")
    if status and status not in PROPOSED_REGISTRY_STATUSES:
        append_error(
            errors,
            record,
            "SHAPE_INVALID_ENUM",
            f"Invalid proposed_registry_status: {status}",
            0,
        )

    registry_type = record.get("registry_type")
    if registry_type and registry_type not in REGISTRY_TYPES:
        append_error(
            errors,
            record,
            "SHAPE_INVALID_ENUM",
            f"Invalid registry_type: {registry_type}",
            0,
        )

    geometry_type = record.get("geometry_type")
    if geometry_type and geometry_type not in GEOMETRY_TYPES:
        append_error(
            errors,
            record,
            "SHAPE_INVALID_ENUM",
            f"Invalid geometry_type: {geometry_type}",
            0,
        )

    coordinate_quality = record.get("coordinate_quality")
    if coordinate_quality and coordinate_quality not in COORDINATE_QUALITIES:
        append_error(
            errors,
            record,
            "SHAPE_INVALID_ENUM",
            f"Invalid coordinate_quality: {coordinate_quality}",
            0,
        )

    asset_type = record.get("source_asset_type")
    if asset_type and asset_type not in SOURCE_ASSET_TYPES:
        append_error(
            errors,
            record,
            "SHAPE_INVALID_ENUM",
            f"Invalid source_asset_type: {asset_type}",
            0,
        )

    confidence = record.get("confidence")
    if confidence is not None and not is_number(confidence):
        append_error(
            errors,
            record,
            "SHAPE_INVALID_TYPE",
            "confidence must be a number",
            0,
        )

    provenance = record.get("provenance")
    if provenance is not None and not isinstance(provenance, dict):
        append_error(
            errors,
            record,
            "SHAPE_INVALID_TYPE",
            "provenance must be an object",
            0,
        )

    return errors


def validate_level_1(record: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    lat = record.get("lat")
    lng = record.get("lng")
    has_lat = lat is not None
    has_lng = lng is not None

    if has_lat != has_lng:
        append_error(
            errors,
            record,
            "COORD_INCOMPLETE_PAIR",
            "lat and lng must both be present or both null",
            1,
        )
        return errors, warnings

    if has_lat and has_lng:
        if not is_number(lat) or not is_number(lng):
            append_error(
                errors,
                record,
                "COORD_INVALID_TYPE",
                "lat and lng must be numbers when present",
                1,
            )
            return errors, warnings

        if not (-90 <= lat <= 90):
            append_error(errors, record, "COORD_LAT_OUT_OF_RANGE", "lat out of range", 1)
        if not (-180 <= lng <= 180):
            append_error(errors, record, "COORD_LNG_OUT_OF_RANGE", "lng out of range", 1)

        if not (NYC_LAT_MIN <= lat <= NYC_LAT_MAX and NYC_LNG_MIN <= lng <= NYC_LNG_MAX):
            append_warning(
                warnings,
                record,
                "verify_nyc_bounds",
                "Coordinates outside advisory NYC bounds",
            )

        geometry_source = record.get("geometry_source")
        if not geometry_source or geometry_source == "none":
            append_error(
                errors,
                record,
                "COORD_MISSING_GEOMETRY_SOURCE",
                "geometry_source required and must not be 'none' when coordinates exist",
                1,
            )

        if record.get("coordinate_quality") == "missing":
            append_error(
                errors,
                record,
                "COORD_QUALITY_MISSING_WITH_COORDS",
                "coordinate_quality must not be 'missing' when coordinates exist",
                1,
            )

    return errors, warnings


def validate_level_2(record: dict[str, Any]) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []

    if not record.get("source_repo"):
        append_error(
            errors,
            record,
            "PROVENANCE_MISSING_SOURCE",
            "source_repo is required",
            2,
        )
    if not record.get("source_path"):
        append_error(
            errors,
            record,
            "PROVENANCE_MISSING_SOURCE",
            "source_path is required",
            2,
        )

    provenance = record.get("provenance") or {}
    source_tier = provenance.get("source_tier")
    if source_tier is None:
        append_error(
            errors,
            record,
            "PROVENANCE_MISSING_TIER",
            "provenance.source_tier is required",
            2,
        )
    elif not isinstance(source_tier, int) or source_tier not in (0, 1, 2, 3):
        append_error(
            errors,
            record,
            "PROVENANCE_INVALID_TIER",
            "provenance.source_tier must be 0, 1, 2, or 3",
            2,
        )

    status = record.get("proposed_registry_status")
    if status == "seed_approved_candidate":
        for field in ("extracted_by", "source_phase", "source_version"):
            if not provenance.get(field):
                append_error(
                    errors,
                    record,
                    "PROVENANCE_INSUFFICIENT_FOR_SEED",
                    f"seed_approved_candidate requires provenance.{field}",
                    2,
                )
        if provenance.get("not_production_approved") is not True:
            append_error(
                errors,
                record,
                "PROVENANCE_INSUFFICIENT_FOR_SEED",
                "seed_approved_candidate requires provenance.not_production_approved=true",
                2,
            )

        if source_tier == 3:
            append_error(
                errors,
                record,
                "PROVENANCE_TIER3_SEED_FORBIDDEN",
                "Tier 3 sources cannot have seed_approved_candidate without explicit override adjudication",
                2,
            )

    return errors


def validate_level_3(record: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for field in FORBIDDEN_PRODUCTION_FIELDS:
        if record.get(field) is True:
            append_error(
                errors,
                record,
                "SAFETY_PRODUCTION_APPROVAL_FORBIDDEN",
                f"Forbidden production field present: {field}=true",
                3,
            )

    status = record.get("proposed_registry_status")
    if status in BLOCKED_STATUSES:
        append_error(
            errors,
            record,
            "SAFETY_BLOCKED_STATUS",
            f"Blocked proposed_registry_status: {status}",
            3,
        )

    match_status = record.get("match_status")
    if match_status in BLOCKED_MATCH_STATUSES:
        append_error(
            errors,
            record,
            "SAFETY_BLOCKED_STATUS_PUBLISH_ATTEMPT",
            f"Blocked match_status for publishing: {match_status}",
            3,
        )

    asset_type = record.get("source_asset_type")
    if asset_type == "map_runtime" and status == "seed_approved_candidate":
        append_error(
            errors,
            record,
            "SAFETY_RUNTIME_PATCH_AS_SOURCE",
            "map_runtime source cannot be seed_approved_candidate",
            3,
        )

    source_path = str(record.get("source_path") or "")
    if (
        asset_type == "feed_output"
        and status == "seed_approved_candidate"
        and any(marker in source_path for marker in PRODUCTION_FEED_PATH_MARKERS)
    ):
        append_error(
            errors,
            record,
            "SAFETY_FEED_AS_SOURCE_OF_TRUTH",
            "Production feed_output cannot be seed_approved_candidate source of truth",
            3,
        )

    if status == "source_missing" and record.get("lat") is not None and record.get("lng") is not None:
        append_error(
            errors,
            record,
            "SAFETY_INVENTED_COORDINATES",
            "source_missing must not carry invented replacement coordinates",
            3,
        )

    geometry_source = record.get("geometry_source")
    if geometry_source == "invented_replacement":
        append_error(
            errors,
            record,
            "SAFETY_INVENTED_COORDINATES",
            "geometry_source invented_replacement is forbidden",
            3,
        )

    provenance = record.get("provenance") or {}
    if provenance.get("not_production_approved") is False:
        append_error(
            errors,
            record,
            "SAFETY_PRODUCTION_APPROVAL_FORBIDDEN",
            "provenance.not_production_approved must not be false",
            3,
        )

    if status == "needs_schema_review":
        append_warning(
            warnings,
            record,
            "schema_review_before_seed",
            "Candidate requires schema review before seed eligibility",
        )

    if provenance.get("phase_2e_reconciliation_required"):
        append_warning(
            warnings,
            record,
            "reconcile_phase_2e_before_seed",
            "Phase 2E reconciliation required before seed eligibility",
        )

    if status == "seed_approved_candidate":
        append_warning(
            warnings,
            record,
            "future_seeding_review_only",
            "seed_approved_candidate is validation-pass only; not production-approved",
        )

    return errors, warnings


def highest_level_passed(errors: list[dict[str, Any]]) -> int:
    failed_levels = {error["validation_level"] for error in errors}
    for level in (3, 2, 1, 0):
        if level not in failed_levels:
            return level
    return -1


def validate_record(record: dict[str, Any]) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[dict[str, Any]]]:
    all_errors: list[dict[str, Any]] = []
    all_warnings: list[dict[str, Any]] = []

    l0_errors = validate_level_0(record)
    all_errors.extend(l0_errors)
    if l0_errors:
        return None, all_errors, all_warnings

    l1_errors, l1_warnings = validate_level_1(record)
    all_errors.extend(l1_errors)
    all_warnings.extend(l1_warnings)
    if l1_errors:
        return None, all_errors, all_warnings

    l2_errors = validate_level_2(record)
    all_errors.extend(l2_errors)
    if l2_errors:
        return None, all_errors, all_warnings

    l3_errors, l3_warnings = validate_level_3(record)
    all_errors.extend(l3_errors)
    all_warnings.extend(l3_warnings)
    if l3_errors:
        return None, all_errors, all_warnings

    accepted = {
        "candidate_id": record["candidate_id"],
        "proposed_registry_status": record.get("proposed_registry_status"),
        "validation_level_passed": highest_level_passed(all_errors),
        "production_allowed": False,
    }
    return accepted, all_errors, all_warnings


def load_fixture_records(fixture_path: Path) -> list[dict[str, Any]]:
    with fixture_path.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    records: list[dict[str, Any]] = []
    positive = payload.get("positive_examples_by_tier") or {}
    for record in positive.values():
        records.append(record)

    for negative in payload.get("negative_examples") or []:
        record = negative.get("record") or {}
        record["_fixture_label"] = negative.get("_label")
        records.append(record)

    return records


def run_prototype(fixture_path: Path, output_path: Path) -> dict[str, Any]:
    records = load_fixture_records(fixture_path)

    accepted_candidates: list[dict[str, Any]] = []
    validation_errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for record in records:
        accepted, errors, record_warnings = validate_record(record)
        validation_errors.extend(errors)
        warnings.extend(record_warnings)
        if accepted is not None:
            accepted_candidates.append(accepted)

    output = {
        "_output_metadata": {
            "phase": "XRI-G4",
            "mode": "sample_only_prototype_only_not_production_not_approved_not_registry",
            "warning": (
                "SAMPLE ONLY / PROTOTYPE ONLY — not production, not approved, not registry. "
                "Not consumed by runtime code."
            ),
            "generated_at": utc_now_iso(),
            "fixture_file_read": str(fixture_path.relative_to(REPO_ROOT)),
            "production_allowed_from_g4": False,
            "records_processed": len(records),
        },
        "accepted_candidates": accepted_candidates,
        "validation_errors": validation_errors,
        "warnings": warnings,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(output, handle, indent=2)
        handle.write("\n")

    return {
        "accepted_candidates_count": len(accepted_candidates),
        "validation_errors_count": len(validation_errors),
        "warnings_count": len(warnings),
        "records_processed": len(records),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="XRI-G4 read-only candidate extractor prototype")
    parser.add_argument(
        "--fixture",
        type=Path,
        default=DEFAULT_FIXTURE,
        help="G3 sample fixture file (only permitted input)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Sample output path under data/reports/",
    )
    args = parser.parse_args()

    fixture_path = args.fixture.resolve()
    output_path = args.output.resolve()

    allowed_fixture = DEFAULT_FIXTURE.resolve()
    if fixture_path != allowed_fixture:
        print(
            f"ERROR: prototype may read only {allowed_fixture}",
            file=sys.stderr,
        )
        return 1

    if not fixture_path.is_file():
        print(f"ERROR: fixture not found: {fixture_path}", file=sys.stderr)
        return 1

    reports_dir = (REPO_ROOT / "data/reports").resolve()
    try:
        output_path.relative_to(reports_dir)
    except ValueError:
        print("ERROR: output must be under data/reports/", file=sys.stderr)
        return 1

    summary = run_prototype(fixture_path, output_path)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
