# Future Operator/Admin Dashboard Requirement

Read-only operator visibility for NYCIF event-source and assignment-feed work. **Documentation only** — no admin UI, auth, deploy workflow, or production wiring is implemented in Event Sources v5b.

## Purpose

Give operators a future GitHub-hosted admin/ops page to visually inspect:

- what is **live** on the public map
- what is **candidate/staged** for review
- source stats and freshness/recommendations
- TVPP triage bucket counts and per-lead labels
- live map preview vs candidate feed preview
- what would be added or pushed if published
- what is **safe to publish**

This is a **read-only visibility layer**, not an editing or publishing console.

## What it is not

- **Not an editor** — operators review; they do not mutate source rows or EventLead fields in-place
- **Not a deploy trigger** — no “publish to production” button without a separate, explicit human approval process elsewhere
- **Not a cache/feed mutation tool** — no writes to production feed JSON, location caches, or backend promotion artifacts
- **No secrets or API keys** — dashboard consumes already-public or already-approved read-only artifacts only
- **Assume public hosting unless proven otherwise** — a GitHub Pages admin page may be public; do not embed credentials or private tokens in client-side code

## Proposed dashboard data inputs

Current or near-term dev script outputs (stdout JSON today; consumed by a future UI later):

| Input | Source today | Notes |
|---|---|---|
| Source freshness summary | `sample-event-sources.mjs` | Per-source `freshness`, `dateRange`, row counts |
| Source query recommendations | `tune-event-source-queries.mjs` | `use_for_current_feed`, `use_for_historical_context`, etc. |
| TVPP assignment feed candidate | `sample-tvpp-assignment-feed.mjs` | Current/upcoming permitted events as `EventLead` |
| TVPP triage summary | `sample-tvpp-assignment-feed.mjs --with-triage` | `bucketCounts`, `items[].triage` |
| Location/geocode readiness | *future* | TVPP has no lat/long; geocoding not in v5b |
| Live feed summary | *future* | Read-only view of backend staged/live feed stats |
| Candidate-vs-live diff | *future* | What would change if candidate were promoted |
| Latest commit/build metadata | *future* | Git SHA, build time, last successful dev script run |

## Suggested dashboard panels (future)

1. **Live map preview** — embed or link to public map (read-only)
2. **Live feed stats** — counts, date range, last updated (when available)
3. **TVPP candidate feed preview** — table/cards from assignment feed candidate JSON
4. **Triage bucket counts** — bar or summary from `--with-triage` `bucketCounts`
5. **Source freshness / recommendations** — v4 + v4b script summaries
6. **Warnings** — missing location, weak title, stale source, empty source
7. **Live vs candidate diff** — future; highlight additions/removals/changes
8. **Build metadata** — future; commit SHA, generated-at timestamps from reports

## Relationship to Event Sources v5b

v5b triage is **dashboard-ready operator metadata**:

- `classifyTvppLead` / `classifyTvppLeads` return `{ bucket, labels, reasons, confidence }` separately from `EventLead`
- `--with-triage` output envelope includes `items: [{ lead, triage }]` and `bucketCounts`
- Triage is **not production scoring** — `photoPriorityScore` remains `null`
- EventLead 25-field shape is unchanged

The `--with-triage` JSON can later power an admin dashboard card or table (e.g. filter by `strong_assignment`, surface `low_information_title` warnings). **No admin UI is implemented in v5b.**

## Warning signals operators should see (future UI)

Derived from existing dev metadata:

- **Missing location** — triage label `missing_location`; TVPP leads have `latitude`/`longitude` null
- **Weak title** — triage label `low_information_title`; bucket `low_value`
- **Stale source** — freshness `stale` or recommendation `stale_or_empty` / `use_for_historical_context`
- **Empty source** — freshness `empty` or zero rows under upcoming filter
- **Needs human review** — triage bucket `needs_review` or label `needs_human_review`

## Safety boundaries (unchanged)

Future dashboard work must preserve:

- no production feed JSON writes from the dashboard
- no map runtime, service worker, WordPress, or deploy config changes unless explicitly approved
- no GPS review artifact promotion from the frontend
- Special Traffic Updates (`dot-trafalrt`) remains `documented_only` and unfetched

See `tools/event-sources/README.md` and repo root `AGENTS.md` for full agent rules.
