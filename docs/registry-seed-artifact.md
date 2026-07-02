# XRI-G9 — Registry Seed Artifact, Not Runtime

## 1. Executive summary

XRI-G9 creates the first offline sample registry seed artifact for the NYCIF XRI Master Location Registry project.

This phase does not create a production registry database, does not wire the public map, does not write production feeds, does not touch WordPress, does not modify `data/location_cache.json`, and does not approve geocodes.

The seed artifact is a controlled sample derived only from G8-valid review fixture shape. It exists to make the future registry seed format concrete before any runtime lookup phase.

## 2. Project completion

- Completion before G9: 78%
- Expected completion after clean G9 merge: 88%

## 3. Relationship to previous phases

- XRI-G6 created preview-only candidate artifacts.
- XRI-G7 defined operator review decisions and hard-block rules.
- XRI-G8 created a review artifact schema, sample fixtures, and an offline review fixture validator.
- XRI-G9 creates an offline seed artifact from review-fixture records that demonstrate `seed_eligible_pending_final_gate` with all required evidence and no hard blocks.

## 4. What this unlocks

G9 unlocks XRI-G10: a read-only lookup prototype.

After G9, the project has a stable offline seed file that a future lookup prototype can read without touching runtime, feeds, WordPress, the public map, or `location_cache.json`.

## 5. Files added

- `data/registry/registry_seed.sample.json`
- `tools/xri/validate_registry_seed_sample.py`
- `data/reports/registry_seed_artifact_report.json`
- `docs/registry-seed-artifact.md`
- `data/reports/xri_project_status.json`

## 6. Seed inclusion policy

A review record may appear in the seed artifact only when:

- review state is `seed_eligible_pending_final_gate`
- all required evidence values are true
- hard blocks are empty
- source identity exists
- source path / provenance exists
- duplicate review is complete
- conflict review is complete
- operator note exists
- production permission remains false
- public-map permission remains false

## 7. Exclusion policy

Review records are excluded when they remain in:

- `needs_more_evidence`
- `duplicate_hold`
- `coordinate_conflict_hold`
- `borough_mismatch_hold`
- `conflict_hold`
- `rejected`
- `excluded`

The seed artifact stores an `excluded_review_records` section so blocked examples remain auditable.

## 8. Validator behavior

The offline validator reads only:

- `data/registry/registry_seed.sample.json`

Command:

```bash
python3 tools/xri/validate_registry_seed_sample.py
```

It validates:

- artifact type and phase
- production/public/runtime flags are false
- seed IDs are unique
- seed records have no hard blocks
- required evidence is present
- seed records remain offline-only
- next allowed step is G10 read-only lookup prototype only

## 9. Safety guarantees

G9 does not:

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
- create a production registry database
- create a production importer
- add runtime wiring

## 10. Admin/status handling

G9 updates only:

- `data/reports/xri_project_status.json`

No runtime admin UI or public app file is modified.

## 11. Next instruction after G9

After XRI-G9 is merged, ChatGPT should write and execute the XRI-G10 contract:

**XRI-G10 — Read-Only Registry Lookup Prototype**

G10 should read `data/registry/registry_seed.sample.json` and demonstrate lookup outcomes without runtime wiring, public map changes, production feeds, WordPress, cache writes, geocode approvals, or candidate promotion.

## 12. XRI-G10 is not authorized by this PR

This PR does not authorize XRI-G10 work. G10 requires a new ChatGPT-controlled execution step and review gate.
