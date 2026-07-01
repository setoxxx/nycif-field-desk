# NYCIF Location Asset Taxonomy (XRI-G1)

Status: **reference only**. Companion to `docs/existing-location-assets-inventory.md`.

This taxonomy defines classification values used in the XRI-G1 inventory across all three NYCIF repos.

## asset_type values

| Value | Definition | Examples |
|---|---|---|
| `location_cache` | Keyed geocode memory store | `data/location_cache.json` |
| `approved_override` | Human- or process-approved geocode mapping | `approved_major_event_geocodes.json`, `gps_reviewed_approval_artifact.json` |
| `geocode_audit_report` | Machine-readable geocode/match audit output | `master_geocode_reference_audit.json`, `gps_repository_report.json` |
| `match_sample_report` | Sample rows for human review of match dispositions | `master_geocode_reference_match_samples.json` |
| `feed_output` | Event/pin feed JSON with or without coordinates | `preview_major_feed.json`, `nycif_staged_live_events.json` |
| `source_adapter` | SODA/API pull or source-specific parser | `build-prototype-major-events.mjs`, `sync_nyc_open_data.py` |
| `feed_generator` | Builds or transforms feed/cache artifacts | `build_staged_production_feed.py`, `build-preview-major-feed.mjs` |
| `validation_script` | Report-only audit, QA, or contract validator | `audit-master-geocode-reference.mjs`, `qa_*.py` |
| `review_ui` | Admin/test HTML page for match or feed review | `preview-major-feed-review.html` |
| `map_runtime` | Public or test map layer/marker rendering code | `public-approved-overlays-v01.js`, `event-location-corrections-v01.js` |
| `staging_gate` | Staging/operator contract, workflow, or writer gate | `staged-marker-layer-v01.js`, `events-live-staging-execution-contract.md` |
| `documentation` | Human-readable design, audit, or runbook doc | `master-location-registry-design.md`, `AGENTS.md` |
| `rollback_snapshot` | Pre-change backup of feed or cache data | `data/backups/nycif_all_radar_map_events.*.json` |
| `unknown_location_related_asset` | Location-adjacent asset needing further classification in G2 | GPS review queues, geocoding schemas |

## should_seed_registry values

| Value | When to use |
|---|---|
| `yes` | Asset contains approved/manual/final geocode data suitable for future registry seeding after explicit review |
| `maybe` | Useful candidates (venue pins, schemas, staging candidates) but needs review before seeding |
| `no` | Runtime, docs-only, raw/unapproved, needs-review, production feeds, or not location-specific |

**Rule:** Existence of coordinates does **not** imply registry approval.

## risk_level values

| Value | Criteria |
|---|---|
| `low` | Report-only, docs, samples, read-only audit artifacts |
| `medium` | Contains coordinates but gated; preview feeds; secondary references; staging contracts |
| `high` | Can modify protected files, production feeds, location_cache, public map runtime, or scheduled workflows |

## read_only_for_now

All inventoried assets are marked `read_only_for_now: true` for XRI-G1. Mutation requires explicit phase authorization (G3+ builder, G6 override workflow, G7 feed integration with Howard approval).

## Repo ownership (runtime, not inventory location)

| Repo | Future ownership |
|---|---|
| **nycif-live-feeds** | Registry storage, source adapters, match pipeline, production feed geocoding |
| **nycif-field-desk** | Review UI, map display of approved records, admin views |
| **nycif-web-platform** | Staging/operator gates, WordPress execution (gated) |

This G1 inventory report lives in **field-desk** as a cross-repo design reference only.
