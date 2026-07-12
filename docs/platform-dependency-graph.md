# NYCIF Platform Dependency Graph

Version: 1.0
Date: July 12, 2026
Owner: Howard Weiss
Status: Planning artifact — no implementation authorized by this document

## Purpose

This document is the authoritative dependency sequence for the whole NYC In Focus platform: source ingestion; normalization; stable identity; deduplication; GPS and location quality; validation; event significance; review and adjudication; publishing controls; production event store; app-facing API; event map; story feed; accounts; privacy-preserving geofence verification; ZIP-room authorization; real-time chat; moderation and trust-and-safety; notification preferences; push delivery; iOS and Android clients; app-store launch; analytics; and revenue systems.

It exists so that no future component is designed, authorized, or implemented out of order, and so every reviewer can check a proposed change against one diagram instead of reconstructing dependency order from separate documents.

## Readable dependency diagram

```
                                   ┌─────────────────────────────────────────────┐
                                   │              DATA / EDITORIAL PIPELINE        │
                                   │                                               │
  source ingestion ──▶ normalization ──▶ stable identity ──▶ deduplication ──▶     │
   GPS / location quality ──▶ validation ──▶ event significance ──▶               │
   review / adjudication ──▶ publishing controls ──▶ PRODUCTION EVENT STORE       │
                                   └───────────────────┬───────────────────────────┘
                                                        │  (read-only)
                                                        ▼
                                            app-facing API (versioned, read-only)
                                                        │
                                        ┌───────────────┼────────────────────┐
                                        ▼                                    ▼
                                event map / map filters              story feed / articles
                                event detail / directions            breaking-news / borough feeds
                                        │                                    │
                                        └───────────────┬────────────────────┘
                                                        ▼
                                                 analytics (read-only)

  ──────────────────────────── separate chain: accounts and community ────────────────────────────

  accounts ──▶ geofence verification ──▶ ZIP-room authorization ──▶ real-time chat ──▶
    moderation / trust-and-safety ──▶ notification preferences ──▶ push delivery ──▶
    iOS and Android clients ──▶ app-store launch

  ──────────────────────────────────────── revenue ────────────────────────────────────────────────

  (app-facing API + accounts) ──▶ business listings / sponsored placement / premium membership /
                                   partner API
                                   (sponsorship and premium status never feed back into
                                    event significance computation)
```

Both chains converge only through read-only consumption of the app-facing API (for example, notifications referencing map or story content) and through shared account identity (for example, saved events, premium membership). Neither chain is permitted to bypass the API to reach the production event store directly.

## Principal sequence — data and editorial pipeline

```
source ingestion → normalization → stable identity → deduplication → GPS/location validation
  → event significance → review/adjudication → publishing controls → production event store
  → app-facing API → map and story clients
```

This is the only path by which data reaches a client. Every stage listed is a hard dependency of the stage that follows it.

## Principal sequence — accounts and community

```
accounts → geofence verification → ZIP-room authorization → real-time chat → moderation
  → notification preferences → push delivery → mobile release
```

This chain does not depend on the data/editorial pipeline chain except where a feature explicitly reads pipeline data (for example, a "nearby-event notification" reads the event map's data through the app-facing API; it does not read the production event store directly).

## Hard dependencies

- Normalization requires ingested, unnormalized candidate records to exist — it cannot run first.
- Stable identity assignment requires normalized records — identity cannot be assigned to un-normalized data.
- Deduplication requires stable identity — you cannot detect duplicates of records that have no stable identity to compare.
- GPS/location validation requires deduplicated records — validating a duplicate wastes review effort and can produce conflicting location verdicts for the same real-world event.
- Event significance requires validated location and deduplicated identity — significance signals (footprint, route closures) are meaningless against unvalidated or duplicate records.
- Review/adjudication requires a computed significance signal to prioritize operator attention, and requires validated GPS.
- Publishing controls require a completed review/adjudication decision — nothing may publish without one.
- The production event store may only be written to by publishing controls.
- The app-facing API may only read from the production event store and the editorial CMS — never from staging, review, or raw ingestion data.
- Map, story, and notification clients may only read through the app-facing API.
- Geofence verification requires an authenticated account — anonymous posting eligibility is not a supported state.
- ZIP-room authorization requires a successful, unexpired geofence verification.
- Real-time posting requires a valid ZIP-room authorization token; real-time *browsing* does not.
- Moderation and trust-and-safety must be complete before real-time chat posting is enabled in production — not after.
- Push delivery for any topic requires that topic's underlying feature (chat, map/significance, stories) to exist and requires notification preferences to exist first.
- Mobile release (app-store submission) requires the API, accounts, geofencing, chat, moderation, and push chains to all be production-complete.
- Revenue features that reference significance (sponsored placement) must read the existing significance computation and must never write to it.

## Optional dependencies

- Analytics may be introduced incrementally per surface (API usage, map interaction, chat activity) and does not need to wait for every other phase to complete; it only needs the specific surface it is instrumenting to exist.
- Widgets and newsletter are optional presentation surfaces layered on top of the mobile release and are explicitly deferred (`post_launch` status) until Phase 11 app-store requirements are satisfied.
- Partner API and business listings can, in principle, ship before premium membership if authorized independently — there is no hard ordering requirement between individual revenue features beyond each one's own listed dependencies.
- Borough and breaking-news feed variants are optional refinements of the base story feed and do not block each other.

## Forbidden dependency bypasses

- **No client may bypass the API or publishing controls to write directly to the production event store.** This includes admin tooling, operator dashboards, and mobile clients.
- No client or service may read directly from the staging/review queue as if it were production data.
- No component outside the data/editorial pipeline may mark an event published, held, or rejected.
- No chat or account service may read from or write to the production event store.
- No revenue feature may write to, weight, or otherwise influence Gold/Silver/Bronze significance computation.
- No client-side code may perform geofence (point-in-polygon) verification in place of the server-side check.
- No mobile or web client may request or cache another user's precise coordinates, home address, or movement history.
- No component may skip moderation/trust-and-safety to accelerate a chat launch.

## Failure behavior

- If GPS/location validation fails for a record, that record halts at review/adjudication and is never auto-published.
- If the app-facing API cannot reach the production event store, it must fail closed (return an explicit error) — it must never fall back to reading staging or raw ingestion data.
- If geofence verification fails or times out, posting eligibility defaults to denied; browsing remains available.
- If a ZIP-room authorization token expires mid-session, further posting attempts are denied until re-verification; already-sent messages are not retracted.
- If moderation tooling is unavailable, public posting must be disabled for the affected room rather than left open without moderation.
- If push delivery fails for a topic, the failure must not silently disable the user's other topic subscriptions.
- If a revenue integration cannot verify that it has zero write access to significance computation, it must not be deployed.

## Ownership boundaries

- **Data/editorial pipeline** (ingestion → publishing controls → production event store): owned by data/pipeline engineering. Only this owner may write to the production event store.
- **App-facing API**: owned by platform/API engineering. Read-only against the production event store and CMS; no ownership of pipeline internals.
- **Accounts, geofencing, ZIP-room authorization**: owned by community/identity engineering. No access to the production event store.
- **Real-time chat and moderation**: owned by community/trust-and-safety engineering. Chat data lives in private infrastructure only.
- **Push notifications**: owned by platform engineering, reading topic eligibility from accounts and content existence from the API.
- **Mobile clients (iOS/Android)**: owned by mobile engineering. Consume the API and community services; never write to the production event store or the chat database schema directly.
- **Revenue systems**: owned by commercial/product engineering. Read significance and account data; no write access to significance computation.

## Data classification boundaries — who may write to which store

| Store | May write | May read |
|---|---|---|
| Raw ingestion / staging queue | Data pipeline ingestion and normalization services only | Data pipeline and its own review/adjudication tooling |
| Review/adjudication decisions | Data pipeline review tooling (operator-facing, write controls out of scope for the admin dashboard) | Data pipeline, admin dashboards (read-only) |
| Production event store | Publishing controls only | App-facing API only |
| Editorial CMS (WordPress) | Editorial/CMS tooling only | App-facing API (articles/media endpoint) |
| Account/identity store | Accounts service only | Accounts service, geofence verification (identity check only, no cross-store join to the event store) |
| Chat database and private user records | Real-time chat and moderation services only | Real-time chat and moderation services only — never a public repository, never the data pipeline |
| Push subscription/topic store | Push notification service only | Push notification service, read by accounts for preference display |
| Revenue/billing store | Revenue/commercial services only | Revenue/commercial services; must never write to the production event store or significance computation |

This table is the authoritative reference for "which systems may write to which stores." Any proposed component that requires write access outside its listed store is a forbidden dependency bypass under this document and requires a new architecture decision, not a code change.
