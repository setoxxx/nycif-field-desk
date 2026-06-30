# NYCIF Pin Pipeline

This backend pipeline exists to turn raw NYC Open Data rows into clean pins the map can actually display.

## Goal

Every source row must become one of these outcomes:

1. `mapped` — row has trusted latitude and longitude.
2. `geocoded` — row had an address and was converted to latitude and longitude.
3. `needs_review` — row is useful but location is not trustworthy yet.
4. `rejected` — row is not useful for the selected layer.

## First nightlife layers

### 5PM Spots

Source:

```text
https://data.cityofnewyork.us/resource/hdtn-j62g.json
```

Output:

```text
data/nycif_nightlife_spots.json
```

### Smoke / Cannabis / Vape Intel

Planned source buckets:

```text
Licensed Cannabis Locations
Smoke / Vape Shops
311 Complaint Hotspots
```

Output:

```text
data/nycif_smoke_cannabis_vape_intel.json
```

Public wording should avoid slang such as "plugs." Use lawful/editorial labels:

```text
Smoke / Cannabis / Vape Intel
Licensed Cannabis Locations
Smoke / Vape Shops
311 Complaint Hotspots
```

## Normalized pin schema

Each mapped pin should follow this shape:

```json
{
  "id": "nightlife-source-id",
  "layer": "nightlife",
  "category": "nightlife",
  "group": 1,
  "subtype": "bar_tavern",
  "subtype_label": "Bars / taverns",
  "title": "Venue Name",
  "address": "123 Example Street, New York, NY 10001",
  "borough": "Manhattan",
  "lat": 40.0,
  "lng": -73.0,
  "location_quality": "source_coordinates",
  "source": "NYC Open Data",
  "source_url": "https://data.cityofnewyork.us/resource/hdtn-j62g.json",
  "raw_source_id": "source-row-id",
  "updated_at": "2026-06-30T00:00:00Z"
}
```

## Geocode cache

Do not geocode the same address repeatedly.

Cache file:

```text
data/location_cache.json
```

Cache key format:

```text
normalized address + borough + zip
```

Cache value:

```json
{
  "query": "123 Example Street, Manhattan, NY 10001",
  "lat": 40.0,
  "lng": -73.0,
  "quality": "geocoded",
  "provider": "nyc_geosearch_or_nominatim",
  "updated_at": "2026-06-30T00:00:00Z"
}
```

Important: never overwrite good coordinates with worse coordinates.

## Quality rules

### Accept immediately

- Source row already has a latitude/longitude pair inside NYC bounds.
- Address geocodes inside NYC bounds.
- Duplicate title/address resolves to same coordinate.

### Needs review

- Address geocodes outside NYC.
- Borough does not match geocoded location.
- No address and no coordinates.
- Coordinate appears to be borough/city centroid rather than venue-level.
- Multiple different businesses collapse to the same coordinate with weak address data.

### Reject

- Wholesale, distributor, importer, manufacturer, warehouse.
- Temporary permit, one-day permit, special event permit.
- Off-premises liquor/package store records for the nightlife layer.
- Complaint-only records older than the selected reporting window when we add complaint layers.

## Build order

1. Inspect source fields and sample rows.
2. Normalize rows into candidate pins.
3. Extract existing coordinates.
4. Geocode missing coordinates using cache first.
5. Deduplicate.
6. Write mapped JSON.
7. Write QA report.
8. Map reads only the normalized JSON, not raw Socrata rows.

## QA report

Each import should produce:

```text
data/reports/nightlife_pin_report.json
```

Suggested report fields:

```json
{
  "source_rows": 0,
  "category_matches": 0,
  "source_coordinate_matches": 0,
  "geocoded_matches": 0,
  "mapped_total": 0,
  "needs_review": 0,
  "rejected": 0,
  "duplicate_count": 0,
  "top_rejection_reasons": [],
  "generated_at": "2026-06-30T00:00:00Z"
}
```
