# Candidate Schema Fixtures and Validation Contract (XRI-G3)

Status: **local/report only**. Fixture/design only. Validation contract only. No extractor. No registry database.

Machine-readable report:

- `data/reports/candidate_schema_fixtures_validation_report.json`

Sample fixtures (test-only, not wired to runtime):

- `data/fixtures/registry-candidate-fixtures.sample.json`

Prior phases:

- XRI-G0 — registry design (PR #46)
- XRI-G1 — asset inventory (PR #47)
- XRI-G2 — source tiers and candidate schema (PR #48)

**Design doc location:** `setoxxx/nycif-field-desk` (cross-repo reference only).

## 1. Executive summary

XRI-G3 proves the G2 37-field candidate schema is **understandable, testable, and review-gated** before any real extractor, importer, registry database, or production integration exists.

Deliverables:

1. **7 positive fixture examples** — one per source tier (Tier 0–3 variants)
2. **10 negative fixture examples** — invalid records that must fail validation
3. **4 validation levels** (0–3) — shape through safety/publishing gates
4. **Enum contract** — allowed values for key fields
5. **Extractor contract stub** — future G4 read-only behavior (not implemented)
6. **Validation output contract** — accepted_candidates, validation_errors, warnings

**No G3 candidate is production-approved.** Fixtures are sample/test-only and not wired to any runtime, feed, map UI, workflow, or production process.

## 2. Scope and prohibitions

### In scope

- Sample candidate JSON fixtures
- Validation level definitions
- Enum contracts
- Extractor and validation output contract stubs
- Negative example documentation
- High-risk asset carry-forward from G2

### Prohibited (G3 compliance)

| Prohibition | Status |
|---|---|
| Registry database | Not created |
| Extractor / importer scripts | Not implemented |
| Read real source assets | Not performed |
| Modify location_cache.json | Not touched |
| Modify production feeds | Not touched |
| Modify map runtime / service worker | Not touched |
| WordPress / iframe / embed | Not touched |
| Scheduled workflows | Not touched |
| Live staging | Not executed |
| Geocode / invent coordinates / approve matches | Not performed |
| Wire fixtures into runtime | **Not wired** |
| Cache reconciliation | Not executed |
| Large SODA fetch | Not performed |

## 3. Relationship to G0/G1/G2

| Phase | Contribution to G3 |
|---|---|
| **G0** | Registry record types, match statuses, production publish rule (`approved_exact` / `approved_source_override` only) |
| **G1** | 91 assets catalogued; dual cache identified; high-risk assets flagged |
| **G2** | 37-field candidate schema; source tiers 0–3; 9 candidate statuses; conflict codes; dual cache reconciliation plan (design only) |
| **G3** | Fixtures + validation contract proving G2 schema is ready for G4 extractor prototype |

G3 does not advance to G4 implementation. It only defines what G4 must obey.

## 4. Candidate fixture examples

All fixtures live in `data/fixtures/registry-candidate-fixtures.sample.json` under `_fixture_metadata.warning: SAMPLE/TEST ONLY`.

### Tier 0 — `seed_approved_candidate`

| Field | Value |
|---|---|
| Fixture ID | `nycif-cand-fixture-tier0-00001` |
| Source | live-feeds `data/location_cache.json` |
| Status | `seed_approved_candidate` |
| Registry type | `park` |
| Provenance | Tier 0, Phase 1/2E, `not_production_approved: true` |

**Note:** Eligible for future seeding review only — **not production publish approval**.

### Tier 1 — pipeline artifact

| Field | Value |
|---|---|
| Fixture ID | `nycif-cand-fixture-tier1-00001` |
| Source | live-feeds `data/gps_reviewed_approval_artifact.json` |
| Status | `needs_schema_review` |
| Registry type | `park_asset` |
| Flags | `phase_2e_reconciliation_required: true` |

### Tier 2 — Parks cpcm-i88g enrichment

| Field | Value |
|---|---|
| Fixture ID | `nycif-cand-fixture-tier2-00001` |
| Source | SODA `cpcm-i88g` (schema sample shape only) |
| Status | `needs_schema_review` |
| Registry type | `park_asset` |
| Join key | `event_id: 100073` |

**Not approved for seed or publish.**

### Tier 3 — raw / problem sources

| Variant | Status | Source |
|---|---|---|
| tvpp needs_review row | `raw_unapproved` | `prototype_major_events_needs_review.json` |
| Runtime patch | `excluded_runtime_patch` | `event-location-corrections-v01.js` |
| Production feed row | `excluded_public_feed_output` | `nycif_all_radar_map_events.json` |
| Missing reference file | `source_missing` | `manual_gps_reference.json` (absent) |

## 5. Negative examples

**10 invalid records** documented in fixture file `negative_examples` array:

| # | Label | Primary error |
|---|---|---|
| 1 | `missing_candidate_id` | SHAPE_MISSING_REQUIRED_FIELD |
| 2 | `missing_source_repo_and_path` | PROVENANCE_MISSING_SOURCE |
| 3 | `lat_without_lng` | COORD_INCOMPLETE_PAIR |
| 4 | `coordinates_without_geometry_source` | COORD_MISSING_GEOMETRY_SOURCE |
| 5 | `seed_approved_without_provenance` | PROVENANCE_INSUFFICIENT_FOR_SEED |
| 6 | `production_approval_implied` | SAFETY_PRODUCTION_APPROVAL_FORBIDDEN |
| 7 | `possible_match_treated_as_publishable` | SAFETY_BLOCKED_STATUS_PUBLISH_ATTEMPT |
| 8 | `runtime_patch_as_authoritative` | SAFETY_RUNTIME_PATCH_AS_SOURCE |
| 9 | `public_feed_as_source_of_truth` | SAFETY_FEED_AS_SOURCE_OF_TRUTH |
| 10 | `source_missing_with_invented_coords` | SAFETY_INVENTED_COORDINATES |

## 6. Validation levels

G3 defines levels only — **no validator implemented**.

### Level 0 — Shape validation

| Check | Rule |
|---|---|
| Required fields | `candidate_id`, `source_repo`, `source_path`, `source_asset_type`, `source_key`, `raw_name`, `normalized_name`, `normalized_location_key`, `registry_type`, `geometry_type`, `geometry_source`, `coordinate_quality`, `source_approval_status`, `proposed_registry_status`, `provenance`, `confidence`, `generated_at` |
| Enum values | `proposed_registry_status`, `registry_type`, `geometry_type`, `coordinate_quality`, `source_asset_type` must be in allowed sets |
| Type checks | strings, numbers, arrays, objects per schema |

### Level 1 — Coordinate validation

| Check | Rule |
|---|---|
| Pair completeness | `lat` and `lng` both present or both null |
| Numeric | lat/lng are numbers when present |
| Latitude range | -90 to 90 |
| Longitude range | -180 to 180 |
| NYC bounds (advisory) | lat 40.45–40.95, lng -74.30–-73.65 for NYC candidates |
| geometry_source | required and not `none` when coordinates exist |
| coordinate_quality | required when coordinates exist; not `missing` if coords present |

### Level 2 — Provenance validation

| Check | Rule |
|---|---|
| source_repo | required, non-empty |
| source_path | required, non-empty |
| source_asset_type | required, valid enum |
| source_approval_status | required |
| provenance object | required with `source_tier` (0–3) |
| seed_approved_candidate | requires `provenance.extracted_by`, `provenance.source_phase`, `provenance.source_version`; `provenance.not_production_approved` must be true |
| Tier consistency | Tier 3 sources cannot have `seed_approved_candidate` without explicit override adjudication |

### Level 3 — Safety/publishing validation

| Check | Rule |
|---|---|
| production_allowed | always **false** at G3 |
| Forbidden fields | reject records with `production_approved`, `publish_allowed`, or equivalent |
| Blocked statuses | `raw_unapproved`, `possible_duplicate`, `coordinate_conflict`, `source_missing`, `excluded_runtime_patch`, `excluded_public_feed_output`, `rejected` → never publish |
| match_status gate | `possible_match`, `conflict`, `unmatched` → never publish |
| Runtime patch block | `map_runtime` source with `seed_approved_candidate` → fail |
| Feed as truth block | `feed_output` from production paths with `seed_approved_candidate` → fail |
| Invented coords | `source_missing` with non-null lat/lng → fail |

## 7. Enum contract

### source_asset_type

`location_cache`, `approved_override`, `geocode_audit_report`, `match_sample_report`, `feed_output`, `source_adapter`, `feed_generator`, `validation_script`, `review_ui`, `map_runtime`, `staging_gate`, `documentation`, `rollback_snapshot`, `parks_event_locations`, `unknown_location_related_asset`

### proposed_registry_status

`seed_approved_candidate`, `needs_schema_review`, `possible_duplicate`, `coordinate_conflict`, `source_missing`, `raw_unapproved`, `excluded_runtime_patch`, `excluded_public_feed_output`, `rejected`

### match_status

`approved_exact`, `approved_source_override`, `possible_match`, `conflict`, `unmatched`, `rejected`, `not_applicable`

### conflict_flags

`same_key_different_coordinates`, `same_coordinates_different_name`, `same_name_different_borough`, `missing_borough_ambiguous`, `source_override_conflict`, `runtime_patch_conflict`, `public_feed_untraceable_coordinate`, `referenced_source_missing`, `duplicate_candidate`

### registry_type

`venue`, `park`, `park_asset`, `intersection`, `street_segment`, `address_point`, `neighborhood`, `borough`, `source_specific_override`, `manual_editorial_override`, `unknown`

### geometry_type

`point`, `line`, `polygon`, `centroid`, `unknown`

### coordinate_quality

`approved`, `provisional`, `review_only`, `missing`

## 8. Extractor contract stub (G4 — not implemented)

Future read-only candidate extractor must:

| Requirement | Rule |
|---|---|
| Mode | Read-only; no source file writes |
| Output | Candidate preview artifacts only (JSON reports) |
| location_cache | Never modify in any repo |
| Production feeds | Never modify |
| Approval | Never auto-approve candidates |
| Publishing | Never publish |
| Provenance | Attach full provenance to every candidate |
| Errors | Emit validation_errors separately from accepted_candidates |
| Blocked sources | Auto-block: runtime patches, production feed outputs, missing sources with invented data |
| Tier assignment | Copy G2 tier rules |
| Status assignment | Copy G2/G3 status rules; default Tier 2/3 to non-seed statuses |

**G3 does not write extractor code.**

## 9. Validation output contract

Future validator (G4+) produces three arrays:

### accepted_candidates

Candidates passing Level 0–2 validation. Still **not production-approved**.

```json
{
  "candidate_id": "nycif-cand-...",
  "proposed_registry_status": "seed_approved_candidate",
  "validation_level_passed": 2,
  "production_allowed": false
}
```

### validation_errors

```json
{
  "candidate_id": "nycif-cand-invalid-00003",
  "source_path": "data/location_cache.json",
  "error_code": "COORD_INCOMPLETE_PAIR",
  "error_message": "lat present without lng",
  "severity": "error",
  "validation_level": 1
}
```

### warnings

Valid records with elevated risk:

```json
{
  "candidate_id": "nycif-cand-fixture-tier1-00001",
  "conflict_flags": [],
  "recommended_review_action": "reconcile_phase_2e_before_seed",
  "severity": "warning"
}
```

## 10. Safety/publishing rules

| Rule | G3 enforcement |
|---|---|
| `production_allowed_from_g3` | **false** |
| G3 fixtures in production | **forbidden** — sample/test only |
| seed_approved_candidate | future seeding review eligibility only |
| G0 production match statuses | still required at G10 for feed publish |
| Fixture wiring | must not appear in map runtime, feeds, workflows, or CI |

## 11. High-risk assets carried forward

G3 does not edit these; documented for G4+ awareness:

| Asset | Risk | G3 fixture treatment |
|---|---|---|
| `event-location-corrections-v01.js` | Runtime coord patch | `excluded_runtime_patch` example |
| `build-nightlife-pins.mjs` | Writes field-desk cache | Not referenced in fixtures |
| `build_gps_repository.py` | Writes live-feeds cache | Not referenced in fixtures |
| `nycif_*_radar_map_events.json` | Production feed surface | `excluded_public_feed_output` example |
| `live-sync-qa.yml` | Scheduled contents:write | Documented only |
| `manual_gps_reference.json` | Missing | `source_missing` example, no invented data |
| web-platform export/staging writers | High risk | Documented only |

## 12. Future roadmap

| Phase | Scope | G3 relationship |
|---|---|---|
| **XRI-G4** | Read-only candidate extractor prototype | Implements extractor contract stub |
| **XRI-G5** | Cache reconciliation report | Uses validation output contract |
| **XRI-G6** | Registry candidate preview artifact | Consumes accepted_candidates |
| **XRI-G7** | Field-desk review UI contract | Displays warnings + errors |
| **XRI-G8** | Approved registry seed PR | Howard approval required |
| **XRI-G9** | Preview feed integration | Howard approval required |
| **XRI-G10** | Production feed integration | Howard approval required |
| **XRI-G11** | WordPress/platform coordination | Separate approval required |

## 13. Safety confirmation

| Check | Result |
|---|---|
| Registry database created | **false** |
| Extractor implemented | **false** |
| Importer implemented | **false** |
| Fixtures wired to runtime | **false** |
| location_cache.json modified | **false** |
| Production feeds modified | **false** |
| Public map runtime modified | **false** |
| WordPress modified | **false** |
| Scheduled workflows modified | **false** |
| Live staging executed | **false** |
| production_allowed_from_g3 | **false** |

## Next step

**XRI-G4** — Read-only candidate extractor prototype (no source writes): implement G3 validation levels against read-only source samples; emit accepted_candidates / validation_errors / warnings JSON reports only.
