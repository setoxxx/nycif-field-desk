# NYCIF all-source data explorer v01

## Purpose

This change preserves the restored public map while adding a separate **All Data** explorer for the event data already produced by `nycif-live-feeds`.

## Source separation

The explorer loads and clearly separates:

1. **Approved/staged live feed** — `data/nycif_staged_live_events.json`.
2. **Expanded review intake** — `data/supplemental_events_staging_feed.json`.

Expanded review records are visibly marked `REVIEW`. They are not written back to the approved feed and are not described as production-approved.

The current supplemental manifest reports 4,032 records: 2,502 citywide-calendar-only records and 1,530 Parks-only records. Of those, 2,961 currently have proposed coordinates and 1,071 remain without coordinates.

## Access model

- Search runs across every loaded record, not only the first rendered rows.
- The list initially renders 100 records and provides **Load 100 more** access.
- Records without approved coordinates remain searchable and visible as `LIST ONLY`.
- Clicking a map-ready result focuses it on the existing Leaflet map.
- The restored main event map, geolocation, Near Me, directions, date controls, and existing overlays remain unchanged.

## Display categories

The explorer normalizes records into:

- Sports
- Fitness / wellness
- Parks / recreation
- Arts / culture
- Markets / fairs
- Civic / neighborhood
- Government / hearings
- Education / training
- Kids / family
- Benefits / services
- Environment
- Volunteer
- Jobs / careers
- Housing / tenant help
- General

Backend categories from the approved/staged feed take precedence when supported. Keyword normalization is used mainly for supplemental records and unsupported source labels.

## Safety boundaries

- `data/location_cache.json` is not modified.
- No supplemental record is promoted into the approved production feed.
- Existing 5PM, legal cannabis, and correlation overlays are preserved.
- WordPress remains an iframe wrapper around the GitHub Pages viewer.
- The existing restored runtime is not replaced.

## Validation

- `node --check all-source-data-explorer-v01.js` passed on the authored file.
- `node --check service-worker.js` passed on the authored update.
- Interactive browser validation remains required after GitHub Pages deploy.
