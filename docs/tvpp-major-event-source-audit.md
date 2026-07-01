# TVPP Major Event Source Audit

QA-only audit for the next NYC In Focus **Major events** feed direction.

- Generated report: `data/reports/tvpp_major_event_source_audit_report.json`
- Audit runner: `tools/pin-pipeline/audit-tvpp-major-event-sources.mjs`
- **Production feeds were not modified.**

## Executive summary

The public map’s default view (`majorOnly=true`) loads `nycif_major_radar_map_events.json` from `setoxxx/nycif-live-feeds`. That file is **not** the same as the live NYC Open Data source and is **not** rebuilt by the hourly backend QA workflow.

The official source inventory is **NYC Permitted Event Information** (`tvpp-9vvx`). It is current and future-facing, includes July 4 rows, and is the correct primary source to build from — but the current enriched/major pipeline leaves most rows out, and headline July 4 events are missing from the public major feed.

## Feed architecture

| Artifact | Repo | Path | Role | Current automation |
|----------|------|------|------|--------------------|
| All / enriched feed | `setoxxx/nycif-live-feeds` | `nycif_all_radar_map_events.json` | Full enriched event inventory used by frontend “Show more events” | Last metadata `2026-06-27`; not refreshed by hourly QA sync |
| Major feed | `setoxxx/nycif-live-feeds` | `nycif_major_radar_map_events.json` | Default public map feed when **Major events only** is checked | Scored subset of all feed (~582 rows); last metadata `2026-06-27` |
| Staged feed | `setoxxx/nycif-live-feeds` | `data/nycif_staged_live_events.json` | Backend QA / review path only | Built hourly by `live-sync-qa.yml` via `build_staged_production_feed.py` |
| Live sync QA | `setoxxx/nycif-live-feeds` | `data/live_sync_report.json` | Compares raw `tvpp-9vvx` to enriched all feed | `scripts/sync_nyc_open_data.py` — **report only** |

Frontend references (this repo):

- `app-v06-safe.js` loads major/full/staged URLs from `setoxxx/nycif-live-feeds`
- `live-test-v014-safe.js` compares raw `tvpp-9vvx` to enriched all feed for admin QA

## Source audit: `tvpp-9vvx`

| Item | Finding |
|------|---------|
| Dataset | [NYC Permitted Event Information](https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tvpp-9vvx) |
| API | `https://data.cityofnewyork.us/resource/tvpp-9vvx.json` |
| Publisher | City of New York |
| Description | Approved event applications occurring within the next month; film permits with street impact >= 5 days |
| Native lat/lng | **No** — geocode via CEMSID / location cache / text match |
| Primary title | `event_name` |
| Primary start/end | `start_date_time`, `end_date_time` |
| Location | `event_location` |
| Borough | `event_borough` |
| Permit/type | `event_type`, `event_agency`, `street_closure_type` |
| Crosswalk key | `event_id` (+ `cemsid` where present) |
| Current/future-facing | Yes — audit sampled **30,210** rows with `start_date_time >= today` |
| July 4, 2026 rows in source | **844** |
| Can support public map | **Yes**, with enrichment + editorial scoring + QA gates |

### Important field notes

- `event_type` includes Parade, Block Party, Street Event, Farmers Market, Sport categories, Special Event, Production Event, Open Street Partner Event, etc.
- `event_agency` distinguishes Parks Department, Street Activity Permit Office, Police Department, etc.
- `cemsid` is the main coordinate bridge when present; many street events have weak/empty CEMSID values.
- Dataset description says “next month”, but the API currently exposes a much wider future window — treat freshness as a QA check, not an assumption.

## July 4 gap analysis

### Headline events in source but not in major feed

Audit run `2026-07-01` found **0 of 5** headline July 4 events in `nycif_major_radar_map_events.json`:

| Source ID | Title | In all feed | In major feed | Likely cause |
|-----------|-------|-------------|---------------|--------------|
| 915235 | July 4th Fireworks | No | No | Not enriched into all feed |
| 930146 | Annual July 4 Parade | No | No | Not enriched into all feed |
| 910885 | Nathans Famous July 4th Hotdog Eating Contest | No | No | Not enriched into all feed |
| 932345 | West 55 July 4 Independence Day Block Party | No | No | Not enriched into all feed |
| 939293 | Annual Huck Finn July 4th Fishing Derby | Yes | No | Present in all/staged, excluded by stale major scoring |

### Why users see “missing July 4”

1. **Enrichment gap:** headline rows never made it into `nycif_all_radar_map_events.json`.
2. **Major subset gap:** even enriched July 4 rows are mostly excluded from major feed (**45 / 844** on that date in major feed during audit).
3. **Stale production files:** all/major metadata last generated **2026-06-27**; hourly QA updates staged/test artifacts but not production all/major JSON.
4. **Frontend default:** public map now defaults to major feed only, so major-feed gaps appear as missing citywide events.

Backend remainder-year QA (`data/remainder_year_coverage_report.json`) confirms raw/staged coverage for `2026-07-04` is strong (**844 raw**, **820 staged**), so the problem is **not** “tvpp has no July 4 rows” — it is **production major/all refresh + selection policy**.

## Audit counts (latest run)

From `data/reports/tvpp_major_event_source_audit_report.json`:

| Metric | Count |
|--------|------:|
| Source rows (current/future) | 30,210 |
| Mapped in major feed | 1,230 |
| Rejected / not in major | 28,980 |
| Needs review (missing geocode in all feed) | 0 |
| July 4 source rows | 844 |
| July 4 rows in major feed | 45 |
| Headline July 4 in major feed | 0 / 5 |

Top rejection reasons:

- `not_present_in_enriched_all_feed`
- `below_major_selection_threshold`
- `low_major_score_sports_permit`
- `no_cemsid_and_not_enriched`

## Recommended source list

| Priority | Source | Use |
|----------|--------|-----|
| Primary | `tvpp-9vvx` | Official permitted events, parades, street activity, parks permits |
| Supplement | NYC Parks structured events | Only if a current machine-readable official feed is verified |
| Supplement | DOT / Open Streets datasets | Closures and open-streets activity; partial overlap already appears in tvpp |
| Manual cross-check | Official citywide calendars | Holiday/fireworks/waterfront events not yet enriched |

Do **not** scrape Instagram. “Instagramable” should remain a **scoring/category field**, not a scraper source.

## Proposed major-event output schema

Proposed fields for the next builder stage:

- `major_score`
- `major_reason`
- `photo_pick`
- `instagramable_signal`
- `public_event_type`
- `expected_crowd_signal`
- `source_name`
- `source_url`
- `source_record_id`
- `date`
- `start_date_time`
- `end_date_time`
- `title`
- `display_location`
- `borough`
- `lat`
- `lng`
- `verification_status`
- `review_status`

## Scoring guidance (draft)

High-score signals:

- July 4 / fireworks / Independence Day
- parade / march
- street closure / permitted public gathering
- major park event / festival / cultural event
- waterfront event
- market / pop-up with strong field value
- sports / fan-zone / World Cup adjacency
- official city agency event
- strong photo/field value

Down-rank (not auto-exclude without review):

- routine youth/adult league sports permits
- recurring greenmarkets unless holiday/editorial reason exists

Safety language to use:

- Public event listing
- Source-listed event
- Field/photo candidate
- Confirm before traveling
- Event details can change

Avoid:

- verified crowd / officially popular / guaranteed
- dangerous / crime hotspot
- fake times / fake locations / unsupported celebrity claims

## QA-first implementation path

### PR B (this branch) — audit only

- Document architecture and July 4 cause
- Add audit runner + JSON reports
- No public UI changes
- No production feed overwrites

### PR C — prototype builder (next)

Branch: `cursor/prototype-major-event-feed-builder`

Allowed:

- prototype builder under `tools/`
- review/report outputs under `data/reports/`
- test outputs only

Required prototype reports:

- source rows
- mapped rows
- rejected rows
- needs review rows
- July 4 rows found / mapped
- top rejection reasons
- missing geocode count
- source freshness

Gate before any production overwrite:

- backend reliability gate pass
- July 4 headline spot-check pass
- no unsupported public claims
- existing approved overlay layers unchanged

## How to rerun this audit

```bash
node tools/pin-pipeline/audit-tvpp-major-event-sources.mjs
```

Outputs:

- `data/reports/tvpp_major_event_source_audit_report.json`
- `data/reports/tvpp_july4_headline_audit.json`
- `data/reports/tvpp_major_event_rejected_sample.json`
- `data/reports/tvpp_major_event_needs_review_sample.json`
