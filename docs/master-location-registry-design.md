# NYCIF Master Location Registry / Gazetteer Design (XRI-G0)

Status: **design/report only**. No registry build. No production feed changes. No public map changes. No WordPress changes.

**Design document location:** This XRI-G0 contract lives in `setoxxx/nycif-field-desk` as a cross-repo design reference only. It does not imply that field-desk owns registry storage or feed integration. Future registry data, source adapters, and production-feed geocoding belong in `setoxxx/nycif-live-feeds`; review UI and map display in `setoxxx/nycif-field-desk`; staging/operator and WordPress gates in `setoxxx/nycif-web-platform`.

Machine-readable report:

- `data/reports/master_location_registry_design_report.json`

Related normalization reference:

- `docs/location-matching-rules.md`

## Purpose

NYCIF ingests event rows from multiple NYC Open Data (SODA) sources. Location text in those rows is often weak, inconsistent, or ambiguous: park names without borough, parade routes described as street ranges, intersections with variant spellings, venue names that differ from official records, and source-specific formatting quirks.

Today, geocoding and map placement depend on ad hoc lookups against scattered reference files (notably `data/location_cache.json`, which is retailer-heavy) and manual overrides. That does not scale as SODA source expansion continues.

The **NYCIF Master Location Registry** (also called the **gazetteer**) is the proposed central, stable-but-versioned reference system that:

1. Stores canonical location records for venues, parks, intersections, street segments, addresses, neighborhoods, boroughs, and approved overrides.
2. Normalizes incoming SODA location text into deterministic lookup keys.
3. Matches rows through a ordered pipeline with explicit match statuses.
4. Routes ambiguous or low-confidence matches to human review — never to production.
5. Records provenance (`registry_id`, `registry_version`, `match_method`, `coordinate_quality`, `approval_status`) on every production geocode.

The registry is a **reference system**, not proof of event validity. Map and feed consumers should continue to use “confirm before traveling” language where appropriate.

## Design principles

| Principle | Rule |
|---|---|
| No invented coordinates | Coordinates must come from an approved registry record or an explicitly approved override — never from fuzzy guessing at publish time. |
| No automatic fuzzy publish | `possible_match`, `conflict`, `unmatched`, and `rejected` never enter production feed JSON. |
| Stable but versioned | Registry entries can be corrected, retired, or superseded; production rows record the version used at publish time. |
| Read-only legacy cache | `data/location_cache.json` remains read-only unless Howard explicitly approves writes. It is an input asset for G1/G3 inventory, not the registry itself. |
| Source adapters, not hardcoded map patches | New SODA sources add parsers and override tables; the public map runtime does not change daily for each new location string. |
| Registry ≠ event truth | A matched location only means “we know where this text refers”; it does not validate that an event occurs there. |

## Location record types

Each registry record has exactly one primary `registry_type`. Composite locations (e.g. “Central Park: Bethesda Terrace”) decompose into a park record plus an optional park asset or venue child record.

| `registry_type` | Description | Example canonical_name | Typical geometry |
|---|---|---|---|
| `venue` | Named indoor/outdoor venue with a stable identity | `Madison Square Garden` | point or centroid |
| `park` | NYC park or park property | `Flushing Meadows Corona Park` | polygon or centroid |
| `park_asset` | Feature within a park (field, plaza, monument) | `Bethesda Terrace` (parent park: Central Park) | point or polygon |
| `intersection` | Two-or-more-way street junction | `Broadway & W 42 St` | point |
| `street_segment` | Named street between two cross streets | `5 Av between 42 St and 44 St` | line (centroid optional if approved) |
| `address_point` | Street number + street name (+ borough) | `1 Centre St` | point |
| `neighborhood` | Named neighborhood (reference / fallback) | `DUMBO` | polygon or centroid |
| `borough` | Borough-level reference | `Queens` | polygon or centroid |
| `source_specific_override` | Approved mapping from a source-specific key to a registry record | `tvpp:location_hash:abc123` → registry_id | inherits target |
| `manual_editorial_override` | Human-approved one-off or editorial mapping | `NYPD July 4 route segment A` | inherits target or custom |

Override types (`source_specific_override`, `manual_editorial_override`) always reference a target registry record or carry their own approved coordinates with full audit metadata.

## Core registry fields

Every registry record uses the following schema. Fields marked *(required)* must be present on publishable records; others are type-dependent.

### Identity and naming

| Field | Type | Notes |
|---|---|---|
| `registry_id` *(required)* | string | Stable UUID or prefixed slug, e.g. `nycif-loc-00001234`. Never reused after retirement. |
| `registry_type` *(required)* | enum | One of the record types above. |
| `canonical_name` *(required)* | string | Human-readable official or editorial name. |
| `alternate_names` | string[] | Aliases, former names, common misspellings (search only, not for publish keys). |
| `normalized_name` *(required)* | string | Output of normalization pipeline (see `docs/location-matching-rules.md`). |
| `normalized_location_key` *(required)* | string | Deterministic lookup key: type-specific composite (see Matching strategy). |

### Administrative geography

| Field | Type | Notes |
|---|---|---|
| `borough` | enum \| null | `Manhattan`, `Brooklyn`, `Queens`, `Bronx`, `Staten Island`. Required for intersection/segment/address when not citywide-unique. |
| `neighborhood` | string \| null | Optional; used for display and disambiguation hints. |
| `address` | string \| null | Full or partial address for `address_point` and some venues. |
| `cross_streets` | string[] \| null | For intersections: ordered street names. |
| `street_name` | string \| null | Primary street for segments. |
| `from_street` | string \| null | Segment start cross street. |
| `to_street` | string \| null | Segment end cross street. |
| `park_id` | string \| null | NYC Parks identifier when known (cpcm-i88g join). |
| `venue_id` | string \| null | Source or NYCIF venue identifier when known. |

### Provenance and linkage

| Field | Type | Notes |
|---|---|---|
| `source_dataset_ids` | string[] | SODA dataset IDs or internal source codes that contributed to this record, e.g. `cpcm-i88g`, `tvpp-9vvx`. |

### Geometry

| Field | Type | Notes |
|---|---|---|
| `lat` | number \| null | Required for point/centroid publish; null for line-only review records until approved. |
| `lng` | number \| null | Same as `lat`. |
| `geometry_type` | enum | `point`, `line`, `polygon`, `centroid`. |
| `geometry_source` | string | e.g. `nyc_geosearch`, `cpcm-i88g`, `manual_survey`, `derived_centroid`. |
| `coordinate_quality` | enum | `approved`, `provisional`, `review_only`, `missing`. Only `approved` may publish. |

### Match and lifecycle

| Field | Type | Notes |
|---|---|---|
| `approval_status` | enum | `approved`, `provisional`, `needs_review`, `retired`, `rejected`. |
| `match_confidence` | number | 0.0–1.0 internal score; not a substitute for `approval_status`. |
| `match_methods_supported` | string[] | Which matchers can resolve this record, e.g. `exact_key`, `park_id`, `intersection`, `source_override`. |
| `created_at` | ISO8601 | |
| `updated_at` | ISO8601 | |
| `version` *(required)* | integer | Monotonic per `registry_id`; increments on coordinate or key correction. |
| `retired_at` | ISO8601 \| null | Set when superseded; record remains for audit. |
| `notes` | string \| null | Operator/editorial notes. |

### Production geocode attachment (on feed rows, not on registry)

When a SODA row is mapped for production, the feed row (or staging artifact) must carry:

```json
{
  "registry_id": "nycif-loc-00001234",
  "registry_version": 3,
  "match_method": "approved_exact",
  "coordinate_quality": "approved",
  "approval_status": "approved"
}
```

## Source inputs for future registry building

These assets are **read-only inputs** during XRI-G0 through G4 unless Howard explicitly approves mutation.

| Source | Repo / path | Role in registry build |
|---|---|---|
| Existing location cache | `nycif-field-desk` → `data/location_cache.json` | Legacy geocode cache (~11k keys, retailer-heavy). Seed candidate `address_point` and venue keys in G1/G3; **not** authoritative for events. |
| C5G master geocode audit | `data/reports/master_geocode_reference_audit.json` | Baseline match rates vs tvpp needs-review; informs matcher priority. |
| C5G2 approved geocode overrides | `data/approved_major_event_geocodes.json` (and successors) | Template for `manual_editorial_override` and production-safe exact matches. |
| Parks Event Locations | SODA `cpcm-i88g` | Primary park/venue seed; join Parks events by `event_id` / location fields. |
| Street / intersection references | Future NYC reference layers (LION, street centerline, geosupport) | G2 inventory; audit before use. |
| Source-specific approved overrides | Per-source tables in `nycif-live-feeds` | e.g. tvpp location hash → registry_id after human approval. |
| City geocoding services | NYC GeoSearch / similar | Only after audit; coordinates enter registry as `provisional` until approved. |
| DOT / street impact patterns | Future text parsers | G4+; route/closure language → `street_segment` candidates. |

**Do not** pull full SODA datasets during G0. Sample-based audits belong in G4.

## Matching strategy

Incoming SODA rows flow through a **source adapter** then a **shared matcher**. Order matters: early exact hits short-circuit later fuzzy steps.

```mermaid
flowchart TD
  A[SODA row] --> B[Source-specific parser]
  B --> C[Location text normalization]
  C --> D[Borough normalization]
  D --> E{Exact registry key lookup}
  E -->|hit| F[approved_exact]
  E -->|miss| G{Source-specific override lookup}
  G -->|hit| H[approved_source_override]
  G -->|miss| I{Park / venue lookup}
  I -->|single hit| J{approval_status approved?}
  J -->|yes| F
  J -->|no| K[possible_match]
  I -->|multi hit| L[conflict]
  I -->|miss| M{Intersection lookup}
  M -->|exact + borough| N{registry exists?}
  N -->|yes approved| F
  N -->|ambiguous borough| L
  N -->|no borough unique| K
  M -->|miss| O{Street segment lookup}
  O -->|exact deterministic| P{quality scored?}
  P -->|yes approved| F
  P -->|else| K
  O -->|miss| Q{Address lookup}
  Q -->|exact| F
  Q -->|miss| R[Fuzzy / substring candidates]
  R --> S{0 candidates|1 possible|2+ conflict}
  S --> T[unmatched / possible_match / conflict]
  F --> U{Production gate}
  H --> U
  K --> V[needs-review queue]
  L --> V
  T --> V
```

### Normalized location key examples

Keys are lowercase, punctuation-stripped, abbreviation-expanded (see matching rules doc).

| Type | Key pattern | Example |
|---|---|---|
| Intersection | `intersection\|{borough}\|{street_a}\|{street_b}` (streets sorted) | `intersection\|manhattan\|42 street\|broadway` |
| Street segment | `segment\|{borough}\|{street}\|from:{cross}\|to:{cross}` | `segment\|manhattan\|5 avenue\|from:42 street\|to:44 street` |
| Address | `address\|{borough}\|{house}\|{street}` | `address\|manhattan\|1\|centre street` |
| Park | `park\|{park_id}` or `park\|{normalized_name}\|{borough}` | `park\|q004\|flushing meadows corona park\|queens` |
| Venue | `venue\|{venue_id}` or `venue\|{normalized_name}\|{borough}` | `venue\|msg\|madison square garden\|manhattan` |
| Source override | `override\|{source}\|{source_location_key}` | `override\|tvpp-9vvx\|hash:7f3a…` |

### Match result statuses

| Status | Meaning | Production publish |
|---|---|---|
| `approved_exact` | Normalized key matched an `approval_status=approved` registry record with unambiguous coordinates. | **Allowed** |
| `approved_source_override` | Source-specific or manual override mapped to approved registry record/coordinates. | **Allowed** |
| `possible_match` | One or more provisional candidates; confidence below publish threshold or missing borough. | **Blocked** |
| `conflict` | Multiple approved candidates with incompatible coordinates, or ambiguous borough/street identity. | **Blocked** |
| `unmatched` | No candidate after full pipeline. | **Blocked** |
| `rejected` | Row failed validation (invalid location text, spam, out-of-area) or human rejection. | **Blocked** |

### Production publish rule

**Only `approved_exact` or `approved_source_override` may appear in production feed JSON** (`nycif_staged_live_events.json` and downstream public feeds).

`possible_match`, `conflict`, `unmatched`, and `rejected` rows:

- Must appear in needs-review / audit reports only.
- Must not receive lat/lng in production feed output.
- Must not be silently promoted without explicit approval workflow (G6+).

## Type-specific handling

### Street segments

Examples:

- `5 AVENUE BETWEEN 42 STREET AND 44 STREET`
- `Broadway from W 42 St to W 44 St`

Rules:

1. Parser extracts `street_name`, `from_street`, `to_street`, and `borough` when present.
2. Registry stores `geometry_type: line` when centerline geometry is available; otherwise review-only until geometry is sourced.
3. **Centroid/midpoint** may be proposed for map marker display only after explicit approval (`coordinate_quality: approved`, `geometry_type: centroid`).
4. Street range matches default to **`possible_match` / needs_review** unless match is exact, deterministic, and quality-scored (e.g. registry line geometry + approved centroid).
5. Partial ranges (“42 St to 44 St” without primary street) require borough + disambiguation or become `conflict`.

### Intersections

Examples:

- `Broadway & W 42 St`
- `5 Ave and 59 St`

Rules:

1. Cross-street separators normalized: `AND`, `&`, `/`, `+`, `@` (see matching rules).
2. **Exact intersection + borough** → `approved_exact` if an approved registry record exists.
3. **Same street name in multiple boroughs** without borough → `conflict` or `possible_match`, never auto-publish.
4. **Missing borough** → `possible_match` unless street pair is unique citywide (rare; must be catalogued in registry metadata).

### Parks

1. Parks SODA feeds should **join event rows to `cpcm-i88g`** (Parks Event Locations) where `event_id` or location fields allow.
2. Parks location records **seed registry candidates** (`park`, `park_asset`, associated `venue`).
3. Public map should expose **one enriched Parks Events layer**, not six separate public layers — registry-backed enrichment consolidates display.
4. Park name variants map through `alternate_names` and normalized keys; unapproved park matches stay in review.

### Addresses and venues

1. Address points require house number + street + borough for exact publish (matches legacy `location_cache.json` key style: `location|borough|`).
2. Venues may publish on venue key match when `approval_status=approved`.
3. Venue inside park: prefer `park_asset` or linked `venue` with parent `park_id`.

## Versioning and corrections

- Each correction increments `version` on the same `registry_id`.
- Superseded records set `retired_at` and point to successor in `notes` or a future `supersedes` field (G3 schema).
- Production feed rows **freeze** `registry_version` at publish time for audit replay.
- Re-publishing after a registry correction requires explicit re-run of feed geocode step and approval gate — not silent overwrite.

## Repository ownership

This section defines **runtime ownership** across repos. The G0 design doc is hosted in field-desk for convenience alongside existing geocode audit artifacts; that placement is not an ownership transfer.

| Repo | Responsibility |
|---|---|
| **`nycif-live-feeds`** | **Primary owner (future):** registry file storage, source adapters, match pipeline execution, production feed geocoding, mapped/needs-review JSON reports. Does not publish unapproved matches. |
| **`nycif-field-desk`** | Review UI for match results; map display of **approved** records only on public paths; admin/test views for possible/conflict/unmatched. Hosts this G0 design/report only — does not write registry data. |
| **`nycif-web-platform`** | Staging/operator gates; registry-backed outputs in operator flows. **No public WordPress updates without explicit Howard approval.** |

Cross-repo contract (future G7):

- Registry canonical file: TBD in G2 (likely `nycif-live-feeds/data/nycif_location_registry.json` or versioned directory).
- Match audit artifacts: `data/reports/*_location_match_*.json`.
- Feed rows reference registry provenance fields listed above.

## Safety rules (summary)

1. No invented coordinates.
2. No automatic fuzzy geocode publishing.
3. No hidden publication of possible matches.
4. `location_cache.json` remains read-only unless explicitly approved.
5. Registry is reference data, not event validation.
6. Use “confirm before traveling” language in user-facing copy where appropriate.

## Roadmap

| Phase | Scope | Deliverable | Publish impact |
|---|---|---|---|
| **XRI-G0** | Registry design | This document + JSON report | None |
| **XRI-G1** | Existing location asset inventory | Report: cache, audits, overrides, spot files | None |
| **XRI-G2** | Registry source inventory + candidate schema | Report: cpcm-i88g sample, street ref candidates, JSON schema draft | None |
| **XRI-G3** | Prototype registry builder | Local/report-only builder; provisional registry file in dev branch | None |
| **XRI-G4** | Match audit vs SODA samples | Report: match rates by source/status | None |
| **XRI-G5** | Review UI | field-desk admin paths for possible/conflict/unmatched | Admin only |
| **XRI-G6** | Approved override workflow | Operator approval for overrides and editorial entries | Gated |
| **XRI-G7** | Production-feed integration | live-feeds writes provenance fields; approval-gated publish | **Requires explicit approval** |
| **XRI-G8** | Monitoring and correction | Drift detection, version bump workflow, re-geocode reports | Gated |

## Relationship to prior work

- **C5G** (`docs/master-geocode-reference-audit.md`): Showed 642/897 tvpp needs-review rows unmatched against legacy assets; strict exact matching avoids false positives. The registry generalizes that audit into a maintained gazetteer.
- **C5G2 / C5P**: Approved override pattern (`approved_major_event_geocodes.json`) becomes `manual_editorial_override` records in the registry.
- **C5P closeout**: Production publish cycle verified; registry integration must not bypass that gate.

## Next step

**XRI-G1** — existing location asset inventory (report only): catalogue `location_cache.json`, C5G audit outputs, approved overrides, nightlife/retail spot files, and cpcm-i88g sample join feasibility. No registry build. No feed publish.
