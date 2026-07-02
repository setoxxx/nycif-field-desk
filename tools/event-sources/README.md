# NYCIF Event Sources

Read-only event source inventory, normalizers, sample scripts, and admin snapshot tooling for NYC In Focus Field Desk.

**This does not affect production.** It does not modify:

- public map runtime
- production feed JSON
- WordPress
- `data/location_cache.json` or live-feed caches
- deploy configuration or scheduled workflows

## Scope

- Typed source config for 11 NYC event-related sources
- Normalized `EventLead` shape for future pipelines
- Read-only Socrata fetch helper (`limit`, optional `$where` / `$order` / `$offset`)
- Source-specific normalization for core feeds
- TVPP candidate feed, triage, location readiness, and location cleanup candidates
- Node built-in tests (`node --test`)

## Sources

| ID | Priority | Notes |
|---|---|---|
| `tvpp-9vvx` | core | NYC Permitted Event Information |
| `fudw-fgrp` | core | Parks Event Listing |
| `cpcm-i88g` | core_join | Parks locations; `join_key: event_id` |
| `xtsw-fqvh` | core_join | Parks categories; `join_key: event_id` |
| `ridc-7qqg` | enrichment | Parks links; `join_key: event_id` |
| `6eti-k994` | enrichment | Parks images; `join_key: event_id` |
| `jk6k-yab4` | enrichment | Parks organizers; `join_key: event_id` |
| `6v4b-5gp4` | core | Public Programs Division Special Events |
| `3vyj-dkjt` | core | Safety Events |
| `tg4x-b46p` | optional | Film Permits |
| `dot-trafalrt` | later | Special Traffic Updates — documented_only, HTML not Socrata |

## Special Traffic Updates

Deferred intentionally. Source is HTML (`trafalrt.shtml`), not Socrata JSON. It is documented only; no scraper is implemented.

## TVPP assignment feed candidate

```bash
node tools/event-sources/sample-tvpp-assignment-feed.mjs --limit 10 --pretty
```

- stdout JSON report with normalized `EventLead` objects sorted by `start_date_time`
- optional `--borough`, `--event-type`, and `--from-date`
- no files written
- not production feed output
- not map runtime wiring
- `photoPriorityScore` remains null unless later scoring is explicitly added

## TVPP assignment triage labels

```bash
node tools/event-sources/sample-tvpp-assignment-feed.mjs --limit 10 --with-triage --pretty
```

- stdout JSON report with `items: [{ lead, triage }]`
- triage is dev/operator metadata only
- `EventLead` shape is unchanged
- not production scoring

## TVPP location readiness audit

```bash
node tools/event-sources/sample-tvpp-location-readiness.mjs --limit 25 --pretty
```

- stdout JSON report with `items: [{ lead, locationReadiness }]` and `locationBucketCounts`
- read-only audit of whether TVPP records have enough location text to safely geocode later
- no GPS coordinates generated
- no geocoding API calls
- no cache writes
- no production feed output or map wiring
- `locationReadiness` is separate metadata; EventLead shape unchanged

## TVPP Location Cleanup Parser v1

The TVPP Location Cleanup Parser turns messy TVPP location strings into structured, reviewable, geocode-ready candidates.

Main module:

```text
 tools/event-sources/tvpp-location-cleanup.mjs
```

Admin snapshot generation command:

```bash
node tools/event-sources/build-admin-data-snapshots.mjs --limit 25 --pretty
```

Generated snapshot:

```text
admin/data/tvpp-location-cleanup.json
```

Purpose:

- normalize common TVPP location text such as street segments, park areas, venue names, borough-only rows, and weak/missing locations
- classify cleanup buckets such as `clean_address_candidate`, `park_area_candidate`, `intersection_candidate`, `route_or_multi_segment`, `borough_only`, `missing_location`, and `needs_manual_review`
- provide display-only `candidateQuery` and `candidateDisplayLocation` fields for operator review
- improve the Admin Dashboard unmapped queue before any future reviewed geocoding step

Safety:

- this is **not geocoding**
- no GPS coordinates are created
- no guessed coordinates are created
- no geocoding APIs are called
- no `location_cache.json` or geocode cache is written
- no production feed JSON is created
- no public Field Desk map wiring is changed
- cleanup candidates are for operator review only

## Admin Data Snapshots

Generate read-only static JSON for the NYCIF Admin Dashboard under `admin/data/`:

```bash
node tools/event-sources/build-admin-data-snapshots.mjs --limit 25 --pretty
```

Files created:

- `admin/data/project-status.json`
- `admin/data/source-freshness.json`
- `admin/data/tvpp-candidates.json`
- `admin/data/tvpp-triage.json`
- `admin/data/tvpp-location-readiness.json`
- `admin/data/tvpp-location-cleanup.json`
- `admin/data/index.json`

Guardrails:

- read-only / admin-only operator visibility
- not production feed output
- no production map wiring
- no geocoding
- no GPS coordinates
- no geocoding API calls
- no geocode cache writes
- no secrets
- no approval/rejection controls
- triage, locationReadiness, and locationCleanup are separate metadata only

## Tests

```bash
node --test tools/event-sources/event-sources.test.mjs
```

Additional focused cleanup tests may be run with:

```bash
node --test tools/event-sources/tvpp-location-cleanup.test.mjs
```

## Related work

Separate from XRI registry phases. Does not implement registry extractors, reconciliation, seed workflows, WordPress integration, production event feed generation, or public map promotion.
