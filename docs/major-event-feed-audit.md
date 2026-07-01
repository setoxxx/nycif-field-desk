# NYCIF Major Event Feed Audit — Issue #26 / PR B

Status: audit/report only. No public UI, WordPress, iframe, feed-output, generated-data, or scheduled-workflow changes.

## Scope

This audit starts Issue #26: fixing major-event feed automation and July 4 coverage for the public NYC In Focus map.

The current public map reads live event feed JSON from the separate `setoxxx/nycif-live-feeds` repository:

```text
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json
```

Those URLs are wired in `app-v06-safe.js`; this audit does not change them.

## Findings

### 1. Current map feed architecture

The public map uses three feed slots:

| Feed slot | URL | Current role | Audit finding |
|---|---|---|---|
| `major` | `nycif_major_radar_map_events.json` | Default feed loaded by the map | Exists and contains hard-written/NYPD-style field-intel records dated June 27, 2026. |
| `full` | `nycif_all_radar_map_events.json` | Loaded by "Show more events" | File currently appears empty from direct GitHub fetch. |
| `staged` | `data/nycif_staged_live_events.json` | Used by staged/new-review behavior | File currently appears empty from direct GitHub fetch. |

Implication: the UI is now behaving correctly, but the major-event layer can only show what exists in the `major` feed. If July 4 citywide events are missing, the bug is upstream in feed generation/curation, not the public overlay UI.

### 2. Current major feed content pattern

The current `nycif_major_radar_map_events.json` file includes hard-written/NYPD field-intel style records. Example fields present in the first record:

```json
{
  "id": "nypd-hardwrite-cooper-square-fair-2026-06-27",
  "title": "NYPD Field Intel: 3rd Avenue Cooper Square Fair",
  "date": "2026-06-27",
  "borough": "Manhattan",
  "location": "3rd Avenue between 14th Street and 6th Street",
  "display_location": "3rd Avenue / Cooper Square",
  "lat": 40.730238,
  "lng": -73.988764,
  "photo_pick": true,
  "priority_score": 82,
  "verification_status": "nypd_field_intel",
  "assignment_feed": "major",
  "expected_crowd_score": 1557,
  "crowd_level": "very_high",
  "major_reason": "NYPD field intel, photo pick, street fair / pop-up",
  "field_default": true
}
```

That means the current major feed schema already has several useful scoring/display fields:

```text
id
title
date / start_date_time / end_date_time
borough
location / display_location
lat / lng
lane / event_type / icon / color
photo_pick
priority_score
verification_status
source_file
search_label
logistics
source-specific notes such as nypd_notice
assignment_feed
expected_crowd_score
crowd_level
major_reason
field_default
```

### 3. Feed-output gap

Direct fetches found:

```text
nycif_major_radar_map_events.json: present, populated
nycif_all_radar_map_events.json: empty response body
data/nycif_staged_live_events.json: empty response body
```

This explains why the default map may appear sparse even when obvious public events exist. The major feed is populated, but appears manually/hard-written around a specific June 27 set; the all/staged feeds do not currently provide broader backup coverage.

### 4. Builder/automation gap

Repository code search did not find obvious builder/workflow references for:

```text
nycif_major_radar_map_events
tvpp-9vvx
workflow_dispatch
cron
```

in `setoxxx/nycif-live-feeds` during this audit pass.

Conclusion: before writing production feed outputs, we need either:

```text
1. locate the actual external generation process, or
2. add a new explicit source-audit/builder pipeline with reports and review outputs.
```

## NYC Open Data source audit: `tvpp-9vvx`

Source URL:

```text
https://data.cityofnewyork.us/resource/tvpp-9vvx.json
```

Metadata endpoint:

```text
https://data.cityofnewyork.us/api/views/tvpp-9vvx
```

### Dataset identity

| Field | Value |
|---|---|
| Dataset ID | `tvpp-9vvx` |
| Dataset name | `NYC Permitted Event Information` |
| Publisher / attribution | Office of Citywide Event Coordination and Management (CECM) |
| Provenance | official |
| Category | City Government |
| Description | Approved event applications that will occur within the next month; film events only reflect permits impacting one or more streets for at least five days. |

### Fields observed

The API sample and metadata show these field names:

```text
event_id
event_name
start_date_time
end_date_time
event_agency
event_type
event_borough
event_location
event_street_side
street_closure_type
community_board
police_precinct
cemsid
```

### Strengths

`tvpp-9vvx` is useful because it is:

```text
official
future-facing / current-window oriented
citywide
includes dates/times
includes boroughs
includes event agency/type/location
captures Street Activity Permit Office / Police Department / Parks Department / MOME activity
```

### Limitations

`tvpp-9vvx` cannot be treated as a clean "major events" feed by itself.

Observed limitations:

```text
No lat/lng fields in sample rows.
Event locations are free-text and require geocoding or location-cache matching.
Start/end times are often permit/setup/breakdown windows, not public audience times.
The dataset is noisy: many records are recurring sports permits, youth sports, adult sports, picnics, barbecues, and routine parks permits.
July 4 rows exist in raw data, but at least one sample July 4 record was a routine youth soccer permit, not a citywide July 4/fireworks event.
No sampled records matched "Independence" or "Fireworks" in the default API page, so explicit holiday/fireworks coverage needs targeted queries and/or additional official sources.
```

### July 4 finding

The raw API sample included at least one `2026-07-04` record:

```json
{
  "event_id": "948580",
  "event_name": "Soccer - Non Regulation",
  "start_date_time": "2026-07-04T17:00:00.000",
  "end_date_time": "2026-07-04T20:00:00.000",
  "event_agency": "Parks Department",
  "event_type": "Sport - Youth",
  "event_borough": "Queens",
  "event_location": "Marconi Park: Soccer-01"
}
```

This is important: July 4 date coverage exists, but raw date coverage is not the same as public-interest July 4 major-event coverage.

## Major-events product definition

The default public map should be a curated field/photo/public-interest view, not a raw category dump.

Recommended definition:

```text
Major events = source-listed public events with strong civic, field, crowd, photo, or public-interest value.
```

This should blend:

```text
official civic/public events
citywide or high-attendance events
parades, marches, street closures, major permitted activity
parks/cultural/festival events
sports/fan-zone/large crowd events
Instagramable/photo-friendly/pop-up style events
waterfront/fireworks/holiday/citywide events
events with strong field/photo/news value
```

`Instagramable` should remain a scoring concept for now. Do not scrape Instagram or infer social popularity without a separately approved compliant source strategy.

## Proposed scoring fields

Future builder outputs should add or preserve:

```text
major_score
major_reason
photo_pick
instagramable_signal
public_event_type
expected_crowd_signal
source_name
source_url
source_record_id
date
start_date_time
end_date_time
title
display_location
borough
lat
lng
verification_status
review_status
```

## Proposed major-event scoring signals

High score:

```text
July 4 / fireworks / Independence Day
parade
march
street closure
permitted public gathering
major park event
waterfront event
festival
cultural event
market / pop-up
sports / fan-zone
large civic event
official city event
strong photo / field value
```

De-prioritize or exclude by default:

```text
routine youth sports
routine adult sports
single-field recurring games
picnics / barbecues unless large or otherwise notable
private / low-public-interest permits
records without reliable location after matching/geocoding
records where permit/setup time is likely misleading and no public-facing time can be derived
```

## Source recommendations

### Source 1: NYC Permitted Event Information (`tvpp-9vvx`)

Use as an official backbone, but only through a scoring/filtering builder. It should not directly replace the major feed.

Recommended handling:

```text
Query a date window, not the default first page.
Filter event_type/event_agency/street_closure_type before scoring.
Preserve event_id as source_record_id.
Treat start/end as permit windows unless confidence rules identify public event times.
Geocode event_location with review fallback.
Route ambiguous or unmapped records to needs_review.
```

### Source 2: NYC Parks event data/calendar

Evaluate next. This may be better than permitted-event data for public-facing parks programs, movies, cultural events, waterfront programming, and family events. It must be structured enough to preserve source URL, time, title, borough/location, and public-facing description.

### Source 3: DOT / Open Streets / street activity / plazas

Evaluate for open streets, plaza events, street fairs, and pedestrianized public space events. Prefer official structured sources with source IDs.

### Source 4: Official holiday/fireworks/advisory sources

For July 4 specifically, the feed probably needs an official holiday/fireworks/advisory source beyond `tvpp-9vvx`, because the raw permitted-event dataset may contain routine July 4 parks/sports permits but not the public-interest citywide fireworks/festival set Howard expects.

## Recommended PR sequence after this audit

### PR C1 — source audit runner only

Add a script that queries `tvpp-9vvx` for a controlled date window and writes reports only.

Outputs:

```text
data/reports/major_event_source_audit_tvpp_9vvx.json
data/reports/major_event_source_audit_tvpp_9vvx_samples.json
```

Report fields:

```text
source_rows
july_4_rows
july_4_candidate_major_rows
records_by_event_type
records_by_event_agency
records_by_borough
records_missing_location
records_needing_geocode
sample_high_score_candidates
sample_rejected_routine_sports
source_freshness
query_url
```

No map-feed output changes yet.

### PR C2 — prototype major-event builder

Generate prototype files, not production feed files:

```text
data/prototype_major_events.json
data/prototype_major_events_needs_review.json
data/reports/prototype_major_events_report.json
```

Use stable scoring and review routing. Do not overwrite `nycif_major_radar_map_events.json` until QA passes.

### PR C3 — live-feed integration

Only after prototype QA, integrate into the live feed repo or generation workflow.

Required:

```text
backup current major feed
write generated major feed with report
preserve manual/hard-written overrides when needed
add rollback path
add scheduled/manual workflow
```

## QA gates

Before any production feed output change:

```text
[ ] Existing public overlays remain working.
[ ] Excluded raw/full overlay layers are still absent from public UI.
[ ] Major-only default still works.
[ ] July 4 date window shows actual public-interest candidates, not only routine sports permits.
[ ] All included events have source_name/source_url/source_record_id.
[ ] No fake times.
[ ] No fake locations.
[ ] Geocoding uncertainty routes to review.
[ ] No private-source leakage.
[ ] WordPress remains untouched.
```

## PR B conclusion

PR B should stop here. The next safe step is an audit runner/report PR, not a public feed rewrite.
