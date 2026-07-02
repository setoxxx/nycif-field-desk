# NYCIF Event Sources v0

Read-only event source inventory and adapter scaffold for NYC Open Data event feeds.

**This does not affect production.** It does not modify:

- public map runtime
- production feed JSON
- WordPress
- `data/location_cache.json` or live-feeds caches
- deploy configuration or scheduled workflows

## Scope

- Typed source config for 11 NYC event-related sources
- Normalized `EventLead` shape for future pipelines
- Read-only Socrata fetch helper (`limit`, optional `$where` / `$order` / `$offset`)
- Source-specific normalization for core feeds (v2 mappings aligned to live schema notes)
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
| `tg4x-b46p` | optional | Film Permits (production/permit activity, not necessarily public events) |
| `dot-trafalrt` | later | Special Traffic Updates — **documented_only**, HTML not Socrata |

## Special Traffic Updates

Deferred intentionally. Source is HTML (`trafalrt.shtml`), not Socrata JSON. v0 documents it only; no scraper is implemented.

## Parks join enrichment (v2b, fixture-only)

Parks Event Listing (`fudw-fgrp`) provides base event data. Location, category, link, and organizer enrichment is done by matching `event_id` against join tables:

- `cpcm-i88g` — locations (borough, address, lat/long)
- `xtsw-fqvh` — categories
- `ridc-7qqg` — links
- `jk6k-yab4` — organizers

Use `enrichParksEventLead(baseLead, joins)` from `normalizers/parks-joins.mjs`. This helper is **pure and fixture-only** for now — not wired into production feeds or map runtime. Image join (`6eti-k994`) is deferred.

## Parks sample pipeline (v3, dev-only)

Manual dev script that fetches a small Parks sample, joins matching rows by `event_id`, normalizes, enriches, and prints JSON to **stdout only**:

```bash
node tools/event-sources/sample-parks-pipeline.mjs --limit 3 --pretty
```

By default the sample applies an upcoming filter (`date >= today`, ordered by `date ASC`). Use `--no-upcoming` to disable the date filter, or `--from-date YYYY-MM-DD` to override the start date.

- **stdout:** JSON array of enriched EventLead objects only
- **stderr:** fetch summary logs
- **no files written** — not production feed output, not map runtime wiring

## Multi-source freshness report (v4, dev-only)

Sample all core event sources and report whether each returns usable current/upcoming rows:

```bash
node tools/event-sources/sample-event-sources.mjs --limit 3 --pretty
```

- **stdout:** JSON report with per-source `freshness`, `dateRange`, and sample `leads`
- **stderr:** per-source fetch summary
- **skipped:** `dot-trafalrt` (documented_only)
- **no files written**

## Usage (read-only)

```javascript
import {
  getEventSourceById,
  fetchSocrataSource,
  normalizeEventLead,
} from './tools/event-sources/index.mjs';

const source = getEventSourceById('tvpp-9vvx');
const { rows, fetchedAt } = await fetchSocrataSource(source, { limit: 5 });
const leads = rows.map((row) => normalizeEventLead(source.id, row, { lastFetchedAt: fetchedAt }));
```

No app token required for v0 sample fetches. Respect NYC Open Data rate limits in production use.

## Live schema spot-check (v1, dev-only)

Manual read-only inspection against NYC Open Data (not run in CI):

```bash
node tools/event-sources/inspect-live-schemas.mjs
```

Prints observed field names and simple value types per fetchable source. See `schema-notes.md` for findings.

## Source query tuning (v4b, dev-only)

Diagnostic script that tests candidate Socrata query strategies per core source and recommends whether each source is suitable for current feed use, historical context, or needs query adjustment:

```bash
node tools/event-sources/tune-event-source-queries.mjs --limit 3 --pretty
```

- **stdout:** JSON report with per-source strategy results and recommendations
- **stderr:** fetch summary logs
- **no files written** — not production feed output, not map runtime wiring
- Special Traffic Updates (`dot-trafalrt`) remains `documented_only` and skipped

## Tests

```bash
node --test tools/event-sources/event-sources.test.mjs
```

## Related work

Separate from XRI registry phases (G0–G3). Does not implement registry extractors, reconciliation, or seed workflows.
