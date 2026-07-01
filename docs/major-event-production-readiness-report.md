# Major-Event Production Publish Readiness Report (C5R)

Status: **readiness report only**. No production feed outputs are modified by this document or its companion JSON report.

Machine-readable companion: `data/reports/major_event_production_readiness_report.json`

Related artifacts:

- C5 approval checklist: `docs/major-event-production-publish-checklist.md`
- C5G3 preview report: `data/reports/preview_major_feed_report.json`
- C5G4 preview review page: https://setoxxx.github.io/nycif-field-desk/preview-major-feed-review.html?v=c5g4-01

## PROJECT STATUS

| Field | Value |
|---|---|
| Phase | C5R — Production Publish Readiness Report |
| Mode | Readiness report only — no production publish |
| Production feeds modified | **false** |
| WordPress modified | **false** |
| Public map modified | **false** |
| Production publish blocked until explicit approval | **true** |

### Completed phases (relevant to publish decision)

| Phase | PR | Outcome |
|---|---|---|
| C2 | #32 | Prototype major-event builder |
| C2B | #33 | Prototype review page |
| C3 | #34 | Live-feed integration plan |
| C4 | #35 | Preview major feed builder |
| C5 | #36 | Production approval checklist |
| C5G | #37 | Master geocode reference audit |
| C5G2 | #38 | Approved geocode override layer |
| C5G3 | #39 | Preview rebuild with 1 approved geocode (`1d455dd`) |
| C5G4 | #40 | Preview review page; browser QA passed (`0359c2c`) |

### C5G4 browser QA (passed)

| Check | Result |
|---|---|
| Page loads | yes |
| Counts match | yes |
| 12 preview rows visible | yes |
| 11 manual/NYPD rows visible | yes |
| Queensboro Dance Festival visible (`914695`) | yes |
| 896 blocked rows visible | yes |
| QA-only warning visible | yes |
| Production feeds untouched | yes |

---

## Safety statements

**This PR is readiness-report only and does not modify production feed outputs, public UI, WordPress, iframe/embed settings, scheduled workflows, or `data/location_cache.json`.**

**Production publishing remains blocked until explicit Howard approval.**

This readiness report does not overwrite:

- `nycif_major_radar_map_events.json`
- `nycif_all_radar_map_events.json`
- `data/nycif_staged_live_events.json`

---

## 1. What is ready for possible production publish

After explicit Howard approval, a **separate** `setoxxx/nycif-live-feeds` publish PR may merge **only** the following preview-ready major rows into production feeds using a **merge-not-replace** strategy for existing manual/NYPD records.

| Category | Count | Notes |
|---|---:|---|
| Preserved manual/NYPD-style records | 11 | Hard-written field-desk records; must remain in production |
| Approved-geocode tvpp rows | 1 | Only row promoted from needs-review via C5G2/C5G3 |
| **Total `preview_major_feed_rows`** | **12** | Source: `data/preview_major_feed.json` |

### Approved-geocode tvpp row (only tvpp row ready)

| Field | Value |
|---|---|
| Title | 2026 Queensboro Dance Festival |
| `source_record_id` | `914695` |
| Date | 2026-07-02 |
| Borough | Queens |
| Location | Flushing Meadows Corona Park: Around the Unisphere |
| Coordinates | 40.739312, -73.842193 |
| Geocode source | `normalized_exact` via `data/approved_major_event_geocodes.json` |
| `approved_geocode_applied` | true |
| `verification_status` | source_listed |
| Safety note | Source-listed public event listing. Field/photo candidate. Confirm before traveling. Event details can change. |

### Eleven preserved manual/NYPD-style records

These records are already in preview major feed and must be preserved unchanged in any future production publish:

1. NYPD Field Intel: 2026 NYC Pride March
2. NYPD Field Intel: World Cup Fan Zone - Rockefeller Center
3. NYPD Field Intel: PrideFest 2026
4. NYPD Field Intel: World Cup Fan Zone - Hudson Yards / Javits Area
5. NYPD Field Intel: 119th Annual Independence Day Parade - Brooklyn
6. NYPD Field Intel: CRCA Grant's Tomb Criterium
7. NYPD Field Intel: World Cup Fan Zone - Staten Island
8. NYPD Field Intel: 3rd Avenue Cooper Square Fair
9. NYPD Field Intel: Lower 6th Avenue Merchandise Fair
10. NYPD Field Intel: PTL Joseph J. Pelosi Way
11. NYPD Field Intel: Chris Walsh Way

Evidence: `preserved_manual_records: 11`, `manual_records_removed: 0` in `data/reports/preview_major_feed_report.json`.

---

## 2. What is blocked

The following must **not** be published in any production publish PR until separately reviewed and approved.

| Block | Count / status | Evidence |
|---|---|---|
| Needs-review rows | **896** | `preview_needs_review_rows: 896` in preview report |
| Missing geocode | **896** | `missing_geocode_count: 896` |
| Fuzzy / possible geocode matches | **249** (audit) | C5G geocode audit; `possible_matches_still_blocked: true` |
| Unmatched rows | **642** (audit) | C5G geocode audit; `unmatched_still_blocked: true` |
| Rows without approved coordinates | all non-manual tvpp rows except `914695` | Only 1 row in `approved_major_event_geocodes.json` promoted |
| Unresolved time/location issues | blocked per row `review_reasons` | e.g. `time_needs_review`, `missing_geocode`, `headline_july_4_requires_review` |
| Invented claims | **blocked** | No fabricated time, location, crowd, popularity, or verification claims |

### Top blocked reasons (896 needs-review rows)

From preview needs-review disposition and C5G audit:

- **missing geocode** — primary blocker for the majority of tvpp rows
- **possible / fuzzy geocode needs review** — 249 possible matches remain in review artifacts, not auto-applied
- **unmatched** — 642 unmatched against master geocode reference
- **time_needs_review** — source timestamps require human review before publish
- **headline_july_4_requires_review** — 51 headline July 4 rows remain in needs-review only

Headline July 4 coverage remains in review, not in major preview pins: `headline_july_4_in_major_preview: 0`, `headline_july_4_in_needs_review: 51`, `headline_july_4_in_preview_or_review: true`.

---

## 3. What must be preserved

Any future production publish PR must:

1. **Preserve all 11 manual/NYPD-style records** — merge-not-replace, never drop or overwrite hard-written records.
2. Keep **`manual_records_removed: 0`** — rollback if any manual record disappears.
3. Treat current hard-written feed records as **merge-not-replace** against live-feeds production JSON.
4. Add **only** the single approved-geocode tvpp row (`914695`) from preview, unless Howard explicitly approves additional rows in writing.
5. Leave all **896** needs-review rows out of production major feed.

Publish inputs (read-only from field-desk):

```text
data/preview_major_feed.json
data/preview_all_feed.json
data/preview_staged_feed.json
data/reports/preview_major_feed_report.json
```

---

## 4. What the future production PR would be allowed to change

**Only in `setoxxx/nycif-live-feeds`**, and **only after explicit Howard approval**:

| File | Allowed change |
|---|---|
| `nycif_major_radar_map_events.json` | Merge 11 manual records + 1 approved tvpp row (`914695`) |
| `nycif_all_radar_map_events.json` | Optional aligned update if Howard approves this file |
| `data/nycif_staged_live_events.json` | Optional aligned staged update if Howard approves this file |

Supporting live-feeds-only artifacts (recommended):

```text
data/backups/nycif_major_radar_map_events.<ISO>.json
data/backups/nycif_all_radar_map_events.<ISO>.json
data/backups/nycif_staged_live_events.<ISO>.json
data/reports/production_feed_publish_report.json
```

Current production snapshot sizes (from C5G3 preview report):

- `production_major_snapshot_rows`: 582
- `production_all_snapshot_rows`: 12210

---

## 5. What the future production PR must not touch

| Area | Rule |
|---|---|
| WordPress | No iframe/embed/WordPress changes |
| Public map UI | No changes to `index.html`, `app-v06-safe.js`, public overlay scripts |
| Field-desk public UI | No changes in `setoxxx/nycif-field-desk` public map entrypoints |
| `data/location_cache.json` | Read-only reference; never overwritten by publish PR |
| Scheduled workflows | No CI/workflow changes bundled with publish |
| Preview needs-review rows | Do not promote the 896 blocked rows without separate approval |
| Possible/fuzzy geocode matches | Do not auto-apply without human approval |

---

## 6. Rollback requirements

Before any production publish PR merges in `setoxxx/nycif-live-feeds`:

### Required pre-publish snapshots

```text
data/backups/nycif_major_radar_map_events.<ISO>.json
data/backups/nycif_all_radar_map_events.<ISO>.json   # if that file will be touched
data/backups/nycif_staged_live_events.<ISO>.json     # if that file will be touched
```

### Required publish report

```text
data/reports/production_feed_publish_report.json
```

Must document pre/post row counts, preserved manual record count, backup paths, and merge strategy.

### Post-merge verification

1. Verify raw GitHub URLs return expected JSON:
   - https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json
   - https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json
   - https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json
2. Browser-test public map behavior after feed update (major-only default, manual NYPD records visible, no broken pins).
3. **Do not touch WordPress** until feed URLs are verified good.

### Rollback triggers

- `manual_records_removed > 0`
- Missing manual/NYPD records after publish
- Invalid coordinates outside NYC bounds
- Empty or broken major feed
- Unexpected row count drop beyond agreed threshold
- Any of the 896 needs-review rows appear in production major feed without approval

### Rollback procedure

1. Revert the publish commit in live-feeds, **or**
2. Restore backup JSON over production paths and commit with report reference.
3. Re-verify raw GitHub URLs and public map smoke test.

---

## 7. QA gates

All gates below must pass **before** opening the live-feeds production publish PR:

| # | Gate | Status |
|---|---|---|
| 1 | C5G4 preview review page QA passed | **passed** |
| 2 | 12 preview rows visible on review page | **passed** |
| 3 | 11 manual records preserved (`manual_records_removed: 0`) | **passed** |
| 4 | 1 approved-geocode tvpp row visible (`914695`) | **passed** |
| 5 | 896 blocked rows not published | **passed** (blocked in preview only) |
| 6 | No fabricated times | **required** |
| 7 | No fabricated coordinates | **required** — only approved exact geocode applied |
| 8 | No fabricated popularity/crowd claims | **required** |
| 9 | No “verified crowd” claims | **required** |
| 10 | Production feed backups created in live-feeds before publish | **pending** |
| 11 | Howard explicitly approves exact production files before publish | **pending** |

---

## 8. Exact approval wording for Howard

Use this suggested approval phrase:

```text
I approve creating a separate setoxxx/nycif-live-feeds production-publish PR that preserves the 11 manual/NYPD records, adds only the approved-geocode Queensboro Dance Festival row, keeps the 896 needs-review rows blocked, creates rollback snapshots first, and does not touch WordPress or public UI.
```

Optional extended approval listing exact files:

```text
I approve production overwrite of:
- nycif_major_radar_map_events.json
- nycif_all_radar_map_events.json
- data/nycif_staged_live_events.json
in setoxxx/nycif-live-feeds after rollback backups are committed.
Preview report reviewed: data/reports/preview_major_feed_report.json
Readiness report reviewed: data/reports/major_event_production_readiness_report.json
Signed: Howard
Date: YYYY-MM-DD
```

Without explicit approval, **do not publish**.

---

## 9. Current production status

| Flag | Value |
|---|---|
| `production_feeds_modified` | false |
| `public_ui_modified` | false |
| `wordpress_modified` | false |
| `production_publish_blocked_until_explicit_approval` | true |
| `production_publish_allowed_now` | false |

---

## Next step

1. Howard reviews this readiness report and the C5G4 preview review page.
2. If approved, open a **separate** production publish PR in `setoxxx/nycif-live-feeds` only.
3. Do **not** publish production feeds from this field-desk PR or without exact written approval.
