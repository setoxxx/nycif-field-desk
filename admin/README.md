# NYCIF Admin Dashboard

Read-only static admin page for operator visibility. Published at `/admin/` on GitHub Pages when deployed from repo root.

## v1 scope: read-only data panels

- Loads only local static snapshot JSON from `admin/data/`
- Displays project status, master completion tracker, source freshness, TVPP candidates, TVPP triage, and TVPP location readiness
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
- No external API calls from `admin/index.html`
- No NYC Open Data calls from `admin/index.html`
- No GitHub API calls from `admin/index.html`
- No WordPress calls from `admin/index.html`
- No geocoding
- No cache writes
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

## Public Field Desk

https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-02&resetFilters=1

## Admin page

https://setoxxx.github.io/nycif-field-desk/admin/

See also: `tools/event-sources/admin-dashboard-requirement.md`
