# Master Geocode Reference Audit (C5G)

Status: **audit/report only**. No coordinates written to event rows. No production feed changes.

Machine-readable reports:

- `data/reports/master_geocode_reference_audit.json`
- `data/reports/master_geocode_reference_match_samples.json`

Audit runner:

```bash
node tools/feed-audit/audit-master-geocode-reference.mjs
```

## Summary

Before any production publish, this audit scanned NYCIF geocode/location reference files and tested whether existing assets can resolve tvpp needs-review rows from `data/prototype_major_events_needs_review.json` (897 rows).

### Recommended master reference

**`data/location_cache.json`**

Rationale: normalized `location|borough|` key index used by existing pin pipelines; includes `quality`, `provider`, and geocoded coordinates for ~10,606 entries.

### Secondary references

- `data/nycif_nightlife_spots.json` — large geocoded venue index (nightlife domain)
- `data/nycif_licensed_smoke_vape_retailers.json` — retailer address coordinates
- `data/preview_major_feed.json` — preserved manual/NYPD major-feed records
- `data/nycif_legal_cannabis_dispensaries.json` — dispensary georeferences

## Latest audit counts

| Metric | Count |
|---|---:|
| scanned_files_count | 40 |
| candidate_geocode_files | 14 |
| tvpp_needs_review_rows | 897 |
| exact_match_count | 6 |
| possible_match_count | 249 |
| unmatched_count | 642 |
| headline_july_4_exact_match_count | 0 |
| headline_july_4_possible_match_count | 26 |
| headline_july_4_unmatched_count | 57 |

## Matching methods

**Exact (strict keys only):**

- `normalize(full location)|normalize(borough)`
- `normalize(display_location)|normalize(borough)`
- park/venue prefix before `:`
- first comma segment + borough

**Possible (QA required):**

- park/venue substring against master cache / preview feeds
- street/intersection substring against reference token index
- multiple exact candidates with conflicting coordinates

Street/intersection and substring matches are **not** approval-ready without human review.

## Key findings

1. **Most tvpp rows remain unmatched** (642/897) against existing NYCIF reference assets.
2. **Strict exact matching** avoids false positives from shared street-name keys (e.g. parade routes vs retailer addresses).
3. **Headline July 4 rows** mostly land in `possible_match` or `unmatched`; none received safe exact matches in this audit pass.
4. **`location_cache.json` is retailer-heavy** and does not comprehensively cover tvpp event locations (parks, routes, multi-street closures).
5. **No coordinates were written** to event rows; `location_cache.json` was not modified.

## Production safety

- Production feeds modified: **false**
- Public UI modified: **false**
- WordPress modified: **false**
- Production feed publishing remains blocked until geocode QA and explicit Howard approval

## Recommended next step

**C5G2** — build a review-only approved geocode override/reference layer using `data/location_cache.json` as master lookup plus human QA for possible matches. Do not publish production feeds.
