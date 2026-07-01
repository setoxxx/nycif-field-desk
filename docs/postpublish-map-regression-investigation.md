# Post-Publish Map Regression Investigation (C5PV-F)

Status: **investigation report only**. No production feeds, public UI logic, WordPress, or protected files are modified by this document or its companion JSON report.

Machine-readable companion: `data/reports/postpublish_map_regression_investigation.json`

Test URL used: https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-01&resetFilters=1

---

## Executive summary

**Suspected root cause: field-desk public-map filter defaults, not live-feeds JSON corruption.**

After live-feeds PR #1 (`1ab5a08`), raw production feeds validate correctly (582 major rows, 11 manual/NYPD preserved, row `914695` at approved coordinates, 896 needs-review rows not published). Howard’s reported map failure is **reproduced** when `resetFilters=1` applies public-map defaults that set **all category filters to `false`**, while `app-v06-safe.js` requires at least one enabled category before any event can render.

**Do not rollback live-feeds PR #1** based on current evidence. Feeds are valid.

**Recommended fix path:** minimal field-desk hotfix to public default category prefs (+ optional service-worker feed-cache hardening). Do not touch WordPress.

---

## 1. Browser console / runtime errors

Automated browser session on the test URL:

| Check | Result |
|---|---|
| JavaScript console errors observed | **none** in automation session |
| Feed fetch from page context | **succeeded** |
| `app-v06-safe.js` boot failure | **not observed** |
| `public-approved-overlays-v01.js` control injection | **succeeded** (`approvedPublicOverlaysBlock` present) |

Howard’s symptoms (0 assignments, stuck loading) are consistent with **filter state hiding all rows**, not an uncaught exception during boot.

---

## 2. Service worker / cache

| Check | Result |
|---|---|
| Service worker registered | **yes** — `service-worker.js` |
| Cache name | `nycif-v013-major-default` |
| SW controls page | **yes** in automation |

**Stale feed cache observed:**

| Source | Major feed row count |
|---|---:|
| `curl` raw GitHub URL (current production) | **582** |
| Browser fetch via page (automation) | **786** |

`service-worker.js` caches successful responses from `raw.githubusercontent.com` and may serve an older cached major feed body. This causes confusion during QA but **does not alone explain 0 visible assignments** when category filters are all disabled.

**Recommendation:** network-first or no long-term cache for live-feed JSON URLs; bump `CACHE_NAME` after fix. Do not modify service worker until hotfix plan is approved.

---

## 3. Feed JSON validation

Validated 2026-07-01 after live-feeds PR #1 merge:

| File | Parse | Row count | Notes |
|---|---|---:|---|
| `nycif_major_radar_map_events.json` | OK | **582** | matches publish report |
| `nycif_all_radar_map_events.json` | OK | **12210** | matches publish report |
| `data/nycif_staged_live_events.json` | OK | **27918** (`events` array) | not modified by PR #1 |

Additional checks on major feed:

- duplicate `id` values: **none**
- duplicate `source_record_id` values: **none**
- invalid lat/lng: **none**
- all rows pass `makeEvent()` coordinate bounds check: **yes**

---

## 4. Row 914695 validation

| Field | Backup (pre-publish) | Production (post-publish) |
|---|---|---|
| `id` | `914695` | `914695` |
| lat | 40.74726 | **40.739312** |
| lng | -73.84333 | **-73.842193** |
| `geocode_source` | `nyc_planning_geosearch` | **`normalized_exact`** |
| `approved_geocode_applied` | absent | **true** |
| `source_record_id` | absent | **`914695` (string)** |

New fields added by C5P publish (non-breaking): `approved_geocode_applied`, `safety_note`, `source_name`, `source_url`, `source_record_id`, `major_score`, `expected_crowd_signal`, `production_publish_phase`, `c5p_publish_source`.

**Schema regression verdict:** no evidence that row `914695` changes crash the frontend. Simulated `makeEvent()` parsing succeeds; `dateKey` resolves to `2026-07-02`.

**Minor inconsistency (non-fatal):** row still has legacy `start_time`/`end_time` (`10:00 PM`) while `start_date_time` was updated to `2026-07-02T18:00:00.000`. Frontend uses `start_date_time` first.

---

## 5. Manual/NYPD preservation and blocked rows

| Check | Result |
|---|---|
| Manual/NYPD records in raw major feed | **11** |
| `manual_records_removed` | **0** |
| 896 needs-review rows in production major feed | **0** |
| Needs-review preview file published to production | **no** |

Howard report item “896 blocked rows absent: no” likely reflects checklist failure (blocked rows still blocked in feeds; map shows 0 events for unrelated filter reason, not 896 preview rows).

---

## 6. Frontend script loading check (main branch)

| File | Production `index.html` loads? | Status |
|---|---|---|
| `public-map-autoload-v01.js` | **no** | correct (admin/test only elsewhere) |
| `public-map-defaults-v01.js?v=03` | **yes** | loaded |
| `app-v06-safe.js?v=major-default-v03` | **yes** (module) | loaded |
| `public-approved-overlays-v01.js?v=03` | **yes** | loaded; controls injected |
| `service-worker.js` | registered at boot | active |
| `staged-review-autoload-v01.js` | **yes** | inactive unless staged query params |

Default version token: **`major-only-v03`**

---

## 7. Root cause analysis

### Primary root cause (confirmed)

**Public-map default prefs disable every category filter on reset.**

When test URL includes `resetFilters=1`:

1. `public-map-defaults-v01.js` writes localStorage defaults with all categories `false`.
2. `app-v06-safe.js` `loadPublicMapPrefs()` applies the same all-`false` categories.
3. `eventMatches()` rejects every row because:

```javascript
if (!state.categories[event.category.key]) return false;
```

4. Result: **`0 assignments`**, no NYPD pins, no Queensboro pin, major-only checkbox appears checked but map looks empty/broken.

Observed localStorage after reset:

```json
{
  "majorOnly": true,
  "categories": {
    "sports": false,
    "parade": false,
    "market": false,
    "arts": false,
    "parks": false,
    "general": false
  },
  "nycifDefaultVersion": "major-only-v03"
}
```

With **correct category defaults** (`sports/parade/market/arts: true`), simulated visibility on current production major feed:

| Date | Visible major rows | NYPD | Queensboro (`914695`) |
|---|---:|---:|---:|
| 2026-06-28 | 58 | 3+ | 0 |
| 2026-07-02 | 2 | 0 | 1 |

### Secondary factor (cache)

Service worker may serve stale major feed (`786` rows in browser vs `582` current). Contributes to QA confusion; not primary cause of zero visible events.

### Not root cause

- live-feeds PR #1 JSON corruption
- publishing 896 needs-review rows
- loss of manual/NYPD records in production feed
- WordPress / iframe changes

---

## 8. Recommended fix path

### Preferred: field-desk minimal hotfix (do **not** rollback feeds)

1. **`app-v06-safe.js`** — in `getPublicDefaultPrefs()`, enable default categories:
   - `sports: true`, `parade: true`, `market: true`, `arts: true`, `parks: false`, `general: false`
2. **`public-map-defaults-v01.js`** — match the same category defaults.
3. **Optional hardening:** bump `?v=` on those scripts in `index.html` for cache bust.
4. **`service-worker.js`** — bump `CACHE_NAME`; use network-first for `raw.githubusercontent.com` feed JSON (only if approved in hotfix PR).

### Do **not** do (unless new evidence)

- Roll back live-feeds PR #1 (feeds validate; rollback would undo approved geocode)
- Republish 896 blocked rows
- Touch WordPress, iframe/embed, or scheduled workflows

---

## 9. Rollback recommendation

| Action | Recommendation |
|---|---|
| Rollback live-feeds PR #1 | **Not recommended** — feeds valid; regression is filter-default behavior |
| Rollback only if new evidence of JSON corruption | restore from `data/backups/nycif_major_radar_map_events.2026-07-01T19-55-07-881Z.json` |
| Field-desk hotfix | **Recommended** — fix category defaults + optional SW cache |

---

## 10. Howard re-test steps (after hotfix)

1. Open (hard refresh / disable cache):
   ```text
   https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-02&resetFilters=1
   ```
2. DevTools → Application → Service Workers → **Unregister** (one-time during QA).
3. Confirm **Major events only** checked.
4. Select **Sun 6/28** → expect NYPD/manual pins.
5. Select **Thu 7/2** → search `Queensboro` or `914695`.
6. Open Filters → confirm overlay labels listed.
7. Confirm map does **not** show 896 preview needs-review rows.
8. Tap **Show more events** once → should complete or show error (not spin forever).

---

## 11. Next step

1. Open field-desk hotfix PR for category default correction (minimal scope).
2. Re-run browser QA with steps above.
3. Do **not** close production publish cycle until browser QA passes.
4. Do **not** touch WordPress.
