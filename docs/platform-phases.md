# NYCIF Platform Phases

Version: 1.0
Date: July 12, 2026
Owner: Howard Weiss
Status: Planning artifact — no implementation authorized by this document

## Purpose

This document defines the twelve product-platform phases that sit above the engineering-milestone timeline already tracked in `nycif-live-feeds` (Canonical Milestones 1–7+) and above the component layers recorded in `docs/nycif-master-platform-architecture-v1.md`. Phases group related features from `admin/data/platform-feature-registry.json` into an ordered, dependency-checked sequence.

**Historical engineering milestones and future platform-product phases are deliberately kept separate.** The Canonical Milestone numbering in `nycif-live-feeds` describes *how the data pipeline was engineered and hardened*. The phases below describe *what user-facing and commercial capability ships next, and in what order*. A phase can reference milestone evidence (for example, Phase 2 references Canonical Milestone 6 and PR #143), but a phase is never renamed to match a milestone number, and completing a milestone does not by itself complete a phase.

**Do not mark any Canonical Milestone as merged without verified evidence.** Canonical Milestone 6 is verified complete and merged on live-feeds PR #143. Phase 2 below reflects that fact precisely: Milestone 6 is complete/merged, Milestone 7 remains planned, not authorized, and not started, and Phase 2 remains in progress at 50%.

## The twelve phases

| # | Phase ID | Name |
|---|----------|------|
| 1 | `phase-01` | Engineering foundation |
| 2 | `phase-02` | GPS and event identity integrity |
| 3 | `phase-03` | App-facing API |
| 4 | `phase-04` | Accounts and identity |
| 5 | `phase-05` | Location verification and geofencing |
| 6 | `phase-06` | Real-time ZIP Code chat |
| 7 | `phase-07` | Trust and safety |
| 8 | `phase-08` | Story and editorial feed integration |
| 9 | `phase-09` | Push notifications |
| 10 | `phase-10` | Cross-platform mobile application |
| 11 | `phase-11` | App-store privacy, testing, and launch |
| 12 | `phase-12` | Revenue and commercial expansion |

This order is authoritative for planning. It does not by itself authorize work on any phase; each phase requires separate explicit authorization to begin, per the non-negotiable rules in `docs/nycif-master-platform-architecture-v1.md` and `docs/platform-dependency-graph.md`.

---

### Phase 1 — Engineering foundation

- **Purpose:** Establish repository governance, evidence standards, credential and network controls, and reproducible/isolated validation execution for the data pipeline.
- **Dependencies:** None — this is the root phase.
- **Current status:** `complete`.
- **Implementation repositories:** `nycif-live-feeds`.
- **Success criteria:** Canonical Milestones 1–5 closed with documented evidence; dependency pinning and workflow hardening in place; fail-closed behavior verified.
- **Risks:** None open. Residual risk is regression if future workflow edits bypass the hardened conditions.
- **Completion requirements:** Already met — see `nycif-live-feeds` closure reports for Milestones 1–5.
- **Runtime impact:** None. Documentation, tooling, and CI-only.
- **Privacy impact:** None.
- **Separate authorization required for next phase:** Yes — Phase 2 requires its own authorization regardless of Phase 1 completion.

### Phase 2 — GPS and event identity integrity

- **Purpose:** Deliver one reliable, deduplicated, location-validated event identity so every downstream layer (API, map, significance, notifications) can trust a single canonical event record.
- **Dependencies:** `phase-01`.
- **Current status:** `in_progress` at 50%. Canonical Milestone 6 (GPS pipeline reliability and identity integrity) is complete/merged on live-feeds PR #143 (head `5197bdd3918fd95a381e8f9e520681fa7fe36464`; merge `8796d64ea628007327e715f0995c16e6ab071c78`). Canonical Milestone 7 (identity consolidation and duplicate-key enforcement) remains planned, not authorized, and not started.
- **Implementation repositories:** `nycif-live-feeds`.
- **Success criteria:** PR #143 merged; one canonical shared normalization/identity implementation in place; explicit duplicate-key detection; positional review arrays deprecated or removed; offline migration-compatibility regression tests passing.
- **Risks:** Starting Milestone 7 without separate authorization; silent reintroduction of duplicated normalization logic.
- **Completion requirements:** PR #143 merged with evidence; Milestone 7 objectives implemented and tested; no live-source, production, or publishing behavior changed without separate authorization.
- **Runtime impact:** None from this phase's own scope (pipeline-internal, staged data only). Production publishing remains gated separately.
- **Privacy impact:** None — no user or account data involved.
- **Separate authorization required for next phase:** Yes.

### Phase 3 — App-facing API

- **Purpose:** Expose stable, versioned, read-only event, nearby-search, significance, and article endpoints that every client (website, iOS, Android, partners) consumes instead of reading the pipeline directly.
- **Dependencies:** `phase-02`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Versioned endpoint contract; pagination, caching, rate limits, and error contract defined and implemented; nearby search never returns other users' coordinates; significance tiers computed from evidence signals only.
- **Risks:** Building the API against an unstable event-identity model before Phase 2 closes; accidentally exposing raw ingestion coordinates.
- **Completion requirements:** Endpoint contract published; automated tests for pagination/rate-limit/error behavior; no write path from the API into the production event store.
- **Runtime impact:** Introduces a new production-facing read service. Any production deployment requires separate explicit authorization.
- **Privacy impact:** Low — read-only public event and editorial data only.
- **Separate authorization required for next phase:** Yes.

### Phase 4 — Accounts and identity

- **Purpose:** Provide authentication, session management, and account lifecycle (including deletion) independent of location identity.
- **Dependencies:** `phase-01`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Account creation, login, session handling, and account deletion implemented; browsing the map and reading rooms requires no account.
- **Risks:** Conflating account identity with location identity; retaining deleted-account data beyond policy.
- **Completion requirements:** Account deletion is a real, tested, irreversible data-removal path, not a soft flag.
- **Runtime impact:** Introduces a production identity store. Requires separate authorization before any production deployment.
- **Privacy impact:** Medium — account credentials and profile data.
- **Separate authorization required for next phase:** Yes.

### Phase 5 — Location verification and geofencing

- **Purpose:** Provide server-side, privacy-preserving verification that a user is physically inside an approved ZIP Code boundary before granting posting eligibility.
- **Dependencies:** `phase-04`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Point-in-polygon check performed server-side only; response is a boolean eligibility decision plus a short-lived token; no coordinates, distance, or movement history returned or retained beyond the verification request.
- **Risks:** Any client-side polygon check; persisting precise coordinates past the verification window.
- **Completion requirements:** Token expiry and re-verification implemented and tested; no coordinate ever logged in a client-visible or public path.
- **Runtime impact:** Introduces a production location-verification service. Requires separate authorization.
- **Privacy impact:** High — precise real-time location data, even though only momentarily processed.
- **Separate authorization required for next phase:** Yes.

### Phase 6 — Real-time ZIP Code chat

- **Purpose:** Deliver borough/ZIP room browsing (public, read-only) and posting (geofence-gated) with real-time message delivery.
- **Dependencies:** `phase-05`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Public read access requires no token or location permission; posting requires a valid, unexpired geofence token; message ordering, reconnection, and media-attachment policy defined and tested.
- **Risks:** Launching posting without moderation in place (see Phase 7 — not permitted); storing the chat database anywhere in a public repository.
- **Completion requirements:** Chat store is private infrastructure only, never committed publicly; Phase 7 trust-and-safety controls must ship no later than public chat launch, not after it.
- **Runtime impact:** Introduces a production real-time messaging service. Requires separate authorization.
- **Privacy impact:** High — user-generated messages tied to approximate location context.
- **Separate authorization required for next phase:** Yes.

### Phase 7 — Trust and safety

- **Purpose:** Provide report, block, mute, moderator tooling, rate limiting, and unverified-content labeling required before any public chat launch.
- **Dependencies:** `phase-06`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Report/block/mute flows implemented; moderator dashboard and action log implemented; per-user and per-room rate limits enforced; community reports labeled as unverified until independently confirmed by NYCIF editorial.
- **Risks:** Treating trust-and-safety as a post-launch addition — explicitly disallowed by ADR-004 in the architecture document.
- **Completion requirements:** All items above must be implemented and tested before Phase 6's posting capability is enabled in production.
- **Runtime impact:** Adds moderation actions and audit logging to the production chat service.
- **Privacy impact:** Medium — moderation records reference user accounts and reported content.
- **Separate authorization required for next phase:** Yes.

### Phase 8 — Story and editorial feed integration

- **Purpose:** Surface NYC In Focus articles, breaking updates, and borough feeds inside the platform, linked to map pins and ZIP rooms, with clear editorial/community/sponsorship labeling.
- **Dependencies:** `phase-03`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Articles/media API consumed by story feed; borough and breaking-news feeds implemented; editorial, community, and sponsored content visibly distinct in every surface.
- **Risks:** WordPress integration changes made without separate authorization; sponsored content rendered indistinguishably from editorial content.
- **Completion requirements:** Content-type labeling verified in every rendering surface before this phase is considered complete.
- **Runtime impact:** Read-only content integration; any WordPress/CMS change requires separate authorization.
- **Privacy impact:** None — public editorial content only.
- **Separate authorization required for next phase:** Yes.

### Phase 9 — Push notifications

- **Purpose:** Deliver opt-in, per-topic push notifications (ZIP chat, borough, major-event, breaking-news, nearby-event) with independent user controls.
- **Dependencies:** `phase-04`, `phase-03`, `phase-06`, `phase-08`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Per-topic opt-in preferences; rate limiting per topic and per user; easy disable from every notification surface; no reliance on notification volume for retention.
- **Risks:** Enabling a notification topic before its source feature (chat, map, stories) exists; notification spam patterns.
- **Completion requirements:** Preferences UI and backend delivery (APNs/FCM) both implemented and tested before any topic is enabled in production.
- **Runtime impact:** Introduces production push delivery. Requires separate authorization.
- **Privacy impact:** Low to medium — device push tokens and topic subscriptions.
- **Separate authorization required for next phase:** Yes.

### Phase 10 — Cross-platform mobile application

- **Purpose:** Ship the native iOS and Android three-panel experience (map, chat, stories) with press-and-hold navigation, accessibility, and device-layout support.
- **Dependencies:** `phase-03`, `phase-06`, `phase-07`, `phase-09`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Feature parity across iOS and Android; accessibility requirements met; internal (TestFlight/Play internal track) testing completed.
- **Risks:** Submitting to app stores before Phase 11 privacy/safety review completes.
- **Completion requirements:** All consumed backend phases (3, 6, 7, 9) complete in production, not just in development, before store submission.
- **Runtime impact:** Client-only until store submission; store submission is Phase 11.
- **Privacy impact:** Inherits privacy impact of all consumed phases; must implement platform-specific privacy disclosures.
- **Separate authorization required for next phase:** Yes.

### Phase 11 — App-store privacy, testing, and launch

- **Purpose:** Complete privacy disclosures, permission-flow review, moderation readiness confirmation, accessibility sign-off, store assets, and submission for both app stores.
- **Dependencies:** `phase-10`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Apple App Store and Google Play submissions accepted; privacy disclosures accurate and complete; moderation readiness independently confirmed.
- **Risks:** Store rejection due to incomplete privacy disclosure or unready moderation tooling.
- **Completion requirements:** Explicit human authorization for the submission itself, per the non-negotiable rule that no milestone or phase automatically authorizes a launch.
- **Runtime impact:** Public production launch of the mobile applications.
- **Privacy impact:** High — first public exposure of the full account, location, and chat privacy surface.
- **Separate authorization required for next phase:** Yes.

### Phase 12 — Revenue and commercial expansion

- **Purpose:** Introduce clearly labeled sponsored events, business listings, premium membership, and partner API licensing without affecting editorial significance.
- **Dependencies:** `phase-03`, `phase-04`.
- **Current status:** `planned`.
- **Implementation repositories:** Not yet selected.
- **Success criteria:** Every revenue product visibly labeled as sponsored/paid, separate from Gold/Silver/Bronze significance and separate from editorial selection.
- **Risks:** Any commercial pressure to influence significance tiers or blur sponsorship labeling.
- **Completion requirements:** **Paid sponsorship cannot affect Bronze, Silver, or Gold significance under any circumstance.** In-app-purchase-based products (for example, premium membership) additionally require Phase 11 to be complete before submission-affecting changes ship.
- **Runtime impact:** Introduces production billing and partner-data-sharing paths. Requires separate authorization.
- **Privacy impact:** Medium — payment and partner data-sharing agreements.
- **Separate authorization required for next phase:** N/A — Phase 12 is the last phase in this framework; future partner or expansion work requires its own new authorization and is not implied by this document.

## Relationship to historical engineering milestones

| Platform phase | Related `nycif-live-feeds` Canonical Milestone(s) |
|---|---|
| Phase 1 — Engineering foundation | Milestones 1–5 (complete) |
| Phase 2 — GPS and event identity integrity | Milestone 6 (PR #143, complete/merged; head `5197bdd3918fd95a381e8f9e520681fa7fe36464`; merge `8796d64ea628007327e715f0995c16e6ab071c78`), Milestone 7 (planned, not authorized, not started) |
| Phases 3–12 | No corresponding Canonical Milestone yet exists in `nycif-live-feeds`; these are new platform-product phases, not renumbered engineering milestones. |

This table exists specifically so that no future document conflates a live-feeds engineering milestone number with a platform phase number. They are two independent sequences that happen to share Phase 1/2 as their point of contact.
