# Read-Only Candidate Extractor Prototype (XRI-G4)

Status: **OPEN ONLY**. Read-only prototype only. Sample/report outputs only. No source writes. No production writes.

Machine-readable report:

- `data/reports/read_only_candidate_extractor_prototype_report.json`

Prototype script (fixture input only):

- `tools/xri/read_only_candidate_extractor_prototype.py`

Sample prototype output (not consumed by runtime):

- `data/reports/read_only_candidate_extractor_prototype_output.sample.json`

Prior phases:

- XRI-G0 — registry design (PR #46)
- XRI-G1 — asset inventory (PR #47)
- XRI-G2 — source tiers and candidate schema (PR #48)
- XRI-G3 — candidate schema fixtures and validation contract (PR #49)

**PR contract:** This phase ends **OPEN ONLY**. The PR must **not** be merged without a ChatGPT **MERGE** verdict for the specific PR number and final changed-file list. Safe file scope is necessary but is **not** merge permission.

## 1. Executive summary

XRI-G4 implements a **read-only prototype** that validates G3 candidate fixture records against the G3 validation levels (0–3) and emits the future extractor output contract: `accepted_candidates`, `validation_errors`, and `warnings`.

The prototype:

- Reads **only** `data/fixtures/registry-candidate-fixtures.sample.json`
- Processes **17 fixture records** (7 positive tier examples + 10 negative examples)
- Writes **sample output only** under `data/reports/`
- Sets `production_allowed_from_g4` to **false**
- Does **not** read real caches, feeds, APIs, or source assets
- Does **not** create a registry database or importer

**No G4 candidate is production-approved.** Accepted candidates are validation-pass only.

## 2. Scope and prohibitions

### In scope

- Read-only prototype script against G3 sample fixtures
- Validation levels 0–3 implementation
- Sample output JSON under `data/reports/`
- Design documentation and machine-readable report

### Prohibited (G4 compliance)

| Prohibition | Status |
|---|---|
| Registry database | Not created |
| Importer | Not implemented |
| Read real source assets (caches, feeds, runtime) | Not performed |
| Read `data/location_cache.json` | Not read |
| Modify `location_cache.json` | Not touched |
| Modify production feeds | Not touched |
| Modify map runtime / service worker | Not touched |
| WordPress / iframe / embed | Not touched |
| Scheduled workflows | Not touched |
| Live staging | Not executed |
| External APIs / SODA fetch | Not called |
| Geocode / invent coordinates / approve matches | Not performed |
| Wire output into runtime | **Not wired** |
| Cache reconciliation | Not executed |
| Merge this PR without ChatGPT MERGE verdict | **Forbidden** |

## 3. Relationship to XRI-G0 through XRI-G3

| Phase | Contribution to G4 |
|---|---|
| **G0** | Registry record types, production publish rule (`approved_exact` / `approved_source_override` only) |
| **G1** | 91 assets catalogued; high-risk assets flagged; dual cache identified |
| **G2** | 37-field candidate schema; source tiers 0–3; 9 candidate statuses |
| **G3** | Fixtures, validation levels 0–3 contract, enum contract, output contract stub |
| **G4** | Prototype implements G3 validator + extractor output shape against sample fixtures only |

G4 does not advance to G5 implementation. It only proves the validation/output contract is executable in prototype form.

## 4. What the prototype reads

**Single permitted input:**

| File | Purpose |
|---|---|
| `data/fixtures/registry-candidate-fixtures.sample.json` | G3 sample/test fixtures only |

The prototype **must not** read:

- `data/location_cache.json`
- Production feed JSON
- Public map runtime files
- Workflow files
- WordPress files
- Live staging files
- External APIs or SODA endpoints
- Remote URLs

## 5. What the prototype writes

**Sample/report outputs only** under `data/reports/`:

| File | Purpose |
|---|---|
| `read_only_candidate_extractor_prototype_output.sample.json` | Prototype run output (accepted/errors/warnings) |
| `read_only_candidate_extractor_prototype_report.json` | Phase compliance report (this phase metadata) |

All outputs are labeled:

- sample only
- prototype only
- not production
- not approved
- not registry

No output is consumed by runtime code.

## 6. Validation levels implemented

### Level 0 — Shape validation

- Required fields per G3 contract
- Enum validation for `proposed_registry_status`, `registry_type`, `geometry_type`, `coordinate_quality`, `source_asset_type`
- Type checks for `confidence`, `provenance`

### Level 1 — Coordinate validation

- `lat`/`lng` pair completeness
- Numeric type and global range checks
- Advisory NYC bounds warning
- `geometry_source` required when coordinates exist (not `none`)
- `coordinate_quality` must not be `missing` when coordinates exist

### Level 2 — Provenance validation

- `source_repo` and `source_path` required
- `provenance.source_tier` required (0–3)
- `seed_approved_candidate` requires `extracted_by`, `source_phase`, `source_version`, `not_production_approved=true`
- Tier 3 cannot have `seed_approved_candidate`

### Level 3 — Safety/publishing validation

- `production_allowed` always **false**
- Forbidden fields: `production_approved`, `publish_allowed`, etc.
- Blocked statuses: `raw_unapproved`, `possible_duplicate`, `coordinate_conflict`, `source_missing`, `excluded_runtime_patch`, `excluded_public_feed_output`, `rejected`
- Blocked match statuses: `possible_match`, `conflict`, `unmatched`, `rejected`
- `map_runtime` + `seed_approved_candidate` → fail
- Production `feed_output` + `seed_approved_candidate` → fail
- `source_missing` with coordinates → fail (invented coords)

## 7. Accepted candidates output contract

Candidates passing levels 0–3 without blocking errors appear in `accepted_candidates`:

```json
{
  "candidate_id": "nycif-cand-fixture-tier0-00001",
  "proposed_registry_status": "seed_approved_candidate",
  "validation_level_passed": 3,
  "production_allowed": false
}
```

**Prototype results (G3 fixtures):** 3 accepted (Tier 0, Tier 1, Tier 2 positive examples).

Accepted means validation-pass only — **not production-approved**.

## 8. Validation errors output contract

```json
{
  "candidate_id": "nycif-cand-invalid-00003",
  "source_path": "data/location_cache.json",
  "error_code": "COORD_INCOMPLETE_PAIR",
  "error_message": "lat and lng must both be present or both null",
  "severity": "error",
  "validation_level": 1
}
```

**Prototype results (G3 fixtures):** 23 validation errors across Tier 3 positive examples and all 10 negative examples (some records produce multiple errors).

## 9. Warnings output contract

```json
{
  "candidate_id": "nycif-cand-fixture-tier1-00001",
  "conflict_flags": [],
  "recommended_review_action": "reconcile_phase_2e_before_seed",
  "severity": "warning",
  "message": "Phase 2E reconciliation required before seed eligibility"
}
```

**Prototype results (G3 fixtures):** 4 warnings (schema review, Phase 2E reconciliation, seeding-review-only notices).

## 10. Safety/publishing rules

| Rule | G4 enforcement |
|---|---|
| `production_allowed_from_g4` | **false** |
| G4 output in production | **forbidden** — sample/prototype only |
| `seed_approved_candidate` in accepted list | future seeding review eligibility only |
| Fixture file mutation | **never** |
| Source asset writes | **never** |
| Runtime wiring | **never** |

## 11. Not a registry database

This phase does **not** create:

- A registry database
- Registry seed files
- Production registry records
- Approved override tables

Output is validation/report JSON only.

## 12. Not a production extractor

This phase does **not**:

- Read real `location_cache.json` or feed files
- Extract candidates from live source assets
- Auto-approve or promote candidates
- Publish to feeds or map runtime

The script is a **prototype** demonstrating the G3 contract against sample fixtures.

## 13. No real source assets read

| Asset class | Read by G4 prototype? |
|---|---|
| G3 sample fixture file | **Yes** (only permitted input) |
| `data/location_cache.json` | **No** |
| Production feed JSON | **No** |
| Public map runtime | **No** |
| Workflows / WordPress | **No** |
| External APIs / SODA | **No** |

`real_source_assets_read`: **false**

## 14. Future roadmap

| Phase | Scope | G4 relationship |
|---|---|---|
| **XRI-G5** | Cache reconciliation report | Uses validation output contract |
| **XRI-G6** | Registry candidate preview artifact | Consumes accepted_candidates |
| **XRI-G7** | Field-desk review UI contract | Displays warnings + errors |
| **XRI-G8** | Approved registry seed PR | Howard approval required |
| **XRI-G9** | Preview feed integration | Howard approval required |
| **XRI-G10** | Production feed integration | Howard approval required |
| **XRI-G11** | WordPress/platform coordination | Separate approval required |

## 15. OPEN ONLY — merge gate

| Item | Value |
|---|---|
| Merge permission | **None** |
| PR state required | **Open** |
| Merge requires | ChatGPT **MERGE** verdict for specific PR number + final changed-file list |
| Safe file scope alone | **Not sufficient** for merge |

**Waiting for Howard/ChatGPT review.**

## Safety confirmation

| Check | Result |
|---|---|
| Registry database created | **false** |
| Importer implemented | **false** |
| Fixtures wired to runtime | **false** |
| `location_cache.json` read | **false** |
| `location_cache.json` modified | **false** |
| Production feeds modified | **false** |
| Public map runtime modified | **false** |
| WordPress modified | **false** |
| Scheduled workflows modified | **false** |
| Live staging executed | **false** |
| External APIs called | **false** |
| SODA fetched | **false** |
| `production_allowed_from_g4` | **false** |
| Only allowed G4 files changed | **true** |

## Next step

**XRI-G5** — Cache reconciliation report (no merge): design-only dual-cache reconciliation report using G4 validation output contract — still no cache merge or source writes.
