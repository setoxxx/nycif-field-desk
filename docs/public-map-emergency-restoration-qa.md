# NYCIF Public Map Emergency Restoration QA

Date: 2026-07-13

## Verified repository state

The current Field Desk `main` branch already contains the emergency map restoration identified during this review:

- `app-v06-safe.js` version `0.8-emergency-map-restore-v02`
- staged feed attempted first, then full feed, then major feed
- public defaults version `staged-live-v04`
- default date window set to the next seven days
- sports, parade, market, arts, parks, fitness and general enabled
- `majorOnly` disabled
- explicit source `row.date` retained before deriving a date from timestamps
- fitness category and keyword classification present
- public marker cap and event-list count separated
- service-worker cache `nycif-v015-map-restore-v02`
- network-first handling for runtime/configuration files and raw GitHub JSON feeds
- approved 5PM, legal-cannabis and correlation overlay scripts preserved in `index.html`

## Backend evidence

The live pipeline dashboard reported:

- staged feed events: 32,845
- classified/current-future events: 33,084
- fitness events: 192
- parks events: 4,461
- sports events: 27,020
- market events: 930
- arts events: 218

The staged manifest reported all five boroughs and the same category distribution.

## Source-level checks

- staged feed URL points to `data/nycif_staged_live_events.json`
- fallback URLs point to the full and major public feeds
- fetches use `cache: 'no-store'` with a timestamp query parameter
- `index.html` loads `public-map-defaults-v01.js?v=map-restore-v02`
- `index.html` loads `app-v06-safe.js?v=map-restore-v02`
- Fitness / wellness is visible and checked in the filter panel
- Major events only is visible and unchecked
- approved overlays remain loaded after the main runtime
- `data/location_cache.json` was not modified

## Validation limitation

This GitHub connector session did not provide an interactive browser runtime. The review therefore verifies repository state, source behavior and feed evidence, but does not claim a fresh end-to-end browser screenshot or WordPress test.

## Required post-merge/live verification

1. Open `https://setoxxx.github.io/nycif-field-desk/?v=map-restore-v02&resetFilters=1` in a private browser window.
2. Confirm ordinary event markers and the event list populate.
3. Confirm Fitness / wellness filters to fitness records.
4. Confirm the 5PM, legal cannabis and correlation layers still toggle independently.
5. Confirm no fatal console errors.
6. Confirm the map remains usable at a mobile viewport near 390 pixels.
