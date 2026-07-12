# NYC In Focus Platform Master Plan

Version: 1.0  
Date: July 12, 2026  
Owner: Howard Weiss  
Status: Active product direction

## Mission

Build NYC In Focus into a trusted New York City information platform that combines a live event map, location-verified neighborhood conversation, and original NYC In Focus reporting in one mobile-first ecosystem.

The long-term product is not only a website or map. It is one backend and trust system powering the website, iPhone app, Android app, notifications, widgets, newsletters, and future partner APIs.

## Core application experience

### Center: Live NYC map

The main screen shows approved events and city activity with category, borough, date, time, nearby, and significance filters. Event pages connect to directions, saved items, the relevant ZIP room, and related NYC In Focus reporting.

Navigation uses horizontal swipes plus two small circular arrow controls. Press-and-hold activates left or right navigation to reduce accidental screen changes while the user is interacting with the map.

### Left: Geo-verified ZIP Code chat

Users browse the five boroughs and then ZIP Code rooms. Anyone may read public discussion. Posting requires a short-lived server-side verification that the user is physically inside the approved geographic boundary.

The app requests precise location only when a user attempts to participate. The initial release does not require continuous background location. Exact coordinates, addresses, movement history, and precise distance are never shown to other users.

Required launch controls include reporting, blocking, muting, moderation, rate limits, audit logs, contact information, community rules, and clear labeling of community reports that have not been independently verified by NYC In Focus.

### Right: NYC In Focus story feed

The right panel is a visual feed of NYC In Focus articles, breaking updates, Civic Watch reporting, galleries, and video. Stories link back to event pins and appropriate local rooms. NYCIF reporting, community posts, editorial selections, and paid sponsorships must remain visibly distinct.

## Notifications and retention

Users control notifications in settings. Independent options should cover:

- ZIP Code chat
- selected boroughs
- event categories
- Gold-only or Gold-and-Silver events
- saved event reminders
- breaking NYCIF coverage
- new NYC In Focus stories

Notifications must be opt-in, useful, rate-limited, and easy to disable. The product should never rely on notification spam for retention.

## Event significance system

The app uses evidence-based event significance rather than a paid VIP ranking.

- Gold: major citywide event
- Silver: significant borough or regional event
- Bronze: notable community event

Signals may include estimated and historical attendance, event duration, permit footprint, geographic footprint, routes and road closures, agencies involved, and annual flagship status. Users should be able to view why an event received its tier.

No organizer may purchase a Gold, Silver, or Bronze designation. Sponsored placement and editorial selections must use separate labels.

## Technical architecture

1. Data and editorial pipeline
   - source ingestion
   - normalization
   - stable identity
   - GPS and location quality
   - review, adjudication, staging, and publishing controls

2. App-facing API
   - versioned events
   - nearby search
   - boroughs and categories
   - event significance
   - articles and media
   - pagination, caching, errors, and rate limits

3. Account and community services
   - authentication
   - privacy-preserving geofence verification
   - short-lived room eligibility
   - real-time chat
   - moderation and trust-and-safety
   - push notifications

4. Presentation
   - NYC In Focus website
   - iOS and Android application
   - widgets, newsletter, and future partner integrations

The chat database and private user records must not be stored in the public feed repository.

## Canonical milestone timeline

1. Foundation and governance — complete
2. Fixture and registry validation — complete
3. Credential and network-control closure — complete
4. Isolated validation execution — complete
5. Dependency reproducibility and workflow hardening — complete
6. GPS pipeline reliability and identity integrity — implementation complete on PR #143; review and merge pending
7. Identity consolidation and duplicate enforcement — next planned milestone
8. App-facing API and event-significance service
9. Accounts, location verification, and ZIP-room authorization
10. Real-time chat and trust-and-safety
11. Three-panel cross-platform application
12. Notifications and personalization
13. Editorial feed and WordPress integration
14. App-store privacy, safety, testing, and launch
15. Revenue and growth

## Immediate next engineering direction

After PR #143 is independently reviewed and merged, Milestone 7 should:

- consolidate duplicated normalization logic into one shared implementation;
- establish one canonical identity contract across active pipeline stages;
- add explicit duplicate-key detection to the GPS repository builder;
- formally deprecate or remove unsafe positional review arrays;
- add offline regression tests for migration compatibility;
- make no live-source, production, publishing, WordPress, or public-map change without separate authorization.

## Revenue direction

Potential revenue streams include clearly labeled sponsored events, paid organizer enhancement tools, ticket and attraction affiliate links, premium alerts or memberships, local business promotion, advertising separated from editorial ranking, and partner data/API licensing.

Editorial credibility is a product asset. Paid placement must never change evidence-based significance tiers or masquerade as NYCIF reporting.

## Non-negotiable rules

- Precise coordinates are never exposed to other users.
- Location eligibility is server-authorized and expires.
- Browsing works without precise location.
- Community claims are not presented as verified reporting.
- Moderation and abuse controls are required before public chat launch.
- Event significance cannot be purchased.
- Sponsorship is labeled separately from editorial and algorithmic ranking.
- Every production, location, notification, publishing, or app-store step requires explicit authorization and evidence.
- No milestone automatically authorizes the next one.

## Prompt handoff workflow

- Long implementation prompts must be saved as plain-text `.txt` files in the repository or generated as downloadable `.txt` artifacts.
- Do not paste large implementation prompts directly into chat when a text-file handoff is possible.
- Every future milestone handoff must identify the exact prompt filename.
- The prompt file is the authoritative reusable handoff artifact; chat summaries should remain short.
- This rule exists to reduce browser freezing, preserve exact wording, and make Claude Code browser workflows easier to resume and test.
- A prompt file does not authorize execution by itself. Normal milestone authorization, review, merge, and safety gates still apply.

## Dynamic status pages

- Platform architecture: `admin/platform-architecture.html`
- Platform architecture JSON: `admin/data/nycif-platform-architecture.json`
- Platform roadmap: `admin/platform-roadmap.html`
- Platform roadmap JSON: `admin/data/nycif-platform-roadmap.json`
- Platform phases: `docs/platform-phases.md`
- Platform feature registry: `docs/platform-feature-registry.md`
- Platform feature registry JSON: `admin/data/platform-feature-registry.json`
- Platform dependency graph: `docs/platform-dependency-graph.md`
- Platform timeline JSON: `admin/data/platform-timeline.json`
- Live Feeds engineering roadmap: `admin/live-feeds-roadmap.html`
- Admin God View: `admin/index.html`
