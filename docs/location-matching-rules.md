# NYCIF Location Normalization and Matching Rules (XRI-G0)

Status: **design reference only**. Companion to `docs/master-location-registry-design.md`.

These rules define how raw SODA location text becomes `normalized_name` and `normalized_location_key` values for registry lookup. Implementations belong in `nycif-live-feeds` source adapters (G3+).

## Normalization pipeline order

Apply steps in sequence; each step receives the output of the previous step.

1. Unicode NFKC normalization.
2. Trim leading/trailing whitespace; collapse internal runs of whitespace to a single space.
3. Uppercase → lowercase (matching keys are always lowercase).
4. Punctuation normalization (see below).
5. Borough extraction and normalization (may move borough out of location string into structured field).
6. Street-type and directional abbreviation expansion.
7. Cross-street separator normalization.
8. Segment boundary parsing (`between`, `from`/`to`).
9. Leading article removal for park/venue names (`the`, `a`) when configured per type.
10. Sort intersection street names alphabetically for key generation (display name preserves source order).

## Punctuation

| Input | Normalized |
|---|---|
| `.` `,` `;` `:` at token boundaries | removed or space |
| `'` and `'` (curly/straight apostrophe) | removed (`o'brien` → `obrien`) |
| `-` between tokens | space (`42-01` house numbers keep hyphen — see addresses) |
| `#` | space (`#5` → `5`) |
| Parentheses | removed; inner text kept (`(W 42 St)` → `w 42 st`) |
| Multiple spaces | single space |

House numbers: preserve hyphenated Queens-style numbers (`42-01 28th Ave` → `42-01 28 avenue`).

## Street type abbreviations

Expand trailing or embedded street types to canonical full words for keys (display may keep abbreviations).

| Abbreviation variants | Canonical |
|---|---|
| `st`, `str`, `street` | `street` |
| `ave`, `av`, `aven`, `avenue` | `avenue` |
| `rd`, `road` | `road` |
| `blvd`, `boulevard`, `boul` | `boulevard` |
| `pl`, `place` | `place` |
| `dr`, `drive` | `drive` |
| `ln`, `lane` | `lane` |
| `ct`, `court` | `court` |
| `pkwy`, `parkway` | `parkway` |
| `sq`, `square` | `square` |
| `ter`, `terrace` | `terrace` |
| `hwy`, `highway` | `highway` |

Numeric avenues: `5 av`, `5 ave`, `5th ave`, `5 avenue` → `5 avenue`. Preserve `5` not `fifth` for key consistency with NYC DOT style.

## Directional prefixes

| Abbreviation variants | Canonical |
|---|---|
| `n`, `north` | `north` |
| `s`, `south` | `south` |
| `e`, `east` | `east` |
| `w`, `west` | `west` |

Apply to street names: `W 42 St` → `west 42 street`, `E 136 St` → `east 136 street`.

## Borough names

Extract borough from trailing comma segments, parentheticals, or known tokens. Map to canonical title case in structured `borough` field; lowercase in keys.

| Variants | Canonical (`borough` field) | Key token |
|---|---|---|
| `manhattan`, `mn`, `new york county`, `nyc` (when unambiguous) | Manhattan | `manhattan` |
| `brooklyn`, `bk`, `kings county` | Brooklyn | `brooklyn` |
| `queens`, `qn`, `qns` | Queens | `queens` |
| `bronx`, `the bronx`, `bx` | Bronx | `bronx` |
| `staten island`, `si`, `richmond county` | Staten Island | `staten island` |

If “New York, NY” appears without borough, do not infer borough — leave null and route to `possible_match` unless another field supplies borough.

## Cross-street separators (intersections)

Recognize and normalize to internal token ` CROSS ` before splitting:

| Pattern | Example input |
|---|---|
| ` and ` | `Broadway and W 42 St` |
| ` & ` | `Broadway & W 42 St` |
| ` / ` | `5 Ave / 59 St` |
| ` + ` | `Broadway + 42 St` |
| ` @ ` | `Broadway @ 42 St` |
| ` at ` (intersection context only) | `Broadway at 42 St` |

After split: normalize each street independently, then sort alphabetically for `normalized_location_key`.

**Not intersection separators** (route to street-segment parser instead): `between`, `from … to …`, ` thru `, ` through `.

## Street segment patterns

| Pattern | Parsed fields |
|---|---|
| `{street} between {from} and {to}` | `street_name`, `from_street`, `to_street` |
| `{street} from {from} to {to}` | same |
| `{street} btw {from} and {to}` | same |
| `{from} to {to} on {street}` | same (reorder) |
| `{street}: {from}-{to}` | same |

Examples after normalization:

| Raw | `street_name` | `from_street` | `to_street` |
|---|---|---|---|
| `5 AVENUE BETWEEN 42 STREET AND 44 STREET` | `5 avenue` | `42 street` | `44 street` |
| `Broadway from W 42 St to W 44 St` | `broadway` | `west 42 street` | `west 44 street` |

Segment keys: `segment|{borough}|{street_name}|from:{from_street}|to:{to_street}`.

If `from_street` and `to_street` are equal → treat as intersection candidate instead.

## Park and venue name variants

| Rule | Example |
|---|---|
| Expand `park` suffix | `Central Pk` → `central park` |
| Remove redundant `park` duplication | `Flushing Meadows Park Park` → flag for review |
| Preserve official punctuation in `canonical_name` only | Display: `MacDonald Park`; key: `macdonald park` |
| `playground`, `field`, `plaza` suffixes | Often `park_asset` type |
| Colon split | `Flushing Meadows: Unisphere` → park + asset |

## Address points

Pattern: optional house number + street + optional borough.

1. Extract leading `\d+[-\d]*` as house number.
2. Remainder through street type expansion is street name.
3. Key: `address|{borough}|{house_number}|{street_name}`.
4. Missing house number → not an address match; try street segment or intersection.

Legacy cache alignment: keys compatible with `normalize(location)|normalize(borough)|` from C5G audit for migration (G1).

## Source-specific parser hooks

Each SODA source implements a thin parser before shared normalization:

| Source | Special handling |
|---|---|
| tvpp-9vvx | `event_location`, `location_name`; parade/route text → segment parser |
| cpcm-i88g (Parks locations) | `park_id`, `location_name`; seed park/park_asset records |
| Parks events | Join to cpcm-i88g on event/location identifiers |
| Future DOT / street closures | Closure ID + impact text → segment candidates (G4+) |

Parser output schema:

```json
{
  "raw_location_text": "...",
  "structured_hint": {
    "borough": null,
    "park_id": null,
    "venue_id": null,
    "location_type_guess": "intersection"
  }
}
```

## Match method labels

Stored on feed rows as `match_method` (distinct from match **status**):

| `match_method` | When used |
|---|---|
| `exact_key` | Direct `normalized_location_key` hit |
| `park_id_join` | Matched via cpcm-i88g join |
| `venue_id` | Matched via venue identifier |
| `source_override` | Source-specific override table |
| `manual_override` | Editorial override record |
| `address_exact` | Address key hit |
| `intersection_exact` | Intersection key hit |
| `segment_exact` | Street segment key hit |
| `segment_centroid_approved` | Approved centroid of segment line |

Fuzzy/substring methods (`substring`, `fuzzy_token`, `geocoder_provisional`) may only produce `possible_match` — never production publish.

## Conflict detection

Flag `conflict` when:

1. Two or more registry records share the lookup key but differ in coordinates beyond tolerance (~25 m).
2. Same normalized street name matches records in multiple boroughs and incoming row lacks borough.
3. Source override points to retired registry record.
4. Segment range overlaps multiple approved segments with different geometry.

## Needs-review routing

Rows with status `possible_match`, `conflict`, or `unmatched` emit records to:

- `data/reports/{source}_location_needs_review.json` (live-feeds)
- Admin review UI (field-desk G5)

Minimum review payload: source row id, raw text, normalized key candidates, registry_id candidates, status, reason codes.

## Quality scoring (non-publish)

`match_confidence` is advisory:

| Signal | Weight hint |
|---|---|
| Exact key + approved record | 1.0 |
| Exact key + provisional record | 0.5 |
| Substring park name | 0.3 |
| Missing borough | cap 0.4 |
| Multiple candidates | cap 0.2 |

Confidence does **not** override `approval_status` or production gate.
