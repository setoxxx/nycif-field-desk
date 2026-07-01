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
- Source-specific normalization **stubs** for core feeds
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
| `dot-trafalrt` | later | Special Traffic Updates — **documented_only**, HTML not Socrata |

## Special Traffic Updates

Deferred intentionally. Source is HTML (`trafalrt.shtml`), not Socrata JSON. v0 documents it only; no scraper is implemented.

## Parks join strategy (future)

Enrichment tables (`cpcm-i88g`, `xtsw-fqvh`, `ridc-7qqg`, `6eti-k994`, `jk6k-yab4`) declare `joinKey: event_id`. Future work can join these to `fudw-fgrp` event rows before geocoding or registry matching.

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

## Tests

```bash
node --test tools/event-sources/event-sources.test.mjs
```

## Related work

Separate from XRI registry phases (G0–G3). Does not implement registry extractors, reconciliation, or seed workflows.
