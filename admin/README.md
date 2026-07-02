# NYCIF Admin Dashboard

Read-only static admin page for operator visibility. Published at `/admin/` on GitHub Pages when deployed from repo root.

## v2 scope: read-only all-data admin map preview

- Loads only local static snapshot JSON from `admin/data/`
- Displays project status, master completion tracker, source freshness, TVPP candidates, TVPP triage, and TVPP location readiness
- Adds an **All-Data Admin Map** panel using the same Leaflet mapping approach used by the public Field Desk
- Plots only records that already have valid latitude/longitude values
- Lists records without valid coordinates in an **Unmapped / Needs Location Work** queue
- Shows counts for total, mapped, unmapped, source, triage bucket, and location-readiness bucket
- Shows documented-only Special Traffic Updates separately; it is not scraped
- Includes a Live vs Candidate Diff placeholder only; no comparison is implemented yet
- Handles missing snapshot files with visible error messages
- Does not decide what appears on the public map

## Guardrails

- No write controls
- No deploy controls
- No publish controls
- No approval/rejection workflow
- No auth, secrets, API keys, localStorage, cookies, or tokens
- No NYC Open Data calls from `admin/index.html`
- No GitHub API calls from `admin/index.html`
- No WordPress calls from `admin/index.html`
- No geocoding
- No guessed coordinates
- No cache writes
- No `location_cache.json` writes
- No production feed writes
- No public map runtime changes
- No service worker changes
- No deploy config changes
- No WordPress or XRI integration

## Local snapshot files loaded

- `./data/index.json`
- `./data/project-status.json`
- `./data/source-freshness.json`
- `./data/tvpp-candidates.json`
- `./data/tvpp-triage.json`
- `./data/tvpp-location-readiness.json`

## Map data behavior

The admin map joins TVPP candidate, triage, and location-readiness metadata in-browser for display only, using stable record identity where available:

- `sourceDatasetId + eventId`
- `sourceDatasetId + sourceRecordId`
- `eventId`
- `sourceRecordId`

No joined output file is written. The underlying snapshot JSON is not mutated.

Rows with null or invalid coordinates are not mapped. They remain visible in the unmapped queue with a derived reason such as missing latitude/longitude, needs_address_cleanup, intersection_or_route, borough_only, missing_location, needs_review, or no existing GPS.

## Public Field Desk

https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-02&resetFilters=1

## Admin page

https://setoxxx.github.io/nycif-field-desk/admin/

See also: `tools/event-sources/admin-dashboard-requirement.md`
