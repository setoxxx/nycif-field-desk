# Community Help Build Order v2

Owner direction: execute strictly in this order. Do not start a later stage until the earlier stage has a reviewed source ledger, mapped-data implementation, automated QA, and documented coverage limits.

## Stage 1 — Legal, tax, and dedicated Faith & Community pins

Deliverables:
- physical-location datasets for legal help and free tax preparation where authoritative current locations are available
- a dedicated Faith & Community dataset; do not infer the entire layer from food-provider tags
- official locator links retained as current fallbacks
- religion, ethnicity, language, or community identity recorded only when explicitly documented by the provider or authoritative source

## Stage 2 — Complete food, Homebase, and naloxone coverage

Deliverables:
- complete or source-complete food assistance coverage from Food Help NYC
- mapped Homebase homelessness-prevention offices
- broader official naloxone, overdose-prevention, and harm-reduction coverage
- refresh and stale-data contracts for fast-changing locations and hours

## Stage 3 — WIC, clinics, mental health, and broader benefits

Deliverables:
- WIC offices
- public and low-cost clinics
- mental-health and substance-use access points
- IDNYC, benefits-screening, financial counseling, Medicaid and related enrollment-help locations

## Stage 4 — Senior, disability, domestic-violence, and immigration services

Deliverables:
- older-adult centers and assistance
- disability and independent-living services
- Family Justice Centers and other publicly advertised domestic-violence access points
- immigration legal and community support providers

## Stage 5 — Libraries, restrooms, cooling centers, and daily public utilities

Deliverables:
- public libraries and computer/Wi-Fi access
- public restrooms
- cooling and warming centers with seasonal/current-state handling
- public showers, laundry, charging, and similar daily utilities when authoritative sources exist

## Stage 6 — Additional MOME, DOB, and DOT feeds

Deliverables:
- isolated source evaluation and shadow tests first
- only additive, current, non-duplicative records promoted
- source-specific lifecycle, coordinate, dedupe, and attribution rules
- no candidate feed reaches production merely because an endpoint exists

## Stage 7 — Missing-event reconciliation

Deliverables:
- trace Event 923896 and the reported block party end to end
- prove every ingested-but-not-visible event has a reason code
- same-snapshot source, feed, map, and list reconciliation
- permanent regression fixtures for local block parties, street events, community events, every borough, and every source path
- no READY declaration based solely on aggregate health status

## Cross-stage requirements

Every physical resource record must include a stable ID, public title, category, address, borough, validated coordinates or documented locator-only status, public source URL, verification date, availability status, and reader-safe access notes. Permanent resources remain separate from date-based events.

The source probe is implemented in `scripts/probe_community_sources.py`. Its GitHub Actions artifact is an evidence input, not automatic authorization to ingest or publish a source.
