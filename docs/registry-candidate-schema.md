# Registry Candidate Schema Reference (XRI-G2)

Status: **schema design only**. No registry database. No importers. Companion to `docs/registry-source-inventory-and-candidate-schema.md`.

This document defines the **candidate record** shape used between source inventory (G1/G2) and future registry build phases (G3+). A candidate is a proposed registry entry derived from an existing asset — not an approved registry record.

## Candidate record fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `candidate_id` | string | yes | Stable UUID or prefixed slug, e.g. `nycif-cand-00001234`. Generated at extract time; never reused after rejection. |
| `source_repo` | string | yes | Origin repo, e.g. `setoxxx/nycif-live-feeds`. |
| `source_path` | string | yes | Path within source repo, e.g. `data/location_cache.json`. |
| `source_asset_type` | string | yes | G1 taxonomy value: `location_cache`, `approved_override`, etc. |
| `source_record_id` | string \| null | no | Row/id within source file when applicable. |
| `source_dataset_id` | string \| null | no | SODA dataset id when applicable, e.g. `cpcm-i88g`, `tvpp-9vvx`. |
| `source_key` | string | yes | Original lookup key or composite id in source asset. |
| `raw_name` | string | yes | Unnormalized display text from source. |
| `canonical_name` | string \| null | no | Proposed official/editorial name after normalization review. |
| `alternate_names` | string[] | no | Aliases observed in source or cross-refs. |
| `normalized_name` | string | yes | Output of normalization pipeline (`docs/location-matching-rules.md`). |
| `normalized_location_key` | string | yes | Deterministic registry lookup key for dedup/conflict checks. |
| `registry_type` | enum | yes | Target registry type: `venue`, `park`, `park_asset`, `intersection`, `street_segment`, `address_point`, etc. |
| `borough` | string \| null | no | Canonical borough name when known. |
| `neighborhood` | string \| null | no | Optional neighborhood hint. |
| `address` | string \| null | no | Street address when applicable. |
| `cross_streets` | string[] \| null | no | For intersections. |
| `street_name` | string \| null | no | For segments/addresses. |
| `from_street` | string \| null | no | Segment start cross street. |
| `to_street` | string \| null | no | Segment end cross street. |
| `park_id` | string \| null | no | NYC Parks id when known, e.g. `B073`. |
| `venue_id` | string \| null | no | Source venue identifier when known. |
| `lat` | number \| null | no | Proposed latitude; null if source lacks coords. |
| `lng` | number \| null | no | Proposed longitude. |
| `geometry_type` | enum | yes | `point`, `line`, `polygon`, `centroid`, `unknown`. |
| `geometry_source` | string | yes | e.g. `location_cache`, `cpcm-i88g`, `nyc_geosearch`, `manual_override`. |
| `coordinate_quality` | enum | yes | `approved`, `provisional`, `review_only`, `missing`. |
| `source_approval_status` | string | yes | Status in source asset, e.g. `approved`, `proposed_exact_match`, `pending`, `geocoded`. |
| `proposed_registry_status` | enum | yes | G2 candidate disposition; see status rules below. |
| `match_status` | string \| null | no | If derived from SODA match pipeline: `approved_exact`, `possible_match`, etc. |
| `provenance` | object | yes | `{ "source_tier": 0-3, "source_phase": "...", "extracted_by": "...", "source_version": "..." }` |
| `confidence` | number | yes | 0.0–1.0 advisory score; does not override status gates. |
| `conflict_flags` | string[] | no | Active conflict codes; see conflict model. |
| `duplicate_group_id` | string \| null | no | Links candidates sharing normalized key or coordinate cluster. |
| `source_last_seen_at` | ISO8601 \| null | no | Timestamp from source record when available. |
| `generated_at` | ISO8601 | yes | Candidate extraction/generation timestamp. |
| `notes` | string \| null | no | Operator or extractor notes. |

**Field count:** 37 defined fields.

## Candidate statuses (`proposed_registry_status`)

| Status | Meaning | Production |
|---|---|---|
| `seed_approved_candidate` | Eligible for future registry seeding review; source has strong approval signals | **Not production-approved** |
| `needs_schema_review` | Useful data but field mapping or type assignment uncertain | Blocked |
| `possible_duplicate` | Shares normalized key or coords with another candidate | Blocked until dedup |
| `coordinate_conflict` | Same key, incompatible coordinates across sources | Blocked |
| `source_missing` | Referenced source file or record absent | Blocked |
| `raw_unapproved` | Raw or needs-review source; no approval path | Blocked |
| `excluded_runtime_patch` | Derived from client-side runtime patch assets | Blocked |
| `excluded_public_feed_output` | Derived from production feed row without traceable approval | Blocked |
| `rejected` | Human or rule rejection | Blocked |

### Production rule (G2)

**No XRI-G2 candidate is production-approved.**

`seed_approved_candidate` means only “eligible for future registry seeding review,” not approved for production publishing. Production still requires G0 match statuses `approved_exact` or `approved_source_override` after explicit Howard-gated phases (G8–G10).

## Example candidate (illustrative only)

```json
{
  "candidate_id": "nycif-cand-example-00001",
  "source_repo": "setoxxx/nycif-live-feeds",
  "source_path": "data/location_cache.json",
  "source_asset_type": "location_cache",
  "source_record_id": null,
  "source_dataset_id": null,
  "source_key": "cemsid:914695|queens",
  "raw_name": "Flushing Meadows Corona Park",
  "canonical_name": "Flushing Meadows Corona Park",
  "alternate_names": [],
  "normalized_name": "flushing meadows corona park",
  "normalized_location_key": "park|queens|flushing meadows corona park",
  "registry_type": "park",
  "borough": "Queens",
  "neighborhood": null,
  "address": null,
  "cross_streets": null,
  "street_name": null,
  "from_street": null,
  "to_street": null,
  "park_id": null,
  "venue_id": null,
  "lat": 40.739312,
  "lng": -73.842193,
  "geometry_type": "point",
  "geometry_source": "location_cache",
  "coordinate_quality": "provisional",
  "source_approval_status": "geocoded",
  "proposed_registry_status": "seed_approved_candidate",
  "match_status": null,
  "provenance": {
    "source_tier": 0,
    "source_phase": "Phase 1 / Phase 2E",
    "extracted_by": "future G4 extractor",
    "source_version": "2026-07-01"
  },
  "confidence": 0.7,
  "conflict_flags": [],
  "duplicate_group_id": null,
  "source_last_seen_at": null,
  "generated_at": "2026-07-01T00:00:00.000Z",
  "notes": "Illustrative G2 example only; not extracted from live data in this phase."
}
```

## Relationship to registry record schema (G0)

When a candidate graduates through G6–G8 approval, it maps to the production registry record in `docs/master-location-registry-design.md`:

| Candidate field | Registry field |
|---|---|
| `candidate_id` | preserved in provenance / notes |
| `normalized_location_key` | `normalized_location_key` |
| `registry_type` | `registry_type` |
| `lat` / `lng` | `lat` / `lng` (after approval) |
| `proposed_registry_status` | becomes `approval_status` after human gate |
| — | new `registry_id` assigned at seed time |
| — | `version` starts at 1 |
