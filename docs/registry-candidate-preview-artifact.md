# Registry Candidate Preview Artifact (XRI-G6)

Status: **OPEN ONLY**. Preview artifact only. Not production. No runtime wiring. No public publishing.

Machine-readable report:

- `data/reports/registry_candidate_preview_report.json`

Preview artifact (sample only, not consumed by runtime):

- `data/previews/registry_candidate_preview.sample.json`

Project status (admin-safe JSON, not public map):

- `data/reports/xri_project_status.json`

Prior phases:

- XRI-G0 — registry design (PR #46)
- XRI-G1 — asset inventory (PR #47)
- XRI-G2 — source tiers and candidate schema (PR #48)
- XRI-G3 — candidate schema fixtures and validation contract (PR #49)
- XRI-G4 — read-only candidate extractor prototype (PR #66)
- XRI-G5 — cache reconciliation report (PR #67)

**PR contract:** This phase ends **OPEN ONLY**. The PR must **not** be merged without a ChatGPT **MERGE** verdict for the specific PR number and final changed-file list. Safe file scope is necessary but is **not** merge permission.

## 1. Executive summary

XRI-G6 produces the **first concrete preview artifact** demonstrating how future NYCIF Master Location Registry candidates will be structured, classified, blocked, and staged before any production use.

The preview artifact:

- Contains **11 sample records** across **4 preview groups**
- Follows the G2/G3 candidate schema with G6 preview extensions (`preview_status`, `provenance_summary`, `review_required`, `next_review_action`)
- Sets `production_allowed: false` and `public_map_allowed: false` on every record
- Is **not** a registry seed file, **not** approved geocodes, and **not** wired to runtime

G6 moves the project from pure reports (G0–G5) toward an actual reviewable candidate-preview layer while remaining fully offline and non-production.

## 2. Current project completion estimate: 55%

Before XRI-G6 merge, the NYCIF XRI Master Location Registry project is estimated at **55%** completion (design, inventory, schema, fixtures, validation contract, read-only extractor prototype, and cache reconciliation report are merged; no production registry, importer, or feed integration exists).

## 3. Expected completion after merge: 65%

After a clean XRI-G6 merge, the estimate rises to **65%** — reflecting the first concrete candidate-preview artifact and operator-review scaffolding, while implementation phases (G7–G11) remain ahead.

## 4. Relationship to XRI-G0 through XRI-G5

| Phase | Contribution to G6 |
|---|---|
| **G0** | Registry record types, match statuses, production publish rule |
| **G1** | 91 assets catalogued; dual cache identified; source paths for preview provenance |
| **G2** | 37-field candidate schema; 9 candidate statuses; conflict codes |
| **G3** | Positive/negative fixtures; validation levels 0–3; blocked status definitions |
| **G4** | Validation output contract; accepted vs blocked candidate classification |
| **G5** | Reconciliation categories; dual-cache conflict signals; overlap analysis gaps |
| **G6** | Preview artifact grouping candidates for operator review — **not production** |

## 5. What XRI-G6 unlocks

XRI-G6 unlocks the **first concrete candidate-preview layer** for the registry:

1. Howard can see what candidate records will look like before they become registry seed records
2. Four preview groups make reviewability explicit (seed-ready, needs-review, conflict-hold, rejected/excluded)
3. Blocked and conflict candidates are visible without promotion risk
4. `next_review_action` on each record clarifies the operator path toward XRI-G7
5. The project transitions from report-only artifacts to a structured preview format future tools can consume

## 6. Preview artifact inputs

Read-only inputs inspected (no mutation):

| Input | Purpose |
|---|---|
| `data/fixtures/registry-candidate-fixtures.sample.json` | G3 positive/negative fixture shapes |
| `data/reports/read_only_candidate_extractor_prototype_output.sample.json` | G4 accepted/blocked classification |
| `data/reports/read_only_candidate_extractor_prototype_report.json` | G4 phase metadata |
| `data/reports/cache_reconciliation_report.json` | G5 dual-cache reconciliation categories |
| `data/reports/cache_reconciliation_summary.sample.json` | G5 conflict category definitions |
| `data/reports/registry_source_inventory_candidate_schema_report.json` | G1/G2 source inventory metadata |
| `data/reports/candidate_schema_fixtures_validation_report.json` | G3 validation contract metadata |
| `docs/registry-candidate-schema.md` | G2 field definitions |
| `docs/candidate-schema-fixtures-and-validation-contract.md` | G3 validation levels |
| `docs/read-only-candidate-extractor-prototype.md` | G4 extractor contract |
| `docs/cache-reconciliation-report.md` | G5 reconciliation design |

**Not read:** `data/location_cache.json` (existence known from G5; not parsed in G6). No production feeds, public map runtime, workflows, WordPress, or external APIs.

## 7. Preview artifact outputs

| Output | Path | Purpose |
|---|---|---|
| Preview artifact | `data/previews/registry_candidate_preview.sample.json` | Sample candidate groups for operator review |
| Design doc | `docs/registry-candidate-preview-artifact.md` | This document |
| JSON report | `data/reports/registry_candidate_preview_report.json` | Machine-readable G6 compliance report |
| Project status | `data/reports/xri_project_status.json` | Admin-safe XRI progress snapshot |

## 8. Candidate preview groups

### `seed_ready_preview` (2 records)

Demonstrates what a future seed-ready record **could** look like after operator review. These are **not** approved for production or registry seed. Both records carry `review_required: true` and `next_review_action` pointing to G7 reconciliation.

### `needs_review_preview` (2 records)

Candidates requiring human/operator review: Tier 1 pipeline artifact needing schema review and Phase 2E reconciliation; Tier 2 enrichment sample needing registry type confirmation.

### `conflict_hold_preview` (3 records)

Blocked candidates illustrating:

- Coordinate conflict across dual-cache families (`coordinate_conflict`)
- Possible duplicate with runtime-patch overlap (`possible_duplicate`)
- Borough ambiguity with missing coordinates (`raw_unapproved` / `missing_borough_ambiguous`)

### `rejected_or_excluded_preview` (4 records)

Excluded from future registry seed:

- Runtime patch source (`excluded_runtime_patch`)
- Public feed output without traceable approval (`excluded_public_feed_output`)
- Missing source file (`source_missing`)
- Rejected after invented-data risk (`rejected`)

## 9. Blocked/rejected candidate handling

Blocked and rejected candidates are **never promoted** in G6:

| Group | Handling |
|---|---|
| `conflict_hold_preview` | Visible for operator review; `production_allowed: false`; `next_review_action` describes adjudication path |
| `rejected_or_excluded_preview` | `rejection_reason` set; `review_required: false`; excluded from seed pipeline |

G4 validation rules apply conceptually: blocked statuses must not appear in any production or seed output.

## 10. Conflict flag handling

Conflict flags from G2/G3/G5 are preserved on preview records:

| Flag | Preview group | Meaning |
|---|---|---|
| `exact_key_different_coordinates` | conflict_hold_preview | Dual-cache coordinate divergence |
| `dual_cache_coordinate_divergence` | conflict_hold_preview | G5 overlap analysis gap |
| `possible_duplicate_key` | conflict_hold_preview | Dedup required |
| `runtime_patch_conflict` | conflict_hold / rejected | Runtime patch vs cache authority |
| `missing_borough_ambiguous` | conflict_hold_preview | Borough missing or inconsistent |
| `cache_only_no_provenance` | conflict_hold_preview | No approval chain |
| `public_feed_untraceable_coordinate` | rejected_or_excluded | Feed row without Tier 0/1 trace |
| `referenced_source_missing` | rejected_or_excluded | Source file absent |
| `invented_data_risk` | rejected_or_excluded | Validation flagged invented coords |

Flags are advisory in the preview artifact; they do not auto-resolve or auto-approve.

## 11. Why this is not production

| Property | G6 value |
|---|---|
| `production_allowed` | **false** on every record and metadata |
| `public_map_allowed` | **false** on every record |
| `registry_seed_approved` | **false** |
| `runtime_wired` | **false** |
| Registry database | Not created |
| Importer / production extractor | Not implemented |
| Cache merge | Not executed |
| Feed modification | Not touched |
| Geocode approval | Not performed |
| Candidate promotion | Not performed |
| External APIs / SODA | Not called |

The preview artifact is labeled **PREVIEW ONLY / SAMPLE ONLY / NOT PRODUCTION** in `_preview_metadata.warnings`.

## 12. Admin/status-page handling

Admin/status page candidates identified:

| Path | Type | G6 action |
|---|---|---|
| `admin/data/project-status.json` | Runtime admin app data | **Not modified** — lives inside admin runtime path |
| `admin/index.html` | Runtime admin UI | **Not modified** |
| `data/reports/xri_project_status.json` | Safe non-public status JSON | **Updated** with G6 phase status |

`admin_page_updated`: **true** (safe path only).

`admin_page_reason`: `updated_safe_non_public_status_json_at_data/reports/xri_project_status.json`

## 13. QA agent/check handling

Repo-local QA check identified:

- **Command:** `python3 tools/xri/read_only_candidate_extractor_prototype.py`
- **Script:** `tools/xri/read_only_candidate_extractor_prototype.py` (XRI-G4 read-only validator)
- **Input:** `data/fixtures/registry-candidate-fixtures.sample.json` only
- **Result:** **pass** — 17 records processed; 3 accepted, 23 validation errors (expected negative fixtures), 4 warnings
- **Scope:** Validates G3 fixtures; does not validate G6 preview artifact (not wired)
- **Prohibited actions:** None triggered; G4 output file was not committed (restored after QA run)

## 14. Safety confirmations

| Check | Status |
|---|---|
| WordPress touched | **false** |
| Public map runtime touched | **false** |
| Production feed touched | **false** |
| iframe/embed touched | **false** |
| Scheduled workflows touched | **false** |
| `location_cache.json` modified | **false** |
| `location_cache.json` read for analysis | **false** |
| Live staging executed | **false** |
| External APIs called | **false** |
| SODA fetched | **false** |
| Geocodes approved | **false** |
| Candidates promoted | **false** |
| Registry database created | **false** |
| Importer created | **false** |
| Production extractor created | **false** |
| Merged cache created | **false** |
| Runtime wiring added | **false** |

## 15. Next recommended phase: XRI-G7

**XRI-G7 — Candidate Review Rules + Operator Decision Model**

G7 should define how operators review preview groups, adjudicate conflicts, and make seed-eligibility decisions — still without production promotion unless explicitly authorized in a future Howard-gated phase.

## 16. Exact next instruction after G6

After XRI-G6 is merged, ChatGPT should write the XRI-G7 contract for Candidate Review Rules + Operator Decision Model.

**XRI-G7 is not authorized by this PR.**
