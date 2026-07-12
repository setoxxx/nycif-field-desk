# NYCIF Master Platform Architecture V1

Version: 1.0
Date: July 12, 2026
Owner: Howard Weiss
Status: Planning — no implementation authorized by this document

## Document purpose

This document records the authoritative technical architecture for the NYC In Focus platform. It is a planning artifact only. It separates component design decisions and system boundaries from the product roadmap (`nycif-platform-master-plan.md`) and from the live-feeds engineering roadmap (`live-feeds-master-roadmap.md`).

Every component, interface, integration point, and service boundary listed here requires separate explicit authorization before any implementation begins. This document does not authorize API development, chat infrastructure, authentication, notifications, mobile applications, geocoding, WordPress changes, deployment, publishing, or any production behavior.

## System boundary

The NYC In Focus platform is composed of four independently authorized layers:

1. Data and editorial pipeline
2. App-facing API
3. Account and community services
4. Presentation

A single backend serves all authorized client surfaces: the website, iOS app, Android app, widgets, newsletter, and future partner APIs. The live-feeds pipeline is the current active engineering track. The architecture is recorded here so no future component is designed in isolation.

## Layer 1 — Data and editorial pipeline

The pipeline owns all ingestion, normalization, stable identity, location quality, review, and publishing decisions. It is the only layer authorized to write to the production event store. No code change in any other layer may trigger a publication event.

### 1a. Source ingestion

Pulls from NYC Open Data permit feeds, city agency sources, and additional tracked origins on scheduled intervals. Output is a normalized candidate set. No production write is authorized during ingestion.

Status: `partially_complete`. Milestones 1–5 established the ingestion foundation. Milestone 6 (GPS pipeline reliability) is complete/merged on PR #143 in the live-feeds repository (head `5197bdd3918fd95a381e8f9e520681fa7fe36464`; merge `8796d64ea628007327e715f0995c16e6ab071c78`).

### 1b. Normalization and identity

Assigns stable event identities, deduplicates records, and applies consistent field normalization across all sources. One canonical shared implementation is the Milestone 7 objective. Positional review arrays are planned for deprecation.

Status: `partially_complete`. Identity consolidation and explicit duplicate-key enforcement are the next planned milestone (7). Separate authorization is required to begin.

### 1c. GPS and location quality

Validates and resolves GPS coordinates for all events before staging. Raw ingestion coordinates are never exposed in the public API or application. Location drift detection and identity-transition tests are part of this layer.

Status: `complete`. Implementation complete and merged on live-feeds PR #143. Milestone 7 remains planned, not authorized, and not started.

### 1d. Review and adjudication

An operator workflow stages events for human or rule-based review before any publication. Approve, hold, and reject decisions are recorded with evidence. No automated publication is authorized without a completed review step.

Status: `partially_complete`. The field desk admin dashboard provides read-only operator visibility. Write controls are not in scope for the admin dashboard and are not implemented there.

### 1e. Publishing controls

Gate-controlled publication from the staging queue to the production event store. Every production publish requires separate explicit authorization. GPS quality and identity milestones must be complete before the next authorized publish cycle.

Status: `partially_complete`. Gate structure is in place. Authorized publishes depend on Milestones 6 and 7 completing.

## Layer 2 — App-facing API

The API layer exposes stable, versioned read endpoints for all authorized clients: the website, iOS app, Android app, widgets, newsletter, and partner integrations. It reads from the production event store and the editorial CMS. It does not write to event records or the pipeline.

### 2a. Events API

Versioned endpoints for event lists, single-event detail, date range queries, and borough and category filters. Includes a stable pagination cursor, caching strategy, rate limits, and a defined error contract. Breaking changes require a new API version; existing clients must not be broken.

Status: `planned` (Milestone 8). No implementation authorized.

### 2b. Nearby search

Geospatial endpoint accepting a center coordinate and radius, returning events within that boundary. Must never expose other users' coordinates, home addresses, movement history, or precise distances in any response.

Status: `planned` (Milestone 8). No implementation authorized.

### 2c. Event significance service

Computes Gold, Silver, and Bronze event significance tiers from evidence signals: estimated attendance, historical attendance, event duration, permit footprint, route and road closures, agencies involved, geographic footprint, and annual flagship status. Tier assignments are readable by clients and auditable by users on request. No tier can be purchased or influenced by sponsorship fees.

Status: `planned` (Milestone 8). No implementation authorized.

### 2d. Articles and media API

Exposes NYC In Focus editorial content — articles, galleries, video, and breaking updates — to API clients. Includes borough and category facets, deep links to event map pins and local ZIP rooms, and required content-type labeling. Editorial content, community posts, and sponsored content are distinct types and must be visibly labeled as such in every response.

Status: `planned` (Milestone 8). WordPress integration is a separate concern addressed in Milestone 13. No implementation authorized.

## Layer 3 — Account and community services

Account and community services are entirely separate from the event pipeline. The chat database and all private user records are never stored in any public repository. This layer has no read or write access to the production event store.

### 3a. Authentication

Standard account creation, login, session management, and password handling. Account identity is separate from location identity; a user does not need an account to browse the map or read rooms. The initial release does not require social login.

Status: `planned` (Milestone 9). No implementation authorized.

### 3b. Privacy-preserving geofence verification

Server-side point-in-polygon check: the user's current precise coordinates are sent to the server and checked against an approved ZIP Code boundary polygon. The result is a boolean eligibility decision and a short-lived authorization token. Client-side polygon checks are not acceptable. Coordinates, precise distance, and movement history are never returned to the caller, stored beyond the verification request, or exposed to other users.

Status: `planned` (Milestone 9). No implementation authorized.

### 3c. ZIP room authorization

Short-lived eligibility tokens from geofence verification gate write access to a specific ZIP Code room. Tokens expire; re-verification is required to re-enter a room after expiry. Browse access to public rooms requires no token and no location permission.

Status: `planned` (Milestone 9). No implementation authorized.

### 3d. Real-time chat

WebSocket-based messaging for ZIP Code rooms. Covers message delivery, order guarantees, reconnection handling, and a defined media attachment policy. The chat store is private infrastructure and is never committed to any public repository. Moderation must be production-ready before any public chat launch.

Status: `planned` (Milestone 10). No implementation authorized.

### 3e. Moderation and trust-and-safety

Report, block, and mute flows; moderation queue and action log; per-user and per-room rate limits; automated content signals. Community reports are labeled as unverified until independently confirmed by NYC In Focus reporting. Moderation is a launch requirement, not a post-launch addition. There is no "launch now, add moderation later" path.

Status: `planned` (Milestone 10). No implementation authorized.

### 3f. Push notifications

Opt-in per-topic notification delivery via APNs (iOS) and FCM (Android). Independent controls for ZIP chat activity, selected boroughs, event categories, Gold/Silver significance tiers, saved event reminders, breaking NYCIF coverage, and new stories. Notifications must be rate-limited per topic and per user, and easy to disable from every notification surface. The product must never rely on notification spam for retention.

Status: `planned` (Milestone 12). No implementation authorized.

## Layer 4 — Presentation

### 4a. NYC In Focus website

The current active web presence. Hosts the public event map, editorial content, and borough pages. All changes to the website require separate explicit authorization. The public map is curated and may intentionally show less than the operator press God View.

Status: `active`. Changes require separate authorization.

### 4b. iOS application

Native iOS app delivering the three-panel experience: center map, left ZIP chat, right story feed. Press-and-hold circular navigation controls and horizontal swipe gestures move between panels while reducing accidental navigation. All device form factors, accessibility requirements, and deep-link patterns are part of the design scope. TestFlight testing is required before any App Store submission.

Status: `planned` (Milestone 11). No implementation authorized.

### 4c. Android application

Same three-panel experience as iOS, built for Android devices and screen sizes. Google Play internal track testing is required before any submission to the store.

Status: `planned` (Milestone 11). No implementation authorized.

### 4d. Editorial feed and WordPress integration

The right panel consumes NYC In Focus editorial content from the WordPress CMS via the articles and media API. Story cards, photo and video content, borough and category feeds, map pin deep links, and local room deep links are part of the design. Editorial content, community posts, and sponsorships are visually distinct in all surfaces. WordPress integration changes require separate authorization.

Status: `planned` (Milestone 13). No implementation authorized.

### 4e. Widgets and newsletter

Home-screen event widgets, lock-screen event previews, and the NYCIF newsletter. Not authorized until the core iOS and Android applications complete Milestone 14 privacy, safety, and store-readiness checks.

Status: `post_launch`. No timeline or authorization before Milestone 14 completes.

## Cross-cutting concerns

### Privacy and security

- Precise user coordinates are never exposed to other users, in any public API response, or in the event pipeline output.
- Geofence verification is server-side only.
- Posting eligibility is server-authorized and expires.
- Location permission is requested at posting time, not at first launch.
- Background location is not required in the initial release.
- The chat store and all private user records are never committed to any public repository.

### Editorial integrity

- Gold, Silver, and Bronze significance tiers are evidence-based and cannot be purchased or influenced by commercial relationships.
- Sponsored placement uses a distinct label separate from significance computation.
- Editorial picks use a distinct label separate from significance computation.
- Community reports are labeled as unverified until independently confirmed by NYCIF editorial.
- Revenue products must not influence significance tier computation.

### Infrastructure

The platform runs a single backend serving all client surfaces. Infrastructure decisions (hosting provider, CDN, database engine, push notification provider) are authorized per milestone and are not implied by this architecture document.

## Component status registry

| Component | Layer | Milestone | Status |
|---|---|---|---|
| Source ingestion | Data pipeline | 1–5 | partially_complete |
| Normalization and identity | Data pipeline | 7 | partially_complete |
| GPS and location quality | Data pipeline | 6 | complete |
| Review and adjudication | Data pipeline | — | partially_complete |
| Publishing controls | Data pipeline | — | partially_complete |
| Events API | App API | 8 | planned |
| Nearby search | App API | 8 | planned |
| Event significance service | App API | 8 | planned |
| Articles and media API | App API | 8 | planned |
| Authentication | Community | 9 | planned |
| Geofence verification | Community | 9 | planned |
| ZIP room authorization | Community | 9 | planned |
| Real-time chat | Community | 10 | planned |
| Moderation and trust-and-safety | Community | 10 | planned |
| Push notifications | Community | 12 | planned |
| NYC In Focus website | Presentation | — | active |
| iOS application | Presentation | 11 | planned |
| Android application | Presentation | 11 | planned |
| Editorial feed and WordPress integration | Presentation | 13 | planned |
| Widgets and newsletter | Presentation | post-launch | post_launch |

## Integration points

| Source | Target | Protocol | Status |
|---|---|---|---|
| Data pipeline | Events API | Internal read | planned |
| Events API | iOS and Android apps | HTTPS REST | planned |
| Events API | Website | HTTPS REST | planned |
| Event significance service | Events API | Internal read | planned |
| Articles and media API | Story feed (app) | HTTPS REST | planned |
| WordPress CMS | Articles and media API | HTTPS REST pull | planned |
| Geofence verification | ZIP room authorization | Internal | planned |
| ZIP room authorization | Real-time chat | Internal token | planned |
| Push notifications | iOS | APNs | planned |
| Push notifications | Android | FCM | planned |
| Authentication | Events API and chat | Session token | planned |

## Architecture decisions

### ADR-001 — Single backend for all client surfaces

**Decision:** One backend API serves the website, iOS app, Android app, widgets, newsletter, and future partner APIs.

**Rationale:** A single backend avoids divergent data contracts, reduces duplication, and makes privacy and rate-limit policies enforceable in one place.

**Constraints:** Breaking changes to the API require versioning. Existing clients must not be broken by internal platform changes.

### ADR-002 — Server-side geofence verification only

**Decision:** User coordinates are sent to the server; a boolean eligibility result and a short-lived token are returned. Coordinates are never returned to the caller or stored beyond the verification request. Client-side polygon checks are not acceptable.

**Rationale:** Client-side verification cannot be trusted. Returning coordinates to the client exposes them if the app is compromised or the network is intercepted.

### ADR-003 — Location permission requested at posting time only

**Decision:** The apps request precise location permission only when a user attempts to post in a local room. Map browsing and room reading do not require location access. Background location is not requested in the initial release.

**Rationale:** Requesting location at first launch increases rejection rates and erodes user trust. The product must earn location access at the moment it is clearly useful.

### ADR-004 — Moderation is a launch requirement

**Decision:** Report, block, mute, rate-limit, moderation queue, action log, and contact mechanisms must be implemented and tested before any public chat launch. There is no "launch now, add moderation later" option.

**Rationale:** Public chat without moderation creates safety and legal risks. Community trust is a product asset easier to build than to repair after an incident.

### ADR-005 — Evidence-based event significance only

**Decision:** Gold, Silver, and Bronze tiers are computed from measurable signals. No tier can be purchased or influenced by commercial relationships. Users may view the evidence behind any tier assignment.

**Rationale:** Editorial credibility is the product's core trust asset. Paid significance tiers would destroy that credibility and risk mislabeling commercial placement as independent editorial assessment.

### ADR-006 — Chat store never in a public repository

**Decision:** The chat database and all private user records (messages, verification events, moderation actions) are stored only in private infrastructure and are never committed to any public code repository.

**Rationale:** User posts in geographic rooms are sensitive. Committing them to a public repository would violate user expectations and potentially applicable legal obligations.

## Non-negotiable architecture rules

1. No component writes to the production event store without explicit publish authorization.
2. Precise user coordinates are never exposed to other users or in any public API response.
3. Geofence verification is server-side only. Client-side polygon checks are not acceptable.
4. Posting eligibility tokens expire. Re-verification is required for re-entry after expiry.
5. Browse access to public rooms requires no token and no location permission.
6. The chat store and all private user records are never committed to any public repository.
7. Moderation, reporting, blocking, and contact mechanisms are required before any public chat launch.
8. Event significance tiers cannot be influenced by payment or commercial relationships.
9. Sponsored placement and editorial selections use distinct labels; neither is part of significance computation.
10. Every integration point and service boundary requires separate authorization before implementation begins.
11. No milestone automatically authorizes the next milestone, any production launch, or any app-store submission.

## Current engineering position

Architecture V1 is a planning artifact only. The current authorized engineering track is the live-feeds pipeline documented in `docs/live-feeds-master-roadmap.md`.

Platform Milestone 6 (GPS pipeline reliability and identity integrity) is complete/merged on PR #143 in the live-feeds repository (head `5197bdd3918fd95a381e8f9e520681fa7fe36464`; merge `8796d64ea628007327e715f0995c16e6ab071c78`).

Platform Milestone 7 (identity consolidation and duplicate enforcement) is the next planned milestone and requires separate explicit authorization to begin. It has not started.

No work on Layers 2, 3, or 4 is authorized by this document or by this architecture pull request.

## Dynamic status pages

- Architecture dashboard: `admin/platform-architecture.html`
- Architecture registry JSON: `admin/data/nycif-platform-architecture.json`
- Platform master roadmap: `admin/platform-roadmap.html`
- Platform roadmap JSON: `admin/data/nycif-platform-roadmap.json`
- Platform master plan: `docs/nycif-platform-master-plan.md`
- Live Feeds engineering roadmap: `admin/live-feeds-roadmap.html`
- Admin God View: `admin/index.html`
