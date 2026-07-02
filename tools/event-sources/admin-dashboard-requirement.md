# Future Operator/Admin Dashboard Requirement

Read-only operator visibility for NYCIF event-source and assignment-feed work. **Documentation only** — no admin UI, auth, deploy workflow, or production wiring is implemented in Event Sources v5b.

## Field desk relationship

The future admin/operator dashboard should be an **admin version of the existing NYCIF Field Desk GitHub Pages page** — same field-desk shell and map context, extended with operator-only read-only panels. It is not a separate product or a map gatekeeper.

**Public field desk:**

https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-02&resetFilters=1

**Proposed admin field desk:**

https://setoxxx.github.io/nycif-field-desk/admin/?v=c5p-postpublish-02&resetFilters=1

Not implemented in v5b. No HTML, CSS, JS, routing, auth, or deploy workflow is added by this requirement.

## Purpose

The admin page **visually shows everything that is happening across the system** for operator review:

- what is **live**
- **candidate/staged** data
- **source freshness** and recommendations
- **TVPP assignment feed** output
- **triage buckets and categories**
- **warnings** and **needs-review** data
- what has been **added or pushed** (informational)
- **build/commit/status metadata** when available

This is a **read-only visibility layer**, not an editing or publishing console.

**The dashboard does not decide what should or should not appear on the map.** Map publication remains a separate, explicitly approved process. The admin page only shows operator-visible state.

## What it is not

- **Not a filtering system for what belongs on the map** — it does not decide public map content
- **Not a public gatekeeper** — it does not decide what should or should not be shown publicly
- **Not a category hider** — it does not hide categories from operator view
- **Not an editor** — no publish, mutate, approve, reject, deploy, or cache-write actions
- **No write buttons** — no create/update/delete controls for feeds, leads, caches, or map data
- **No deploy buttons** — not a deploy trigger
- **No hidden filtering logic** — nothing is silently excluded from operator view
- **Not a cache/feed mutation tool** — does not mutate feeds, caches, map runtime, or deploy config
- **No secrets or API keys** — consumes already-public or already-approved read-only artifacts only
- **Assume public hosting unless proven otherwise** — GitHub Pages may be public; do not embed credentials in client-side code

## Category behavior

The admin page should show **everything separated into categories**, including:

- live
- candidate
- staged
- strong_assignment
- possible_assignment
- logistics_or_closure
- low_value
- needs_review
- stale
- empty
- source-health
- missing location
- missing geocode
- live vs candidate diff

**Category views or toggles are allowed only for visibility and navigation.** They must not be described or implemented as deciding what appears on the public map.

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

1. **Live map preview** — embed or link to public field desk map (read-only)
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

The `--with-triage` JSON can later power an admin field desk card or table. **No admin UI is implemented in v5b.**

## NYCIF Master Completion Tracker

Cross-project completion snapshot. **Not Event Sources only** — every future operator/admin/dashboard status report should include this master tracker or a current version of it. The tracker must not omit XRI, WordPress, production map status, admin dashboard status, or full-platform completion.

| Area | Completion | Why |
|---|---:|---|
| Production map current scope | 85–90% | Existing map/feeds are operational and gated. Current Event Sources work has not modified production runtime. Remaining work is mostly geocodes, QA, more sources, and controlled promotion. |
| Event Sources dev tooling | 90–95% | Source inventory, schema inspection, normalizers, Parks joins, sample pipelines, freshness reports, query tuning, TVPP candidate feed, and TVPP triage are built or in PR. |
| TVPP assignment-feed candidate | 85–90% | TVPP is proven current, normalized, sampled, and triaged. Still no geocoding, no production feed file, no scoring, and no map wiring. |
| Event API pipeline overall | 80–85% dev-side / 0% production-side | Dev proof is strong. Production output, scheduled generation, cache/feed writes, map integration, and promotion gates are intentionally not done. |
| Admin / Operator dashboard | 10–15% | Requirement is documented. No admin UI exists yet. Future target is an admin version of the Field Desk page. |
| XRI registry roadmap | 33% | G0–G3 are merged. G4–G11 are not started. |
| XRI registry implementation | 0% | No extractor, registry DB, reconciliation, seed workflow, UI, feeds, or WordPress integration. |
| WordPress / nycinfocus.com integration | 0% | Intentionally untouched. |
| Full NYCIF platform vision | 55–65% | Production map exists and Event Sources intelligence is much stronger, but admin dashboard, XRI implementation, WordPress, production event feed integration, and automation remain incomplete. |

## Warning signals operators should see (future UI)

Derived from existing dev metadata:

- **Missing location** — triage label `missing_location`; TVPP leads have `latitude`/`longitude` null
- **Missing geocode** — future; location text present but no coordinates
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

---

Admin page: [NYCIF Admin Dashboard](https://setoxxx.github.io/nycif-field-desk/admin/?v=c5p-postpublish-02&resetFilters=1)
Admin page status: planned; documentation updated; admin UI not implemented yet
