# Major-Event Live-Feed Integration Plan (C3)

Status: **planning/report only**. No production feed outputs, no public UI changes, no WordPress changes.

Machine-readable companion: `data/reports/major_event_live_feed_integration_plan.json`

## PROJECT STATUS

| Field | Value |
|---|---|
| Phase | C3 — Live-Feed Integration Planning |
| Mode | Planning only |
| Production feeds modified | **false** |
| WordPress modified | **false** |
| Public map modified | **false** |
| Prototype review URL | https://setoxxx.github.io/nycif-field-desk/prototype-major-events-review.html?v=c2b-01 |

### Completed phases

| Phase | PR | Outcome |
|---|---|---|
| C1 | #31 | Report-only tvpp source audit runner |
| C2 | #32 | Prototype major-event builder (`build-prototype-major-events.mjs`) |
| C2B | #33 | Standalone prototype review page on GitHub Pages |

### Verified C2 prototype counts (2026-07-01)

| Metric | Count |
|---|---:|
| source_rows | 30,210 |
| mapped_rows | 0 |
| needs_review_rows | 897 |
| rejected_rows | 29,313 |
| july_4_source_rows | 844 |
| july_4_mapped_rows | 0 |
| july_4_needs_review_rows | 52 |
| missing_geocode_count | 897 |
| vague_location_count | 0 |
| time_needs_review_count | 9 |

**C2 finding:** `mapped_rows = 0` because tvpp has no native lat/lng and cache-only geocoding did not match event locations. All 897 major candidates landed in `needs_review`, not silent rejection.

---

## 1. Repository ownership

### Recommendation

| Responsibility | Repository | Rationale |
|---|---|---|
| Source audit, prototype builder, review UI, preview builder | `setoxxx/nycif-field-desk` | Frontend repo already owns audit tools, prototype outputs, and the GitHub Pages review dashboard. Keeps public-map QA close to review surfaces. |
| Final production feed JSON, staged QA sync, rollback snapshots | `setoxxx/nycif-live-feeds` | Backend repo is already the source of truth for `nycif_major_radar_map_events.json`, `nycif_all_radar_map_events.json`, and `data/nycif_staged_live_events.json`. Hourly QA workflow lives here. |
| Production overwrite | **Neither repo until C5 + explicit Howard approval** | C3/C4 must not write production files. |

### Integration boundary

```text
field-desk (C2/C2B/C4)
  └─ prototype + preview artifacts + human review sheets
       │
       │  QA approval only
       ▼
nycif-live-feeds (C5, explicit approval)
  └─ production feed JSON + rollback backup + publish report
```

Both repos must follow their respective `AGENTS.md` gates. The frontend must not silently promote GPS or overwrite backend production feeds.

---

## 2. Data flow

### Current state (C2 complete)

```text
NYC Open Data tvpp-9vvx
  │
  ▼
tools/feed-audit/build-prototype-major-events.mjs   (field-desk)
  │
  ├─► data/prototype_major_events.json              (mapped; currently [])
  ├─► data/prototype_major_events_needs_review.json (897 rows)
  └─► data/reports/prototype_major_events_report.json
  │
  ▼
prototype-major-events-review.html                  (C2B QA dashboard)
```

### Future state (C4 preview → C5 production)

```text
tvpp-9vvx
  │
  ▼
build-preview-major-feed.mjs                        (C4, field-desk)
  │  inputs:
  │    - tvpp source (live fetch)
  │    - approved human review decisions (C4)
  │    - approved geocode overrides (read-only file)
  │    - existing manual/hard-written records (read from live-feeds, merge-only)
  │
  ├─► data/preview_major_feed.json
  ├─► data/preview_all_feed.json
  ├─► data/preview_staged_feed.json
  ├─► data/preview_major_feed_needs_review.json     (residual review queue)
  └─► data/reports/preview_major_feed_report.json
  │
  ▼  (Howard explicit approval + all QA gates pass)
  │
build/publish-production-feed.mjs                     (C5, live-feeds only)
  │  writes backup first:
  │    - data/backups/nycif_major_radar_map_events.<timestamp>.json
  │    - data/backups/nycif_all_radar_map_events.<timestamp>.json
  │    - data/backups/nycif_staged_live_events.<timestamp>.json
  │
  ├─► nycif_major_radar_map_events.json              (production)
  ├─► nycif_all_radar_map_events.json                (production)
  └─► data/nycif_staged_live_events.json             (production)
  │
  ▼
Public map (unchanged URLs in app-v06-safe.js)
  └─ loads production feeds from nycif-live-feeds raw URLs
```

### Row disposition rules (carry forward from C2)

| Disposition | Meaning | Future feed slot |
|---|---|---|
| `mapped` | Scored major candidate + valid geocode + no blocking review flags | `preview_major_feed.json` / production major |
| `needs_review` | Major candidate but missing geocode, vague location, time issue, headline July 4, or routine sports on July 4 | Review queue until human decision |
| `rejected` | Below major threshold and not headline July 4 | Excluded from major feed; may appear in all feed only if explicitly approved |

**Hard rule:** headline July 4 rows never land in `rejected`. They must be `mapped` or `needs_review`.

---

## 3. Human review gate

### Review artifact (C4)

Create a human-editable review sheet derived from prototype/preview needs-review rows:

```text
data/major_event_human_review_decisions.json   (field-desk, C4)
```

Each row records a decision against `source_record_id` / `event_id`.

### Allowed decisions

| Decision | Effect |
|---|---|
| `approve` | Promote to mapped/preview major feed when geocode and time are acceptable |
| `reject` | Exclude from major feed (not allowed for headline July 4 without explicit override note) |
| `needs_geocode` | Hold in review queue; requires coordinate entry before promotion |
| `needs_better_time` | Hold until start/end times are verified or corrected from source |
| `needs_better_source` | Hold until permit/source fields are verified; do not fabricate details |
| `duplicate` | Exclude as duplicate of another approved row; link `duplicate_of` id |
| `manual_override` | Force inclusion with documented reason; requires lat/lng if mapped |

### Review workflow

1. Reviewer opens prototype review page (C2B) or future preview review page (C4).
2. Filter by July 4, headline July 4, missing geocode, time needs review.
3. Record decision in `major_event_human_review_decisions.json`.
4. C4 preview builder reads decisions + geocode overrides and rebuilds preview feeds.
5. Preview report counts must be reviewed before any C5 production publish.

### Blockers before promotion

- Row with `missing_geocode` cannot be `approve` until coordinates exist in approved override file.
- Row with `time_needs_review` cannot be `approve` until time is verified or marked acceptable from source.
- No fabricated times, locations, crowd scores, or popularity claims.

---

## 4. Geocoding strategy (C4)

C2 proved cache-only lookup against `data/location_cache.json` yields **0 mapped rows** because cache keys are mostly smoke/vape retailer entries, not tvpp event locations.

### Safe C4 approach (recommended order)

| Option | Description | Risk | Approval required |
|---|---|---|---|
| **A. Manual review geocode file** | Human enters lat/lng for approved rows in `data/approved_major_event_geocodes.json` | Low — explicit human coordinates | Yes, per row |
| **B. Read-only approved overrides** | Builder reads overrides only; never writes cache | Low | Yes |
| **C. Review export for coordinate entry** | Export CSV/JSON subset (headline July 4, high-score rows) for human geocoding | Low | Export only |
| **D. Controlled geocoder run** | Future script geocodes only approved rows, writes to override file not cache | Medium | Explicit phase approval |
| **E. Blind cache write** | Auto-write to `data/location_cache.json` | **Blocked** | Never without explicit approval |

### C4 geocoding rules

1. **Never** write blindly to `data/location_cache.json`.
2. Geocode overrides live in a dedicated approved file, version-controlled with review decisions.
3. All coordinates must pass NYC bounds check (same as C2 builder).
4. `geocode_source` must be explicit: `human_review`, `approved_override`, `cemsid_bridge` (if CEMSID lookup added later).
5. Rows without approved coordinates stay in `needs_review` / preview review queue.
6. No client-side geocoding on the public map.

### Expected C4 geocode file

```text
data/approved_major_event_geocodes.json
```

Schema (per row):

```json
{
  "source_record_id": "910885",
  "lat": 40.5751,
  "lng": -73.9707,
  "display_location": "Nathan's Famous, Coney Island",
  "geocode_source": "human_review",
  "approved_by": "howard",
  "approved_at": "2026-07-XX"
}
```

---

## 5. July 4 coverage strategy

### Problem

Production major feed is stale (metadata ~2026-06-27) and missing headline July 4 events despite **844** tvpp rows on 2026-07-04.

### C2 prototype protection (already implemented)

The C2 builder uses `HEADLINE_JULY4_RE` and `isHeadlineJuly4()` to force headline rows into `needs_review` instead of rejection:

- fireworks
- parade
- Independence Day
- Nathan's
- block party
- Huck Finn
- July 4 / July 4th

C2 report `headline_july_4_coverage` lists every headline row with disposition. C2B review page exposes Headline July 4 filter (9 rows in UI filter; 24 with `headline_july_4_requires_review` tag in report).

### C4/C5 requirements

1. Carry forward C2 headline detection regex and **never silent-reject** headline rows.
2. Preview report must include `headline_july_4_coverage` with disposition for each headline row.
3. QA gate: all headline July 4 rows must be human-reviewed before C5.
4. Production major feed publish must assert headline rows are either mapped or explicitly held in review with documented reason — not absent.
5. Routine July 4 sports (52 needs_review rows) stay in review queue unless explicitly approved.

---

## 6. Manual / hard-written feed preservation

Current `nycif_major_radar_map_events.json` includes hard-written NYPD field-intel and manual priority records, e.g.:

- `verification_status: nypd_field_intel`
- `_manual_priority: NYPD`
- ids like `nypd-hardwrite-*`

### Preservation rules (C4/C5)

1. **Merge, not replace:** preview/production builders must load existing production major (and relevant all-feed manual rows) and union with generated tvpp rows.
2. Manual records are identified by:
   - `verification_status === 'nypd_field_intel'`
   - `_manual_priority` set
   - `source_file` matching manual/hardwrite patterns
   - id prefix `nypd-hardwrite-`
3. Generated pipeline must **never delete** manual records unless Howard explicitly approves a removal list.
4. Dedupe key: prefer stable `id`; secondary crosswalk on title+date+borough only when merging tvpp into existing feed.
5. C5 publish report must list `manual_records_preserved_count` and `manual_records_removed` (expected: 0 removed).

---

## 7. Output strategy

### C3 (this phase)

Planning docs only. No preview or production outputs.

### C4 (preview builder only)

| Output | Purpose |
|---|---|
| `data/preview_major_feed.json` | Candidate major feed for QA |
| `data/preview_all_feed.json` | Candidate full feed for QA |
| `data/preview_staged_feed.json` | Candidate staged feed for QA |
| `data/preview_major_feed_needs_review.json` | Residual review queue |
| `data/reports/preview_major_feed_report.json` | Counts, gates, headline coverage |

Optional review surfaces (admin-only, not public map):

- `preview-major-events-review.html` (future; mirrors C2B pattern)

### C5 (production publish — blocked until explicit approval)

Production files **must remain untouched** until Howard explicitly approves:

- `nycif_major_radar_map_events.json`
- `nycif_all_radar_map_events.json`
- `data/nycif_staged_live_events.json`

C5 runs only in `nycif-live-feeds` after all QA gates pass.

---

## 8. QA gates before production overwrite

All gates must pass before C5:

| # | Gate | Verification |
|---|---|---|
| 1 | Prototype review page approved | C2B QA sign-off complete |
| 2 | Headline July 4 rows reviewed | Each headline row has human decision |
| 3 | Geocoding reviewed | No promoted row with unapproved coordinates |
| 4 | No fabricated times | Times match source or documented correction |
| 5 | No fabricated locations | display_location traceable to source or override |
| 6 | No unsupported popularity/crowd claims | No invented `expected_crowd_score` / `crowd_level` |
| 7 | Manual/hard-written records preserved | Count matches pre-publish snapshot |
| 8 | Rollback file created | Timestamped backups in live-feeds repo |
| 9 | Report counts reviewed | Preview report matches human expectations |
| 10 | Browser test passes | Public map loads production URLs; spot-check July 4 + manual records |
| 11 | Howard explicitly approves production feed update | Written approval required |

---

## 9. Rollback plan

If C5 production publish fails or regresses the public map:

### Before publish (required)

1. Copy current production files to timestamped backups:

```text
nycif-live-feeds/data/backups/nycif_major_radar_map_events.<ISO>.json
nycif-live-feeds/data/backups/nycif_all_radar_map_events.<ISO>.json
nycif-live-feeds/data/backups/nycif_staged_live_events.<ISO>.json
```

2. Write `data/reports/production_feed_publish_report.json` with pre/post counts.

### Rollback steps

1. **Commit-based rollback:** revert the C5 publish commit in `nycif-live-feeds` or restore backup files in a hotfix commit.
2. **Snapshot restore:** copy backup JSON over production paths; commit with report referencing backup timestamp.
3. **Verify:** fetch raw GitHub URLs; confirm major feed row count and manual records restored.
4. **Browser test:** load public map default view; confirm major-only filter and manual NYPD records visible.
5. **WordPress:** do not touch iframe/embed until feed URLs verified good.

### Rollback triggers

- Missing headline July 4 events after publish
- Manual/NYPD records dropped
- Invalid coordinates outside NYC bounds
- Map load errors or empty major feed
- Unexpected row count drop > agreed threshold

---

## 10. Future C4 allowed files

C4 may create/modify **only** these files (field-desk):

| File | Purpose |
|---|---|
| `tools/feed-audit/build-preview-major-feed.mjs` | Preview feed builder |
| `data/preview_major_feed.json` | Preview major feed |
| `data/preview_all_feed.json` | Preview all feed |
| `data/preview_staged_feed.json` | Preview staged feed |
| `data/preview_major_feed_needs_review.json` | Residual review queue |
| `data/reports/preview_major_feed_report.json` | Preview QA report |
| `data/major_event_human_review_decisions.json` | Human review decisions |
| `data/approved_major_event_geocodes.json` | Approved coordinate overrides |
| `preview-major-events-review.html` | Optional preview review UI (admin-only) |

C4 **must not** write production feed files or modify public map entrypoints.

---

## 11. Future production publish phase (C5)

C5 is a separate phase requiring explicit Howard approval before touching:

- `nycif_major_radar_map_events.json`
- `nycif_all_radar_map_events.json`
- `data/nycif_staged_live_events.json`

C5 allowed scope (live-feeds repo only):

- Publish script/workflow with backup + report
- Timestamped rollback backups
- `data/reports/production_feed_publish_report.json`

C5 must not modify WordPress, iframe settings, or field-desk public UI.

---

## Phase breakdown

| Phase | Scope | Production writes |
|---|---|---|
| **C3** (this PR) | Integration plan + JSON report | **None** |
| **C4** | Preview builder + human review artifacts + optional preview review page | **None** (preview files only) |
| **C5** | Production feed publish in live-feeds | **Only after explicit approval + all QA gates** |

---

## Next step

After C3 plan approval:

**Start C4 preview builder only, not production feed publishing.**

Human review of prototype rows (July 4 / headline / missing-geocode) should continue on the C2B review page while C4 tooling is built.
