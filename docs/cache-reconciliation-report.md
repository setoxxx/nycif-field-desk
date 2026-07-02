# Cache Reconciliation Report (XRI-G5)

Status: **OPEN ONLY**. Report only. Read-only analysis only. No cache writes. No merge artifact.

Machine-readable report:

- `data/reports/cache_reconciliation_report.json`

Sample summary (not a merged cache):

- `data/reports/cache_reconciliation_summary.sample.json`

Prior phases:

- XRI-G0 — registry design (PR #46)
- XRI-G1 — asset inventory (PR #47)
- XRI-G2 — source tiers and candidate schema (PR #48)
- XRI-G3 — candidate schema fixtures and validation contract (PR #49)
- XRI-G4 — read-only candidate extractor prototype (PR #66)

**PR contract:** This phase ends **OPEN ONLY**. The PR must **not** be merged without a ChatGPT **MERGE** verdict for the specific PR number and final changed-file list. Safe file scope is necessary but is **not** merge permission.

## 1. Executive summary

XRI-G5 produces a **read-only reconciliation report** comparing the two known NYCIF location cache families so future registry phases can identify overlaps, conflicts, stale keys, missing provenance, and safe seed candidates — **without modifying any cache, feed, runtime, workflow, or production file**.

G5 findings:

1. **Two cache families** remain separate by design: field-desk retailer/venue pin pipeline (~11,211 keys) and live-feeds event GPS memory (~43,522 keys per G1/G2).
2. **field-desk `data/location_cache.json` was read locally read-only** — key count matches G1 estimate exactly (11,211); 10,606 geocoded rows, 605 geocode_failed rows without coordinates.
3. **live-feeds `data/location_cache.json` was unavailable_for_local_read** in this clone — no cross-cache key/coordinate intersection was computed; no remote fetch attempted.
4. **16 reconciliation categories** are defined for future G6+ use.
5. **No cache merge executed.** No merged cache artifact created. `production_allowed_from_g5`: **false**.

## 2. Scope and prohibitions

### In scope

- Read-only statistical/metadata analysis of locally available cache
- Conceptual and design-time comparison using prior XRI reports
- Reconciliation category definitions
- Risk and seed-implication documentation

### Prohibited (G5 compliance)

| Prohibition | Status |
|---|---|
| Modify `data/location_cache.json` (any repo) | Not touched |
| Create merged cache artifact | Not created |
| Registry database | Not created |
| Importer / production extractor | Not created |
| Modify production feeds | Not touched |
| Modify map runtime / service worker | Not touched |
| WordPress / iframe / embed | Not touched |
| Scheduled workflows | Not touched |
| Live staging | Not executed |
| External APIs / SODA fetch | Not called |
| Geocode approval / candidate promotion | Not performed |
| Merge this PR without ChatGPT MERGE verdict | **Forbidden** |

## 3. Relationship to XRI-G0 through XRI-G4

| Phase | Contribution to G5 |
|---|---|
| **G0** | Dual-cache awareness; production publish requires approved match statuses |
| **G1** | Catalogued both caches; ~11,211 vs ~43,522 key estimates; dual_location_cache risk |
| **G2** | Dual cache reconciliation **designed**; key-format documentation; future phase = G5 |
| **G3** | Conflict flags and blocked statuses inform reconciliation categories |
| **G4** | Validation output contract (`accepted_candidates` / errors / warnings) for future preview |
| **G5** | Read-only reconciliation report — **no merge, no mutation** |

## 4. Cache families identified

### field-desk cache

| Attribute | Value |
|---|---|
| Repo | `setoxxx/nycif-field-desk` |
| Path | `data/location_cache.json` |
| Asset family | Retailer/venue pin pipeline |
| Key format | `normalize(location)\|normalize(borough)\|` |
| G1 approx keys | 11,211 |
| G5 observed keys | **11,211** (matches G1) |
| Local read status | **read_only_inspected** |

### live-feeds cache

| Attribute | Value |
|---|---|
| Repo | `setoxxx/nycif-live-feeds` |
| Path | `data/location_cache.json` |
| Asset family | Event GPS memory |
| Key format | cemsid/place-memory with borough/confidence |
| G1 approx keys | 43,522 |
| G5 observed keys | **null** (not locally available) |
| Local read status | **unavailable_for_local_read** |

## 5. Read-only inputs inspected

| Input | Inspection type |
|---|---|
| `data/location_cache.json` (field-desk) | Read-only statistical metadata |
| `data/fixtures/registry-candidate-fixtures.sample.json` | Schema/reference only |
| `data/reports/existing_location_assets_inventory_report.json` | Prior phase metadata |
| `data/reports/registry_source_inventory_candidate_schema_report.json` | Dual-cache design metadata |
| `data/reports/candidate_schema_fixtures_validation_report.json` | Validation contract metadata |
| `data/reports/read_only_candidate_extractor_prototype_report.json` | Prior phase metadata |

Supporting docs referenced (not modified): `docs/existing-location-assets-inventory.md`, `docs/registry-source-inventory-and-candidate-schema.md`, `docs/candidate-schema-fixtures-and-validation-contract.md`, `docs/read-only-candidate-extractor-prototype.md`.

## 6. Inputs unavailable or skipped

| Input | Status | Reason |
|---|---|---|
| `setoxxx/nycif-live-feeds/data/location_cache.json` | **unavailable_for_local_read** | Not present in local field-desk clone; no GitHub/web fetch |
| Production feed JSON | **skipped** | Forbidden G5 input |
| Public map runtime files | **skipped** | Forbidden; referenced as risk only from prior docs |
| Workflows / WordPress / SODA | **skipped** | Forbidden |

**Recommended future step:** Dedicated read-only clone/sync of `setoxxx/nycif-live-feeds` before cross-cache statistical comparison in G6.

## 7. Cache metadata comparison

| Dimension | field-desk (observed) | live-feeds (design metadata) |
|---|---|---|
| Key count | 11,211 | ~43,522 (G1/G2) |
| File size | ~3.24 MB | unknown locally |
| Top-level structure | JSON object map | JSON object map (per G2) |
| Primary use | Pin pipeline geocoding | Event GPS place memory |
| Local inspection | **Yes** | **No** |
| Merge executed | **No** | **No** |

## 8. Key-shape comparison

### field-desk (observed)

- 100% of keys use pipe-separated 3-segment format: `location|borough|`
- Borough embedded in key string (not value object)
- Example: `856 e 136th st, 856 e 136th st, bronx|bronx|`

### live-feeds (from G2 design)

- cemsid/place-memory oriented keys with borough/confidence encoding
- Different normalization pipeline than field-desk

### Cross-cache key overlap

**Not computed.** Different key spaces make exact string overlap unlikely to be meaningful without normalized join logic in a future phase.

## 9. Coordinate-shape comparison

### field-desk (observed)

| Metric | Value |
|---|---|
| Records with lat/lng | 10,606 (94.6%) |
| geocode_failed (no coords) | 605 (5.4%) |
| Provider | `nyc_geosearch` (100%) |
| Quality values | `geocoded`, `geocode_failed` |
| Lat range | 40.499 – 40.914 |
| Lng range | -74.249 – -73.702 |
| Value fields | `query`, `lat`, `lng`, `quality`, `provider`, `updated_at` |

### live-feeds (design metadata)

- Event GPS memory coordinates with confidence signals (per G2)
- Local coordinate distribution **not analyzed** in G5

### Cross-cache coordinate overlap

**Not computed** — live-feeds cache unavailable locally.

## 10. Provenance/approval signal comparison

### field-desk cache values

**Present:** `provider`, `quality`, `updated_at`, `query`

**Absent:** `registry_id`, `approval_status`, `source_tier`, `match_status`, `confidence`, `provenance` object

**Implication:** Most field-desk rows are `cache_only_no_provenance` from a registry perspective until mapped through G4 validation and human review.

### live-feeds cache (design)

- Tier 0 authoritative source per G2
- Expected confidence and borough encoding in key/value (not locally verified)

### G3/G4 alignment

- `seed_approved_candidate` requires strong provenance — raw cache rows default to `needs_schema_review`
- 605 field-desk `geocode_failed` rows → `excluded_from_seed` until geocoded and reviewed

## 11. Potential overlap categories

Conceptual hypotheses for future G6 (not statistically verified in G5):

| Category | Hypothesis |
|---|---|
| `same_normalized_name_same_coordinates` | Venue names in field-desk may align with event place-memory entries after normalization |
| `same_normalized_name_different_coordinates` | Same venue name with divergent coords across pipelines |
| `possible_duplicate_key` | Multiple field-desk keys for same normalized address variants |
| `exact_key_same_coordinates` | Expected **low** cross-cache rate due to different key formats |

## 12. Potential conflict categories

| Category | G5 evidence |
|---|---|
| `exact_key_different_coordinates` | Not observed cross-cache (live-feeds unavailable) |
| `cache_only_no_provenance` | 605 field-desk geocode_failed rows |
| `missing_borough_ambiguous` | Possible in field-desk failed rows; borough usually in key for successful rows |
| `runtime_patch_conflict` | `event-location-corrections-v01.js` flagged in G1–G3 |
| `public_feed_untraceable_coordinate` | Production feed rows not analyzed (forbidden input) |
| `excluded_from_seed` | geocode_failed, runtime patch, feed-derived coords per G3 contract |

## 13. Safe registry seed implications

| Pool | Estimate | Default G5 disposition |
|---|---|---|
| field-desk geocoded rows | 10,606 | `needs_schema_review` until G6 preview + G4 validation |
| field-desk geocode_failed | 605 | `excluded_from_seed` |
| live-feeds cache rows | unknown | Pending read-only local access |
| production-approved from G5 | **0** | `production_allowed_from_g5: false` |

**Seed eligibility requires:** cross-cache dedup (G6), G4 validation pass, provenance chain to Tier 0/1, no runtime/feed conflicts, Howard gate (G8+).

## 14. Risks and blockers

| ID | Severity | Description |
|---|---|---|
| dual_cache_not_locally_comparable | **high** | Cannot compute cross-cache overlap without live-feeds local read |
| different_key_spaces | **high** | Blind merge unsafe; normalization join required |
| field_desk_geocode_failed_rows | **medium** | 605 rows lack coordinates |
| cache_writers | **high** | Scripts in both repos can write caches |
| runtime_patch_bypass | **high** | Client-side coord overrides bypass QA |
| no_merge_executed | info | G5 correctly report-only |

## 15. Recommended XRI-G6 candidate preview strategy

1. **Read-only clone/sync** live-feeds `data/location_cache.json` into an isolated analysis environment (no writes back).
2. Run **normalized join** on `normalized_location_key` / borough / coordinate clusters — not raw cache key strings.
3. Apply **G4 prototype validation** to preview candidates only; output under `data/reports/` as sample artifact.
4. Classify each preview row with G5 reconciliation categories.
5. Emit **warnings** for `runtime_patch_conflict`, `public_feed_untraceable_coordinate`, `cache_only_no_provenance`.
6. **Do not** create production registry, merged cache, or approved geocodes in G6.

## 16. Explicit confirmation — no modifications

| Check | Result |
|---|---|
| field-desk `location_cache.json` modified | **false** |
| live-feeds `location_cache.json` modified | **false** (not accessed) |
| Merged cache artifact created | **false** |
| Production feeds modified | **false** |
| Public map runtime modified | **false** |
| WordPress modified | **false** |
| iframe/embed modified | **false** |
| Scheduled workflows modified | **false** |
| Live staging executed | **false** |
| External APIs called | **false** |
| SODA fetched | **false** |
| `production_allowed_from_g5` | **false** |

## 17. OPEN ONLY — merge gate

| Item | Value |
|---|---|
| Merge permission | **None** |
| PR state required | **Open** |
| Merge requires | ChatGPT **MERGE** verdict for specific PR number + final changed-file list |
| Safe file scope alone | **Not sufficient** for merge |

**Waiting for Howard/ChatGPT review.**

## Reconciliation categories (defined for future use)

1. `exact_key_same_coordinates`
2. `exact_key_different_coordinates`
3. `same_normalized_name_same_coordinates`
4. `same_normalized_name_different_coordinates`
5. `same_coordinates_different_name`
6. `same_name_different_borough`
7. `missing_borough_ambiguous`
8. `source_specific_override_candidate`
9. `manual_override_candidate`
10. `runtime_patch_conflict`
11. `public_feed_untraceable_coordinate`
12. `cache_only_no_provenance`
13. `possible_stale_key`
14. `possible_duplicate_key`
15. `source_missing`
16. `excluded_from_seed`

**No categories were applied to merge or mutate cache records in G5.**

## Next step

**XRI-G6** — Registry candidate preview artifact (not production): consume G5 categories + G4 validation against read-only cache samples in a dedicated clone environment; emit preview JSON under `data/reports/` only.
