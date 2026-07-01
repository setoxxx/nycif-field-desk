# Major Feed Production Publish Closeout (C5P-CLOSEOUT)

Status: **final verification closeout report only**. This document and its companion JSON report do not modify production feeds, public UI, WordPress, or any protected files.

Machine-readable companion: `data/reports/major_feed_production_publish_closeout.json`

Related artifacts:

- C5P live-feeds publish: `setoxxx/nycif-live-feeds` PR #1 (`1ab5a08`)
- C5PV-F investigation: `docs/postpublish-map-regression-investigation.md`
- Field-desk hotfix: PR #44 (`c1b40ea58b51d8222c5bd6e58577fdb4c31f90e8`)

## PROJECT STATUS

| Field | Value |
|---|---|
| Phase | C5P-CLOSEOUT — Final Production Publish Verification Closeout |
| Mode | Closeout report only — no feed or UI changes |
| Production feeds modified by this PR | **false** |
| Field-desk public UI modified | **false** |
| WordPress modified | **false** |
| Production publish cycle status | **verified_closed** |

---

## Safety statements

**This PR is closeout-report only and does not modify production feed outputs, public UI, WordPress, iframe/embed settings, scheduled workflows, or `data/location_cache.json`.**

**C5P production publish cycle is verified closed.**

**WordPress remains untouched.**

---

## 1. Production publish summary

| Field | Value |
|---|---|
| Live-feeds repo | `setoxxx/nycif-live-feeds` |
| Live-feeds PR | #1 |
| Live-feeds merge commit | `1ab5a08` |
| Action | In-place approved-geocode update for `source_record_id` **914695** only |

### Row updated

| Field | Value |
|---|---|
| Title | 2026 Queensboro Dance Festival |
| `source_record_id` | `914695` |
| lat | 40.739312 |
| lng | -73.842193 |

| Metric | Value |
|---|---:|
| preserved_manual_records | 11 |
| manual_records_removed | 0 |
| blocked_needs_review_rows_published | 0 |

Production feed URLs (unchanged):

```text
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json
```

Raw feed verification after publish:

| Check | Result |
|---|---|
| raw major feed verified | **yes** (582 rows) |
| raw all feed verified | **yes** (12210 rows) |

---

## 2. Regression investigation summary

Initial browser QA failed after live-feeds PR #1 production publish.

| Finding | Detail |
|---|---|
| Root cause | Field-desk default category filters all `false` on `resetFilters=1` |
| Live-feeds JSON cause | **no** — feeds validated; row 914695 coordinates correct |
| Live-feeds rollback needed | **no** |

Investigation report: `docs/postpublish-map-regression-investigation.md` (field-desk PR #43)

---

## 3. Hotfix summary

| Field | Value |
|---|---|
| Field-desk PR | #44 |
| Merge commit | `c1b40ea58b51d8222c5bd6e58577fdb4c31f90e8` |

Changed files (in PR #44, not this closeout PR):

- `app-v06-safe.js`
- `public-map-defaults-v01.js`
- `service-worker.js`
- `index.html`

Fix applied:

- Enabled sports / parade / market / arts by default in public-map prefs
- Bumped default version to `major-only-v04`
- Bumped service worker cache to `nycif-v014-category-defaults-fix`
- Bumped script query strings in `index.html`

---

## 4. Final browser QA result

Test URL:

```text
https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-02&resetFilters=1
```

Test procedure:

| Step | Result |
|---|---|
| Service worker unregistered once | **yes** |
| localStorage cleared | **yes** |
| Hard refresh | **yes** |
| GitHub Pages deployed (PR #44 on `c1b40ea`) | **yes** |

| Check | Result |
|---|---|
| Page loads | **yes** |
| Major-only default works | **yes** |
| Today markers without manual category enable | **yes** |
| Today marker count | **25** |
| 2026-06-28 NYPD/manual pins visible | **yes** |
| 2026-06-28 assignment/marker count | **106** |
| 2026-07-02 Queensboro / 914695 visible or findable | **yes** |
| Queensboro coordinates verified | **40.739312, -73.842193** |
| 896 blocked rows absent | **yes** |
| Approved overlays listed | **yes** |
| WordPress untouched | **yes** |

---

## 5. Approved overlays still listed

- 🔥 It's 5PM Somewhere
- ✅ Cannabis Dispensaries
- 🔎 Smoke/Vape/Cannabis Correlation

---

## 6. Safety statement

| Item | Status |
|---|---|
| WordPress untouched | **yes** |
| iframe/embed untouched | **yes** |
| scheduled workflows untouched | **yes** |
| `location_cache.json` untouched | **yes** |
| 896 blocked rows not published | **yes** |
| Live-feeds rollback needed | **no** |

---

## 7. Final status

| Field | Value |
|---|---|
| production_publish_cycle_status | `verified_closed` |
| next_step | Monitor normally; do not touch WordPress. |
