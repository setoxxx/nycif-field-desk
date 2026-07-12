# NYCIF Platform Feature Registry

Version: 1.0
Date: July 12, 2026
Owner: Howard Weiss
Status: Planning artifact — no implementation authorized by this document

## Registry purpose

The feature registry (`admin/data/platform-feature-registry.json`) is the single authoritative list of every user-facing and commercial feature planned for the NYC In Focus platform. It exists so that:

- every feature has one stable identity that other documents (phases, dependency graph, dashboards) can reference instead of re-describing it;
- status, priority, dependency, and authorization state are recorded in one place instead of drifting across separate roadmap documents;
- nothing can be quietly described as "done" without evidence.

The registry is descriptive, not authorizing. Listing a feature in the registry does not authorize its implementation.

## Schema

Every feature entry contains exactly these fields:

| Field | Type | Meaning |
|---|---|---|
| `featureId` | string | Stable, unique identifier. Never reused or renumbered once assigned. |
| `name` | string | Human-readable feature name. |
| `productArea` | string | Grouping used for dashboards (e.g., `map`, `chat`, `trust_and_safety`). |
| `description` | string | What the feature does and, where relevant, how it relates to any existing legacy behavior (e.g., the current production website map). |
| `status` | enum | One of the six status values below. |
| `priority` | enum | One of the four priority values below. |
| `dependencies` | array of `featureId` | Other registry features that must exist first. Must reference valid feature IDs only. |
| `targetPhase` | string | The `phase-XX` ID (from `docs/platform-phases.md`) that delivers this feature. Must reference a valid phase ID. |
| `implementationRepository` | string | Repository expected to hold the implementation, or a statement that none is yet selected. |
| `implementationState` | enum | `not_started`, `partial`, or `complete` — engineering-facing, independent of authorization. |
| `authorizationState` | enum | `not_authorized`, `authorized`, or `requires_separate_authorization` (used when a feature is conceptually next but has not been individually approved to begin). |
| `blocked` | boolean | Whether an unmet dependency currently prevents starting or continuing this feature. |
| `blocker` | string or null | Plain-language description of the blocking condition, or `null` if not blocked. |
| `runtimeImpact` | string | What production behavior, if any, this feature introduces once implemented. |
| `privacyImpact` | enum | `none`, `low`, `medium`, or `high`. |
| `moderationRequirement` | enum | `none` or `required_before_launch`. |
| `appStoreRelevance` | enum | `none`, `privacy_disclosure`, `in_app_purchase`, `core_functionality`, or `content_moderation_policy`. |
| `revenueRelevance` | enum | `none`, `indirect`, or `direct`. |
| `owner` | string | Role-based owning team, not a runtime authority. |
| `evidence` | string | Concrete evidence of implementation/verification, or an explicit statement that none exists. |
| `lastUpdated` | string (date) | Date this entry was last edited. |

## Status vocabulary

- **`planned`** — the feature is described and sequenced but no implementation work has started. Planned does not mean authorized.
- **`authorized`** — a human has explicitly approved starting implementation of this specific feature. Authorization does not mean implemented.
- **`implemented`** — code exists and runs in at least a development or staging environment. Implemented does not mean production-approved, and documentation describing a feature is never sufficient by itself to claim this status — documentation does not count as runtime completion.
- **`verified`** — implemented, and independently tested/reviewed against its success criteria (see `docs/platform-phases.md` for phase-level success criteria).
- **`released`** — verified, running in production, with immutable evidence (a merged PR, a deployment record, a dated log or report) that a reviewer can check without trusting this document. **A feature cannot be marked `released` without immutable evidence.**
- **`deprecated`** — previously implemented or released, now intentionally retired.

## Priority vocabulary

- **`critical`** — blocks multiple downstream phases if delayed (e.g., the app-facing API).
- **`high`** — required for its own phase's success criteria.
- **`medium`** — improves the phase but is not a hard blocker for the phases that depend on it.
- **`low`** — optional refinement (e.g., borough-specific feed variants).

## Dependency rules

1. Every `dependencies` entry must be a `featureId` that exists elsewhere in the same registry.
2. A feature's `targetPhase` must be a phase whose own phase-level dependencies (in `docs/platform-phases.md`) are satisfied no later than the feature's listed feature-level dependencies.
3. Circular dependencies are not permitted; the dependency graph must resolve to a single topological order.
4. A feature dependency describes "must exist before this can start," not "must be released before this can start" — `implemented` may be sufficient for a downstream feature to begin development, but production `released` status still requires its own phase-level gate.

## Blocking rules

- `blocked` is `true` whenever any listed dependency's `status` is not at least `implemented`, or whenever the feature's `targetPhase` has an unmet phase-level dependency per `docs/platform-phases.md`.
- `blocked` is `false` only when every dependency is at least `implemented` and the feature's own phase is eligible to begin — this does not imply the feature is authorized, only that nothing external is preventing authorization from being requested.
- `blocker` must name the specific unmet dependency or phase gate; a vague blocker description (e.g., "not ready") is not acceptable.

## Evidence rules

- A `planned` or `authorized` feature's `evidence` field must say so plainly (for example: "None — planned only; no runtime implementation exists").
- An `implemented` or later feature's `evidence` field must point to something a reviewer can independently check: a PR number, a commit SHA, a test report, or a deployment record.
- Evidence is never inferred from a roadmap description, a milestone name, or an intention. **Documentation does not count as runtime completion.**

## Privacy-impact classification

- **`none`** — no personal or location data involved (e.g., public editorial content).
- **`low`** — indirect or coarse data (e.g., borough-level notification topic).
- **`medium`** — account-linked data that is not real-time location (e.g., saved events, moderation case records).
- **`high`** — real-time precise location, or private message content (e.g., geofence verification, real-time chat).

## Moderation classification

- **`none`** — the feature has no user-generated content or interaction surface.
- **`required_before_launch`** — the feature is part of, or depends on, real-time chat or community reporting, and per ADR-004 must ship moderation tooling no later than the feature itself, never afterward.

## App-store relevance

Used to flag features that affect App Store / Google Play review: `privacy_disclosure` (introduces a new data collection surface), `in_app_purchase` (any paid product delivered through the store's payment system), `core_functionality` (part of the primary reviewed experience), `content_moderation_policy` (subject to platform UGC moderation requirements), or `none`.

## Revenue relevance

`direct` (the feature is itself a revenue product), `indirect` (the feature supports revenue decision-making, e.g., analytics), or `none`.

## Update procedure

1. Propose the change (new feature, status change, dependency change) with a one-line rationale.
2. Verify the change against the dependency rules and blocking rules above.
3. Update `lastUpdated` on every entry touched.
4. Re-run the JSON and dependency validation described in the platform continuation record before committing.
5. Never change `status` to `released` without attaching evidence in the same edit.

## Definitions — planned vs. authorized vs. implemented vs. verified vs. released vs. deprecated

These six words are not interchangeable and must never be used as synonyms in this registry or in any dashboard copy:

- **Planned** describes an entry that exists on paper.
- **Authorized** describes an entry a human has explicitly approved to start.
- **Implemented** describes an entry with running code, in any non-production environment.
- **Verified** describes an implemented entry that has passed its defined success criteria under independent review.
- **Released** describes a verified entry running in production with immutable evidence.
- **Deprecated** describes an entry intentionally retired after having reached at least `implemented`.

## Commercial integrity rule

**Paid sponsorship cannot affect Bronze, Silver, or Gold significance.** No feature in this registry with `revenueRelevance: direct` may list a significance feature as something it writes to, weights, or otherwise influences. Any proposed feature that would blur this line must be rejected at registry-update time, not caught later in review.
