# Existing NYCIF Location Asset Inventory (XRI-G1)

Status: **report only**. No source data modified. No production publish. No live staging.

Machine-readable report:

- `data/reports/existing_location_assets_inventory_report.json`

Classification reference:

- `docs/location-asset-taxonomy.md`

Prior design:

- `docs/master-location-registry-design.md` (XRI-G0, merged PR #46)

## 1. Executive summary

XRI-G1 catalogued **91 location/geocode-related assets** across three repos:

| Repo | Assets catalogued | Primary role |
|---|---:|---|
| `setoxxx/nycif-field-desk` | 35 | Review UI, map display, pin-pipeline spot files, C5G geocode audits, G0 design doc |
| `setoxxx/nycif-live-feeds` | 28 | **Future registry home**, GPS pipeline, production/staged feeds, SODA sync |
| `setoxxx/nycif-web-platform` | 28 | Staging/operator gates, geocoding schemas, WordPress scaffold (not activated) |

### Key findings

1. **Two separate `location_cache.json` files exist** — field-desk (~11,211 retailer-heavy keys) and live-feeds (~43,522 event GPS keys). Future registry build must reconcile, not merge blindly.

2. **Primary registry seed candidate:** `nycif-live-feeds/data/location_cache.json` — designated future registry home per XRI-G0.

3. **Secondary seed candidates:** field-desk `location_cache.json`, C5G2 approved overrides, live-feeds Phase 2D approval artifacts (25 rows), pin-pipeline venue/retailer spot files (maybe).

4. **Large review backlog:** 642/897 tvpp rows unmatched (C5G); 249 possible matches; 2,157 GPS needs-review events (live-feeds Phase 1).

5. **Highest risks:** client-side coordinate patching (`event-location-corrections-v01.js`), cache-writing scripts, production radar feed files, scheduled GitHub workflows with `contents:write`.

6. **Missing referenced files:** live-feeds `manual_gps_reference.json` and `nyc_parks_facility_reference.json` (referenced in AGENTS.md Phase 2C but absent).

## 2. Scope and prohibitions

This inventory was **read-only inspection** across:

- `/Users/howardweiss/nycif-field-desk`
- `/Users/howardweiss/nycif-live-feeds-public` (remote: `setoxxx/nycif-live-feeds`)
- `/Users/howardweiss/nycif-web-platform`

**Not performed:**

- No modification of source data, production feeds, public map runtime, WordPress, iframe/embed settings, or scheduled workflows
- No writes to `data/location_cache.json` (either repo)
- No live staging execution
- No geocoding, coordinate invention, or match approval
- No SODA full-dataset pulls

## 3. Repo-by-repo inventory

### 3.1 setoxxx/nycif-field-desk

**Role:** Review UI, map display, pin-pipeline overlays, geocode audit artifacts. Hosts XRI-G0/G1 design docs only — does not own future registry storage.

#### Location / geocode data assets

| Path | Type | Coords | Seed? | Risk |
|---|---|---:|---|---|
| `data/location_cache.json` | location_cache | yes | **yes** | medium |
| `data/approved_major_event_geocodes.json` | approved_override | yes | **yes** | medium |
| `data/approved_major_event_geocodes_needs_review.json` | approved_override | yes | no | medium |
| `data/prototype_major_events_needs_review.json` | feed_output | partial | no | medium |
| `data/preview_major_feed.json` | feed_output | yes | no | medium |
| `data/preview_major_feed_needs_review.json` | feed_output | partial | no | medium |
| `data/nycif_nightlife_spots.json` | feed_output | yes | maybe | medium |
| `data/nycif_licensed_smoke_vape_retailers.json` | feed_output | yes | maybe | medium |
| `data/nycif_legal_cannabis_dispensaries.json` | feed_output | yes | maybe | medium |

#### Audit / report assets

| Path | Phase | Purpose |
|---|---|---|
| `data/reports/master_geocode_reference_audit.json` | C5G | 897 tvpp rows vs 14 reference files: 6 exact, 249 possible, 642 unmatched |
| `data/reports/master_geocode_reference_match_samples.json` | C5G | Sample match rows for review |
| `data/reports/approved_major_event_geocodes_report.json` | C5G2 | Override builder report; publish blocked |
| `docs/master-geocode-reference-audit.md` | C5G | Human-readable audit summary |
| `docs/major-feed-production-publish-closeout.md` | C5P | Publish cycle closeout |

#### Source adapters / builders

| Path | Type | Notes |
|---|---|---|
| `tools/feed-audit/audit-master-geocode-reference.mjs` | validation_script | Report-only C5G audit runner |
| `tools/feed-audit/build-approved-geocode-overrides.mjs` | feed_generator | C5G2 override builder |
| `tools/feed-audit/build-prototype-major-events.mjs` | source_adapter | tvpp-9vvx adapter; 0 mapped |
| `tools/pin-pipeline/build-nightlife-pins.mjs` | source_adapter | **WRITES location_cache** — high risk |
| `tools/pin-pipeline/` (9 additional builders) | source_adapter | Smoke, cannabis, correlation pipelines |

#### Review / map assets

| Path | Type | Notes |
|---|---|---|
| `preview-major-feed-review.html` | review_ui | C5G4 QA dashboard |
| `prototype-major-events-review.html` | review_ui | C2B prototype review |
| `event-location-corrections-v01.js` | map_runtime | **Client-side coord patch — high risk** |
| `public-approved-overlays-v01.js` | map_runtime | Public overlay loader |
| `staged-marker-layer-v01.js` | staging_gate | Admin staged feed layer |
| `service-worker.js` | map_runtime | Inspected only; caches UI defaults |

### 3.2 setoxxx/nycif-live-feeds

**Role:** Future registry primary repo. Owns GPS pipeline, staged/production feeds, SODA sync, scheduled workflows.

#### Protected / production assets

| Path | Type | Coords | Seed? | Risk |
|---|---|---:|---|---|
| `data/location_cache.json` | location_cache | yes | **yes** | **high** |
| `data/nycif_staged_live_events.json` | feed_output | yes | no | **high** |
| `nycif_all_radar_map_events.json` | feed_output | yes | no | **high** |
| `nycif_major_radar_map_events.json` | feed_output | yes | no | **high** |
| `data/staged_live_manifest.json` | feed_output | no | no | medium |

#### GPS review pipeline (Phase 1–2E)

| Phase | Key artifacts | Status |
|---|---|---|
| 1 | `gps_needs_review_events.json` (2,157 rows) | needs_review |
| 2A | `gps_review_location_groups.json` (343 groups) | needs_review |
| 2B | `gps_review_geocoding_proposals.json` (50 proposals) | unfilled/pending |
| 2C | `gps_review_geocoding_filled_proposals.json` (42 filled) | proposed only |
| 2D | `gps_manual_approval_queue.json` (42 pending) | needs_review |
| 2D | `gps_reviewed_approval_artifact.json` (25 approved) | gated; seed maybe |
| 2E | `gps_phase2e_promotion_report.json` | 25 promoted to cache |

#### Scripts and workflows (inspect only)

| Path | Risk | Can modify |
|---|---|---|
| `scripts/build_gps_repository.py` | high | location_cache |
| `scripts/build_location_cache.py` | high | location_cache |
| `scripts/build_staged_production_feed.py` | high | staged feed |
| `scripts/publish_c5p_approved_major_event_row.mjs` | high | production radar feeds |
| `scripts/apply_gps_staged_feed_integration_update.py` | high | staged feed |
| `.github/workflows/live-sync-qa.yml` | high | cache + feeds (scheduled) |
| `.github/workflows/gps-staged-feed-integration-update.yml` | high | staged feed (scheduled) |

#### Missing referenced assets

- `data/manual_gps_reference.json` — referenced Phase 2C, absent
- `data/nyc_parks_facility_reference.json` — referenced Phase 2C, absent

### 3.3 setoxxx/nycif-web-platform

**Role:** Staging/operator gates, geocoding pipeline scaffolding, WordPress contracts. **No location_cache in repo.**

#### Geocoding pipeline scaffolding

| Path | Type | Seed? |
|---|---|---|
| `data-sources/geocoding-cache.schema.json` | schema | maybe |
| `scripts/build_geocoding_queue.py` | validation_script | maybe |
| `scripts/apply_geocoding_cache.py` | validation_script | maybe |
| `scripts/film_permit_location.py` | source_adapter | maybe |
| `scripts/export_public_radar_geojson.py` | feed_generator | no (high risk) |

#### Staging / operator gates

- **19** staging contract docs (`docs/events-*-contract.md`)
- **45** contract validators (`scripts/events_pipeline/qa_*.py`)
- **7** local-only staging writers (`scripts/events_pipeline/write_*.py`)
- **32** operator-gate contract samples (`event-data/samples/event-radar-import/`)

All gates require `location_cache_changed=false` and `modifies_location_cache=false`.

#### WordPress (not activated)

| Path | Risk | Status |
|---|---|---|
| `wordpress-plugins/nycif-events-map/` | high | Source-controlled; not activated |
| `wordpress-plugin/nycif-events-map-prototype.php` | medium | Draft-only scaffold |
| `docs/wordpress-live-inventory.md` | medium | Read-only baseline inventory |

## 4. Asset classification summary

| asset_type | Count (approx) |
|---|---:|
| feed_output | 18 |
| geocode_audit_report | 8 |
| documentation | 7 |
| staging_gate | 7 |
| source_adapter | 7 |
| map_runtime | 6 |
| location_cache | 2 |
| approved_override | 5 |
| validation_script | 5 |
| unknown_location_related_asset | 8 |
| review_ui | 2 |
| rollback_snapshot | 4 |
| feed_generator | 6 |
| match_sample_report | 1 |
| **Total catalogued** | **91** |

Full per-asset records: `data/reports/existing_location_assets_inventory_report.json`.

## 5. Registry seed candidates

### should_seed_registry: yes

| Repo | Path | Notes |
|---|---|---|
| live-feeds | `data/location_cache.json` | ~43,522 keys; **primary future registry home** |
| field-desk | `data/location_cache.json` | ~11,211 keys; retailer-heavy; reconcile with live-feeds cache |
| field-desk | `data/approved_major_event_geocodes.json` | 1 proposed exact-match override (C5G2 template) |

### should_seed_registry: maybe

| Repo | Path | Notes |
|---|---|---|
| field-desk | `data/nycif_nightlife_spots.json` | 10,653 venue pins |
| field-desk | `data/nycif_licensed_smoke_vape_retailers.json` | 9,057 address pins |
| field-desk | `data/nycif_legal_cannabis_dispensaries.json` | 241 dispensary pins |
| live-feeds | `data/gps_reviewed_approval_artifact.json` | 25 Howard-reviewed approved rows |
| live-feeds | `data/gps_manual_approval_staging_candidates.json` | 25 staging candidates |
| live-feeds | `data/gps_review_geocoding_filled_proposals.json` | 42 filled proposals (proposed only) |
| web-platform | Geocoding schemas + `film_permit_location.py` | Normalization rules for future adapters |

### Explicitly NOT seed candidates

- All `*_needs_review.json` files
- Production radar feeds (`nycif_*_radar_map_events.json`)
- Preview/prototype feeds with blocked rows
- Client-side map runtime patches
- Rollback snapshots
- Staging gate contracts and samples

## 6. Assets that must remain read-only

Until explicit Howard approval in a gated phase:

| Asset | Repo | Reason |
|---|---|---|
| `data/location_cache.json` | field-desk + live-feeds | XRI-G0/G1 read-only; dual cache reconciliation needed first |
| Production radar feeds | live-feeds | Public map consumption surface |
| Staged live events | live-feeds | Backend QA gate before publish |
| `event-location-corrections-v01.js` | field-desk | Runtime patch bypasses QA; do not expand |
| Scheduled workflows | live-feeds | Can auto-modify protected files |
| WordPress plugin | web-platform | Not activated; gated deployment |

## 7. Risks and conflicts

| ID | Severity | Description |
|---|---|---|
| dual_location_cache | **high** | Two separate caches with different key spaces and purposes |
| client_side_coord_patch | **high** | `event-location-corrections-v01.js` bypasses registry/feed gates |
| cache_writers | **high** | Scripts in both repos can write location_cache |
| production_feed_surface | **high** | Root radar JSON is public map source |
| scheduled_workflows | **high** | CI workflows with contents:write on protected paths |
| phase2e_promotion_state | medium | Promotion report vs artifact flag mismatch |
| missing_reference_files | medium | Parks/manual GPS refs referenced but absent |
| possible_match_volume | medium | 642 unmatched + 249 possible + 2,157 GPS needs-review |
| wordpress_scaffold | medium | Plugin exists but not activated |

## 8. Recommended future phases

| Phase | Scope | Builds on G1 finding |
|---|---|---|
| **XRI-G2** | Registry source inventory + candidate schema | Reconcile dual caches; inventory cpcm-i88g; draft JSON schema |
| **XRI-G3** | Prototype registry builder (local/report only) | Seed from live-feeds cache + venue spot files |
| **XRI-G4** | Match audit vs SODA samples | Test matchers against tvpp needs-review samples |
| **XRI-G5** | Review UI for possible/conflict/unmatched | Extend field-desk admin pages |
| **XRI-G6** | Approved override workflow | Migrate C5G2 + Phase 2D patterns to registry overrides |
| **XRI-G7** | Production-feed integration (gated) | Attach registry provenance to feed rows |
| **XRI-G8** | Monitoring and correction | Drift detection, workflow audit |

## 9. Safety confirmation

| Check | Result |
|---|---|
| Production feed JSON modified | **false** |
| Public map runtime modified | **false** |
| WordPress modified | **false** |
| iframe/embed settings modified | **false** |
| Scheduled workflows modified | **false** |
| `data/location_cache.json` modified (either repo) | **false** |
| Live staging executed | **false** |
| Only allowed G1 files changed in this PR | **true** |

## Next step

**XRI-G2** — Registry source inventory and candidate schema (report only): reconcile dual location caches, sample cpcm-i88g Parks Event Locations join feasibility, draft registry JSON schema, and catalog missing reference files.
