# Major-Event Production Publish Checklist (C5)

Status: **approval checklist / release gate only**. No production feed outputs are modified by this document or its companion JSON report.

Machine-readable companion: `data/reports/major_event_production_publish_checklist.json`

## PROJECT STATUS

| Field | Value |
|---|---|
| Phase | C5 — Production Publish Approval Checklist |
| Mode | Checklist only — no production publish |
| Production feeds modified | **false** |
| WordPress modified | **false** |
| Public map modified | **false** |
| Prototype review URL | https://setoxxx.github.io/nycif-field-desk/prototype-major-events-review.html?v=c2b-01 |

### Completed phases

| Phase | PR | Outcome |
|---|---|---|
| C1 | #31 | Report-only tvpp source audit runner |
| C2 | #32 | Prototype major-event builder |
| C2B | #33 | Prototype review page (GitHub Pages) |
| C3 | #34 | Live-feed integration plan |
| C4 | #35 | Preview major feed builder and preview outputs |

### Current preview counts (C4 merge `cbeb650`)

| Metric | Count |
|---|---:|
| preview_major_feed_rows | 11 |
| preview_all_feed_rows | 14 |
| preview_staged_rows | 11 |
| preview_needs_review_rows | 897 |
| preserved_manual_records | 11 |
| manual_records_removed | 0 |
| missing_geocode_count | 897 |
| headline_july_4_in_preview_or_review | true |

Preview artifacts:

```text
data/preview_major_feed.json
data/preview_all_feed.json
data/preview_staged_feed.json
data/preview_major_feed_needs_review.json
data/reports/preview_major_feed_report.json
```

Rebuild preview outputs:

```bash
node tools/feed-audit/build-preview-major-feed.mjs
```

---

## Safety statements

**No production feed files are modified by this checklist PR.**

**Production publishing requires a separate PR in `setoxxx/nycif-live-feeds` and explicit Howard approval.**

This checklist does not overwrite:

- `nycif_major_radar_map_events.json`
- `nycif_all_radar_map_events.json`
- `data/nycif_staged_live_events.json`

---

## Pre-publish approval checklist

All items must be checked before any production feed overwrite.

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | PR #35 preview outputs merged to `main` | Required | Merge commit `cbeb650`; preview files present on `main` |
| 2 | `preview_major_feed.json` preserves 11 manual/NYPD-style records | Required | `preserved_manual_records: 11` in preview report |
| 3 | `manual_records_removed` is 0 | Required | Preview report + manual count diff |
| 4 | `preview_major_feed_needs_review.json` contains 897 rows | Required | Preview report `preview_needs_review_rows: 897` |
| 5 | `headline_july_4_in_preview_or_review` is true | Required | Preview report July 4 coverage block |
| 6 | Missing-geocode tvpp rows are not promoted into major preview pins | Required | `preview_major_feed_rows: 11` (manual only); 897 rows remain in needs-review |
| 7 | No fabricated times, locations, popularity, expected crowd, or verified-crowd claims | Required | Preview rows use C2 fields only (`expected_crowd_signal`, `safety_note`, source timestamps) |
| 8 | Production feed rollback snapshots will be created before any publish | Required | Backups committed in live-feeds before overwrite |
| 9 | Production publish happens in `setoxxx/nycif-live-feeds`, not by silently changing field-desk preview files | Required | Separate live-feeds publish PR |
| 10 | WordPress remains untouched | Required | No iframe/embed/WordPress PR in publish batch |
| 11 | Public map UI remains untouched | Required | No changes to `index.html`, `app-v06-safe.js`, overlay scripts |
| 12 | Howard explicitly approves the exact production files before overwrite | Required | Written approval naming each target file |

---

## Blocked production files

These files must not be overwritten until every checklist item above is satisfied **and** Howard gives explicit approval:

| File | Repo | Role |
|---|---|---|
| `nycif_major_radar_map_events.json` | `setoxxx/nycif-live-feeds` | Default public map major feed |
| `nycif_all_radar_map_events.json` | `setoxxx/nycif-live-feeds` | Full / show-more feed |
| `data/nycif_staged_live_events.json` | `setoxxx/nycif-live-feeds` | Backend staged QA feed |

Public map URLs (unchanged):

```text
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json
```

---

## Rollback plan (required before publish)

Execute in `setoxxx/nycif-live-feeds` **before** overwriting production files.

### 1. Create timestamped backups

```text
data/backups/nycif_major_radar_map_events.<ISO>.json
data/backups/nycif_all_radar_map_events.<ISO>.json
data/backups/nycif_staged_live_events.<ISO>.json
```

### 2. Write publish report

```text
data/reports/production_feed_publish_report.json
```

Report must include pre/post row counts, preserved manual record count, and backup file paths.

### 3. Rollback if publish fails

1. Revert the publish commit in live-feeds, **or**
2. Restore backup JSON over production paths and commit with report reference.
3. Verify raw GitHub URLs return expected content.
4. Browser-test public map default view (major-only filter, manual NYPD records visible).
5. **Do not touch WordPress** until feed URLs are verified good.

### Rollback triggers

- Missing headline July 4 events after publish
- Manual/NYPD records dropped (`manual_records_removed > 0`)
- Invalid coordinates outside NYC bounds
- Empty or broken major feed
- Unexpected row count drop beyond agreed threshold

---

## Approval gate

Production publish is **blocked** until:

1. Every checklist item in this document is marked satisfied.
2. Preview outputs are rebuilt and report counts re-reviewed.
3. Headline July 4 rows are human-reviewed (geocode decisions documented if promoted).
4. Howard provides **explicit written approval** listing the exact production files to overwrite.

Approval template:

```text
I approve production overwrite of:
- nycif_major_radar_map_events.json
- nycif_all_radar_map_events.json
- data/nycif_staged_live_events.json
in setoxxx/nycif-live-feeds after rollback backups are committed.
Signed: Howard
Date: YYYY-MM-DD
Preview report reviewed: data/reports/preview_major_feed_report.json
```

Without this approval, **do not publish**.

---

## Future production publish PR (live-feeds only)

When checklist and approval are complete, open a **separate PR** in `setoxxx/nycif-live-feeds` — not in field-desk preview files.

### Expected publish PR scope

| Action | Path |
|---|---|
| Backup (pre-publish) | `data/backups/nycif_major_radar_map_events.<ISO>.json` |
| Backup (pre-publish) | `data/backups/nycif_all_radar_map_events.<ISO>.json` |
| Backup (pre-publish) | `data/backups/nycif_staged_live_events.<ISO>.json` |
| Publish report | `data/reports/production_feed_publish_report.json` |
| Production overwrite | `nycif_major_radar_map_events.json` |
| Production overwrite | `nycif_all_radar_map_events.json` |
| Production overwrite | `data/nycif_staged_live_events.json` |

Optional future publish script (live-feeds repo only):

```text
scripts/publish_major_feed_from_preview.py
```

### Publish inputs (from field-desk, read-only)

Field-desk preview files are **inputs**, not production targets:

```text
setoxxx/nycif-field-desk/data/preview_major_feed.json
setoxxx/nycif-field-desk/data/preview_all_feed.json
setoxxx/nycif-field-desk/data/preview_staged_feed.json
setoxxx/nycif-field-desk/data/reports/preview_major_feed_report.json
```

### Suggested publish verification commands

```bash
# In nycif-live-feeds after publish PR merge
curl -sS "https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json" | jq 'length'
curl -sS "https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json" | jq '.events | length'
```

### Public map smoke test (after live-feeds publish only)

```text
https://setoxxx.github.io/nycif-field-desk/?v=post-publish-qa-01&resetFilters=1
```

Confirm:

- Major-only default still works
- Manual/NYPD records still visible
- No WordPress/iframe changes required for feed-only publish

---

## What this checklist PR does not do

- Does not overwrite production feed files
- Does not modify WordPress or iframe/embed settings
- Does not modify `index.html`, `app-v06-safe.js`, or public overlay scripts
- Does not modify scheduled workflows
- Does not promote preview needs-review rows without geocode approval
- Does not substitute field-desk preview files for live-feeds production paths

---

## Next step after C5 checklist merge

Human review of preview outputs and headline July 4 / missing-geocode rows. When ready for actual publish, open the **live-feeds production publish PR** only after Howard's explicit approval and rollback backups are in place.
