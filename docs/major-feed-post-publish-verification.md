# Major Feed Post-Publish Verification Report (C5PV)

Status: **post-publish verification report only**. This document and its companion JSON report do not modify production feeds, public UI, WordPress, or any protected files.

Machine-readable companion: `data/reports/major_feed_post_publish_verification.json`

Related artifacts:

- C5R readiness report: `docs/major-event-production-readiness-report.md`
- Live-feeds publish report: `setoxxx/nycif-live-feeds/data/reports/production_feed_publish_report.json`
- Preview review page: https://setoxxx.github.io/nycif-field-desk/preview-major-feed-review.html?v=c5g4-01

## PROJECT STATUS

| Field | Value |
|---|---|
| Phase | C5PV — Post-Publish Verification Report |
| Mode | Report only — no feed or UI changes |
| Production feeds modified by this PR | **false** |
| Field-desk public UI modified | **false** |
| WordPress modified | **false** |

---

## Safety statements

**This PR is report-only and does not modify production feed outputs, public UI, WordPress, iframe/embed settings, scheduled workflows, or `data/location_cache.json`.**

**WordPress remains untouched.**

---

## 1. Production publish summary

| Field | Value |
|---|---|
| Repo | `setoxxx/nycif-live-feeds` |
| PR | #1 |
| Merge commit | `1ab5a08` |
| Action | In-place approved-geocode update for `source_record_id` **914695** only |
| Merge strategy | merge-not-replace |
| Rows added | 0 |
| Rows updated | 1 |

### Row updated

| Field | Value |
|---|---|
| Title | 2026 Queensboro Dance Festival |
| `source_record_id` | `914695` |
| lat | 40.739312 |
| lng | -73.842193 |
| geocode_source | `normalized_exact` |
| `approved_geocode_applied` | true |

Rollback snapshots (live-feeds):

```text
data/backups/nycif_major_radar_map_events.2026-07-01T19-55-07-881Z.json
data/backups/nycif_all_radar_map_events.2026-07-01T19-55-07-881Z.json
```

Production feed URLs:

```text
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json
```

---

## 2. Feed verification

Verified after live-feeds PR #1 merge (`1ab5a08`):

| Check | Result |
|---|---|
| raw major feed verified | **yes** |
| raw all feed verified | **yes** |
| row 914695 coordinates verified | **yes** |
| manual records preserved | **yes** |
| `preserved_manual_records` | **11** |
| `manual_records_removed` | **0** |
| 896 blocked needs-review rows published | **0** |

### Raw feed counts

| Feed | Rows |
|---|---:|
| `nycif_major_radar_map_events.json` | 582 |
| `nycif_all_radar_map_events.json` | 12210 |

### Row 914695 raw verification

| Field | Value |
|---|---|
| lat | 40.739312 |
| lng | -73.842193 |
| `source_record_id` | 914695 |
| `verified_crowd` | absent |
| `expected_crowd_score` | 180 (pre-existing from prior production row; not newly fabricated in C5P) |

---

## 3. Safety confirmations

| Item | Status |
|---|---|
| WordPress untouched | **yes** |
| public UI untouched | **yes** |
| iframe/embed untouched | **yes** |
| scheduled workflows untouched | **yes** |
| `data/location_cache.json` untouched | **yes** |
| `data/nycif_staged_live_events.json` untouched | **yes** |
| field-desk files modified by publish | **no** |

---

## 4. Browser QA status

| Check | Result |
|---|---|
| public map browser test passed | **partial** |
| Page structure OK | **yes** |
| Major events only default | **yes** (confirmed in automation) |
| Public overlays present | **yes** (5PM, Cannabis, Correlation labels) |
| Event pins / NYPD / Queensboro visible | **pending human hard-refresh/date QA** |

Automated browser testing showed `0 assignments` in some sessions (likely feed load/cache in the test harness). Raw GitHub feed URLs confirm correct production data; human browser QA is still required.

---

## 5. Browser QA instructions

### Test URL

```text
https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-01&resetFilters=1
```

### Required checks

1. **Hard refresh / bypass cache** (Shift+Reload or empty cache and hard reload).
2. Confirm **Major events only** default still works.
3. Confirm **manual/NYPD records** still appear.
4. Search or inspect for **`source_record_id` 914695** / **2026 Queensboro Dance Festival**.
5. Confirm coordinates are mapped if the event is visible for the selected date/filter.
6. Test relevant date windows:
   - **2026-06-28** (NYPD/manual records expected)
   - **2026-07-02** (Queensboro row expected)
7. Confirm **896 needs-review rows are not visible**.
8. Confirm approved overlays still appear:
   - 🔥 It's 5PM Somewhere
   - ✅ Legal Cannabis Dispensaries
   - 🔎 Smoke/Vape/Cannabis Correlation
9. Confirm **WordPress was not touched**.

### Expected raw-feed row counts by date (major feed)

| Date | Major rows | NYPD/manual | Queensboro (`914695`) |
|---|---:|---:|---:|
| 2026-06-28 | 79 | 4 | 0 |
| 2026-07-02 | 3 | 0 | 1 |

---

## 6. Remaining risk

- Browser/service-worker/cache can hide the updated feed until hard refresh.
- Date filtering may hide the Queensboro row depending on map date/default state.
- No evidence of a bad feed publish if raw feeds remain correct (`582` major rows, `11` manual preserved, row `914695` at approved coordinates).

---

## 7. Next step

1. Complete browser hard-refresh/date QA using the test URL above.
2. If browser QA passes, close the production publish cycle as verified.
3. If browser QA fails, investigate cache/date-filter behavior only — do not republish feeds or touch WordPress without explicit approval.
