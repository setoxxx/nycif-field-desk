# XRI-G8 — Review Artifact Schema + Fixture Validator

## 1. Executive summary

XRI-G8 creates the first offline review-artifact schema and fixture validator for the NYCIF XRI Master Location Registry project.

This phase turns the XRI-G7 operator decision model into a concrete, machine-checkable review artifact format. It remains non-production. It does not create registry rows, write feeds, update the public map, modify WordPress, approve geocodes, promote candidates, or touch `data/location_cache.json`.

## 2. Project completion

- Completion before G8: 70%
- Expected completion after clean G8 merge: 78%

## 3. Relationship to previous phases

- XRI-G6 created preview-only registry candidate artifacts.
- XRI-G7 defined review states, operator actions, hard blocks, soft warnings, and the final-gate model.
- XRI-G8 makes those rules testable through a schema, fixtures, and an offline validator.

## 4. What this unlocks

G8 unlocks an explicit review-artifact contract for G9.

After G8, the project can create a registry seed artifact only from candidates that have a valid review artifact and remain non-production until a later final gate.

## 5. Files added

- `data/schemas/registry_candidate_review.schema.json`
- `data/fixtures/registry_candidate_review_fixtures.sample.json`
- `tools/xri/validate_registry_candidate_review_fixture.py`
- `data/reports/review_artifact_schema_fixture_validator_report.json`
- `docs/review-artifact-schema-fixture-validator.md`
- `data/reports/xri_project_status.json`

## 6. Review states covered

The schema supports the G7 review states:

- `pending_review`
- `needs_more_evidence`
- `conflict_hold`
- `duplicate_hold`
- `borough_mismatch_hold`
- `coordinate_conflict_hold`
- `rejected`
- `excluded`
- `seed_eligible_pending_final_gate`

## 7. Operator actions covered

The schema supports only non-production operator actions:

- `mark_needs_more_evidence`
- `mark_duplicate_hold`
- `mark_conflict_hold`
- `mark_borough_mismatch_hold`
- `mark_coordinate_conflict_hold`
- `mark_rejected`
- `mark_excluded`
- `mark_seed_eligible_pending_final_gate`

The schema does not include production actions such as publish, approve geocode, write cache, or promote candidate.

## 8. Evidence model

Each review record must track whether these evidence elements are present:

- source identity
- source path / provenance
- normalized name
- borough confidence
- location confidence
- coordinate provenance
- duplicate check
- conflict check
- operator note

A candidate cannot be marked `seed_eligible_pending_final_gate` unless all required evidence is present and no hard blocks remain.

## 9. Hard block handling

The fixture validator blocks seed eligibility when hard blocks exist.

Hard block categories include:

- coordinate conflict
- duplicate conflict
- borough mismatch
- missing source identity
- missing provenance
- rejected or excluded source
- unclear location text
- public map flag true before final gate

## 10. Safety guarantees

G8 does not:

- modify `data/location_cache.json`
- read production feed JSON
- write production feed JSON
- touch public map runtime files
- touch WordPress
- touch iframe/embed settings
- touch scheduled workflows
- run live staging
- call external APIs
- fetch SODA data
- approve geocodes
- promote candidates
- create a registry database
- create a production importer
- add runtime wiring

## 11. Validator behavior

The validator is:

- offline-only
- fixture-only
- standard-library Python
- non-mutating
- not connected to runtime
- not connected to production feeds or public map output

Command:

```bash
python3 tools/xri/validate_registry_candidate_review_fixture.py
```

Expected result:

- exits `0` when fixtures pass
- prints JSON validation summary
- exits `1` when fixture errors are found

## 12. Admin/status page handling

G8 updates only the safe non-public status JSON:

- `data/reports/xri_project_status.json`

No runtime admin page, public admin UI, WordPress file, public map file, or service worker is modified.

## 13. QA agent/check handling

Repo-local QA equivalent for this phase is the offline validator:

```bash
python3 tools/xri/validate_registry_candidate_review_fixture.py
```

The validator does not require prohibited production/public actions.

## 14. Next instruction after G8

After XRI-G8 is merged, ChatGPT should write and execute the XRI-G9 contract:

**XRI-G9 — Registry Seed Artifact, not runtime**

G9 should create the first offline registry seed artifact from valid review artifacts only. G9 must still avoid runtime wiring, public map output, production feeds, WordPress, cache writes, and geocode approvals.

## 15. XRI-G9 is not authorized by this PR

This PR does not authorize XRI-G9 work. G9 requires a new ChatGPT-controlled contract and review gate.
