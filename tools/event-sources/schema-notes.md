# NYCIF Event Sources v1 — Live Schema Notes

Read-only spot-check captured via:

```bash
node tools/event-sources/inspect-live-schemas.mjs
```

Sample size: **3 rows per fetchable Socrata source** (2026-07-02). No app token used. No production files written.

---

## Special Traffic Updates (`dot-trafalrt`)

**Status:** `documented_only` — HTML source, intentionally **not fetched or scraped** in v1.

- URL: https://www.nyc.gov/html/dot/html/motorist/trafalrt.shtml
- Type: `html_scrape`, priority: `later`
- No live schema evidence collected.

---

## NYC Permitted Event Information (`tvpp-9vvx`)

**Priority:** core | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (12)

`cemsid`, `community_board`, `end_date_time`, `event_agency`, `event_borough`, `event_id`, `event_location`, `event_name`, `event_type`, `police_precinct`, `start_date_time`, `street_closure_type`

All observed values typed as `string` in sample.

### Maps confidently to EventLead

| Live field | EventLead field |
|---|---|
| `event_id` | `eventId`, `sourceRecordId` |
| `event_name` | `title` |
| `event_type` | `eventType` |
| `event_agency` | `category`, `organizer` |
| `start_date_time` | `startDate`, `startTime` |
| `end_date_time` | `endDate`, `endTime` |
| `event_borough` | `borough` |
| `event_location` | `locationName`, `address` |
| `street_closure_type` | `description` (closure metadata, not narrative description) |

### EventLead fields not available from this source

`officialUrl`, `phone`, `email`, `isFree`, `latitude`, `longitude`, `photoPriorityScore`

### Normalizer alias issues (v0 stubs)

| Issue | Detail |
|---|---|
| **Wrong / unproven** | `latitude`, `lat`, `longitude`, `long`, `lng` — **not present** in live sample |
| **Unmapped live fields** | `cemsid`, `community_board`, `police_precinct` may be useful enrichment |
| **Semantic risk** | `street_closure_type` used as `description` is closure type, not event description |

### Source-specific risks

- No coordinates in dataset; geocoding must use `event_location` text.
- Agency duplicated into both `category` and `organizer`.

---

## NYC Parks Events Listing – Event Listing (`fudw-fgrp`)

**Priority:** core | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (15)

`cost_description`, `cost_free`, `date`, `description`, `email`, `end_time`, `event_id`, `location_description`, `must_see`, `notice`, `phone`, `snippet`, `start_time`, `title`, `url`

All observed values typed as `string` in sample.

### Maps confidently to EventLead

| Live field | EventLead field |
|---|---|
| `event_id` | `eventId`, `sourceRecordId` |
| `title` | `title` |
| `date` + `start_time` / `end_time` | `startDate`, `startTime`, `endDate`, `endTime` (requires combining) |
| `description` | `description` |
| `url` | `officialUrl` |
| `phone` | `phone` |
| `email` | `email` |
| `cost_free` | `isFree` (string `"true"`/`"false"`, not boolean) |
| `location_description` | `locationName` (partial; address/borough from join table) |

### EventLead fields not available from this source alone

`eventType`, `category`, `borough`, `address`, `latitude`, `longitude`, `organizer`, `photoPriorityScore` — several come from join tables (`cpcm-i88g`, `xtsw-fqvh`, `jk6k-yab4`, `6eti-k994`).

### Normalizer alias issues (v0 stubs)

| Issue | Detail |
|---|---|
| **Wrong** | `event_name`, `name` — live field is **`title`** |
| **Wrong** | `start_date_time`, `startdate`, `start_date` — live uses **`date` + `start_time`** |
| **Wrong** | `end_date_time`, `enddate`, `end_date` — live uses **`date` + `end_time`** |
| **Wrong** | `is_free` — live field is **`cost_free`** (string) |
| **Wrong** | `location`, `location_name`, `park_name` — live field is **`location_description`** |
| **Unproven** | `borough`, `address`, `latitude`, `longitude`, `organizer`, `event_type`, `category` — not on listing row; expect joins |

### Source-specific risks

- Date/time split across three fields; normalizer must compose ISO-like datetime.
- `cost_free` is string, not boolean.
- Core location/geo/borough require **`cpcm-i88g` join** (not implemented in v0/v1).

---

## NYC Parks Events Listing – Event Locations (`cpcm-i88g`)

**Priority:** core_join (`event_id`) | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (8)

`address`, `borough`, `event_id`, `lat`, `long`, `name`, `park_id`, `zip`

All observed values typed as `string` in sample.

### Maps confidently to EventLead (via join)

| Live field | EventLead field |
|---|---|
| `event_id` | join key |
| `name` | `locationName` |
| `address` | `address` |
| `borough` | `borough` |
| `lat` | `latitude` (string → number) |
| `long` | `longitude` (string → number) |

### EventLead fields not on join row

`title`, dates, `description`, `officialUrl`, `organizer`, etc. — on `fudw-fgrp` parent.

### Normalizer alias issues

- **No normalizer exists** for this join table (expected; joins deferred).
- v0 Parks listing normalizer incorrectly assumes lat/long/borough on main listing row.

### Source-specific risks

- `lat`/`long` are strings; parse before numeric use.
- One event may have multiple location rows (sample did not verify cardinality).

---

## NYC Parks Events Listing – Event Categories (`xtsw-fqvh`)

**Priority:** core_join (`event_id`) | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (2)

`event_id`, `name`

### Maps confidently to EventLead (via join)

| Live field | EventLead field |
|---|---|
| `event_id` | join key |
| `name` | `category` (may be multi-valued per event) |

### Normalizer alias issues

- **No normalizer**; v0 stub `category`/`event_category` aliases on listing row are unproven.

### Source-specific risks

- Multiple category rows per `event_id` likely; needs aggregation strategy later.

---

## NYC Parks Events Listing – Event Links (`ridc-7qqg`)

**Priority:** enrichment (`event_id`) | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (3)

`event_id`, `link_name`, `link_url`

### Maps confidently to EventLead (via join)

| Live field | EventLead field |
|---|---|
| `link_url` | candidate for `officialUrl` when primary `url` absent |
| `link_name` | enrichment metadata only |

### Normalizer alias issues

- **No normalizer**; listing-row `url`/`event_url`/`website` aliases are partially correct for primary URL only.

---

## NYC Parks Events Listing – Event Images (`6eti-k994`)

**Priority:** enrichment (`event_id`) | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (3)

`event_id`, `main`, `path_2` (`path_2` typed as `object` in sample)

### Maps confidently to EventLead (via join)

| Live field | EventLead field |
|---|---|
| `main` | candidate for `photoPriorityScore` / image URL enrichment (future) |

### Normalizer alias issues

- **No normalizer**; `photoPriorityScore` not derivable from listing row.

### Source-specific risks

- `path_2` is nested object; structure not fully characterized from 3-row sample.

---

## NYC Parks Events Listing – Event Organizers (`jk6k-yab4`)

**Priority:** enrichment (`event_id`) | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (2)

`event_id`, `event_organizer`

### Maps confidently to EventLead (via join)

| Live field | EventLead field |
|---|---|
| `event_organizer` | `organizer` |

### Normalizer alias issues

- v0 stub uses `organizer`/`event_host` on listing row — **wrong**; organizer is on join table.

---

## Public Programs Division Special Events (`6v4b-5gp4`)

**Priority:** core | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (12)

`attendance`, `audience`, `borough`, `category`, `date_and_time`, `event_name`, `event_type`, `group_name_partner`, `location`, `locationtype`, `source`, `unit`

All observed values typed as `string` in sample.

### Maps confidently to EventLead

| Live field | EventLead field |
|---|---|
| `event_name` | `title` |
| `event_type` | `eventType` |
| `category` | `category` |
| `date_and_time` | `startDate`, `startTime` (single combined field; end time likely absent) |
| `borough` | `borough` |
| `location` | `locationName` |
| `group_name_partner` | `organizer` |

### EventLead fields not available

`eventId`/`sourceRecordId` (no stable id in sample), `endDate`/`endTime`, `address`, `latitude`, `longitude`, `officialUrl`, `phone`, `email`, `isFree`, `photoPriorityScore`

### Normalizer alias issues (v0 stubs)

| Issue | Detail |
|---|---|
| **Wrong** | `start_date_time`, `startdate`, `event_date` — live field is **`date_and_time`** |
| **Wrong** | `event_id`, `id`, `objectid` — **no id field observed** |
| **Unproven** | `address`, `location_address`, lat/long aliases |
| **Unmapped** | `attendance`, `audience`, `locationtype`, `source`, `unit` |

### Source-specific risks

- No unique event id complicates dedup and joins.
- `date_and_time` may encode ranges or free text; needs parsing rules.
- `location` is text only; no coordinates.

---

## Safety Events (`3vyj-dkjt`)

**Priority:** core | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (22)

`address`, `agedisp`, `bbl`, `bin`, `borough`, `citywide_outreach`, `community_board`, `community_site`, `council_district`, `ct2020`, `event_date`, `handsondisp1`, `head_start_prek`, `hospital_health_care`, `latitude`, `longitude`, `name_of_org`, `nta2020`, `program`, `seniors`, `served_by`, `zip_code`

All observed values typed as `string` in sample (including `latitude`/`longitude`).

### Maps confidently to EventLead

| Live field | EventLead field |
|---|---|
| `program` | `title` or `category` (program name acts as event title) |
| `community_site` | `locationName` |
| `address` | `address` |
| `borough` | `borough` |
| `event_date` | `startDate` (time component likely absent) |
| `latitude` | `latitude` (string → number) |
| `longitude` | `longitude` (string → number) |
| `name_of_org` | `organizer` |
| `program` | `category` (if not used as title) |

### EventLead fields not available

`eventId`, `sourceRecordId`, `eventType`, `endDate`, `endTime`, `description`, `officialUrl`, `phone`, `email`, `isFree`, `photoPriorityScore`

### Normalizer alias issues (v0 stubs)

| Issue | Detail |
|---|---|
| **Wrong** | `event_name`, `name`, `title` — **not present**; use `program` and/or `community_site` |
| **Wrong** | `event_id`, `id`, `objectid` — **not present** |
| **Wrong** | `start_date_time`, `startdate` — live field is **`event_date`** |
| **Wrong** | `end_date_time`, `enddate` — **not present** |
| **Unproven** | `location`, `event_location`, `description`, `url`, `phone`, `email` |

### Source-specific risks

- Outreach/site visit records, not traditional ticketed events.
- Many demographic flags (`seniors`, `head_start_prek`, etc.) are enrichment-only.
- No stable record id in sample; may need composite key (org + date + site).

---

## Film Permits (`tg4x-b46p`)

**Priority:** optional | **Rows sampled:** 3 | **Empty rows:** no

### Observed live fields (14)

`borough`, `category`, `communityboard_s`, `country`, `enddatetime`, `enteredon`, `eventagency`, `eventid`, `eventtype`, `parkingheld`, `policeprecinct_s`, `startdatetime`, `subcategoryname`, `zipcode_s`

All observed values typed as `string` in sample.

### Maps confidently to EventLead

| Live field | EventLead field |
|---|---|
| `eventid` | `eventId`, `sourceRecordId` |
| `subcategoryname` | `title` (production name proxy) |
| `eventtype` | `eventType` |
| `category` | `category` |
| `startdatetime` | `startDate`, `startTime` |
| `enddatetime` | `endDate`, `endTime` |
| `borough` | `borough` |
| `parkingheld` | `locationName`, `address`, `description` (street closure text) |
| `eventagency` | `organizer` (unmapped in v0 stub) |

### EventLead fields not available

`latitude`, `longitude`, `officialUrl`, `phone`, `email`, `isFree`, `photoPriorityScore`

### Normalizer alias issues (v0 stubs)

| Issue | Detail |
|---|---|
| **Mostly correct** | `eventid`, `startdatetime`, `enddatetime`, `category`, `subcategoryname`, `eventtype`, `parkingheld`, `borough` |
| **Missing mapping** | `eventagency` → `organizer` |
| **Semantic risk** | Title from `subcategoryname` is permit subcategory, not production title |
| **By design** | lat/long hardcoded null — confirmed absent from dataset |

### Source-specific risks

- Film permits are street closures, not public events; semantic mismatch for map display.
- `enteredon` may be ingestion metadata, not event schedule.

---

## Cross-source summary: normalizer corrections for next task

Priority fixes when updating v0 normalizer stubs:

1. **`fudw-fgrp`** — remap to `title`, `date`+`start_time`/`end_time`, `cost_free`, `location_description`; stop assuming lat/borough/organizer on listing row.
2. **`3vyj-dkjt`** — remap to `program`, `community_site`, `event_date`, `name_of_org`; remove fictitious `event_id`/`event_name` aliases.
3. **`6v4b-5gp4`** — remap to `date_and_time`; remove `event_id`/`objectid` assumptions; map `group_name_partner`.
4. **`tvpp-9vvx`** — remove lat/long aliases; optionally map `cemsid`, `community_board`, `police_precinct`.
5. **`tg4x-b46p`** — add `eventagency` → `organizer`; document title semantic limitation.
6. **Parks join tables** — defer normalizers until join task; document dependency on `event_id`.
