# NYCIF Live Feeds Master Completion Roadmap

## Document identity

- Document version: `nycif-live-feeds-master-roadmap-v1`
- Verified date: `2026-07-11`
- Roadmap track: `nycif_live_feeds_project_completion_track`
- Current planning phase: `XRI-G102`

## Source-of-truth policy

Repository evidence controls over chat memory. A phase number alone is not sufficient historical identity; the exact title, pull request number, and immutable commit SHA control.

## Repository baselines

- Field Desk baseline: `5f9e6b85f62810b8d4d37d95934d0e6573039a01`
- Operational baseline: `5a53177047590e4f3cdbbe92ab19388c3571c20f`

## Completion model

- Control framework: **90%**
- Operational system: **41%**
- Overall combined: **56%**

Documentation, contracts, schemas, reports, and planning artifacts cannot be counted as runtime execution. Historical execution cannot be counted as proof on the current baseline.

## Current checkpoint

XRI-G102 Checkpoint 2 is complete, and Canonical Milestone 1 is complete. PR #97 merged at `5f9e6b85f62810b8d4d37d95934d0e6573039a01`. Canonical Milestone 2 has not started and requires separate authorization.

## Canonical milestones

### 1. Canonical roadmap and status baseline

- Status: `complete`
- Completion: **100%**
- Objective: Create one authoritative completion model separating governance, implementation existence, current-baseline verification, historical execution, and production operation.
- Exit criteria:
  - XRI-G102 roadmap Markdown and JSON are approved and merged
  - Percent methodology and definition of done are locked
  - God View points to the approved roadmap without modifying the public status artifact
- Recommended next safe gate: separately authorized read-only current-main executable inventory gate
- Immutable completion evidence:
  - PR #96 merge commit: `a832eb12376c21d22501ff7ca0c18f3ccce5eedd`
  - PR #97 head SHA: `8a9dc283fd34394c6f64e00c4cfa0f4c764dbceb`
  - PR #97 merge commit: `5f9e6b85f62810b8d4d37d95934d0e6573039a01`
  - PR #97 merge timestamp: `2026-07-11T01:26:20Z`

### 2. Current-main executable inventory

- Status: `partially_complete`
- Completion: **30%**
- Objective: Classify every executable, workflow, dependency, input, output, network call, and write target on the current main SHA.
- Exit criteria:
  - No unclassified executable or workflow remains
  - Superseded and active paths are distinguished
  - Inventory is tied to an immutable main SHA
- Recommended next safe gate: read-only executable inventory gate

### 3. Fixture-only end-to-end validation

- Status: `not_verified_on_current_baseline`
- Completion: **30%**
- Objective: Prove the fixture pipeline passes deterministically on the then-current main baseline.
- Exit criteria:
  - Positive and failure-case tests pass
  - Stable identity and review-rank prohibitions are enforced
  - Commands, dependencies, stdout, stderr, exit code, and hashes are recorded
  - No live source or forbidden write occurs
- Recommended next safe gate: isolated fixture execution and result-capture gate

### 4. Read-only live-source adapter

- Status: `partially_complete`
- Completion: **50%**
- Objective: Verify at least one allowlisted live source in read-only mode with strict limits and schema-drift handling.
- Exit criteria:
  - One allowlisted adapter passes current-baseline verification
  - Pagination, timeout, size limits, retry, and schema checks are evidenced
  - No geocoding, staging, production, registry, WordPress, or cache write occurs
- Recommended next safe gate: source-specific read-only adapter verification gate

### 5. Controlled non-production dry run

- Status: `not_verified_on_current_baseline`
- Completion: **35%**
- Objective: Run the isolated source-to-review-package path on current main without production authority.
- Exit criteria:
  - Source, normalization, candidate identity, deduplication, validation, and audit outputs pass
  - Artifacts are isolated and reproducible
  - Zero production, public-map, WordPress, workflow, registry, or unauthorized cache writes
- Recommended next safe gate: controlled dry-run authorization and result-review sequence

### 6. Human review and disposition

- Status: `partially_complete`
- Completion: **30%**
- Objective: Generate an actual review package, select by stable identity, and record a controlled non-authoritative disposition and decision trace.
- Exit criteria:
  - Actual input package exists
  - Actual stable candidate-selection record exists
  - Structural validation and disposition are reproducible
  - No automatic approval, promotion, staging, publishing, or production authority is inferred
- Recommended next safe gate: input-package, candidate-selection, validation, and disposition execution gates

### 7. Isolated staging

- Status: `partially_complete`
- Completion: **45%**
- Objective: Build a production-shaped staging feed from disposition-approved records only.
- Exit criteria:
  - Staging manifest records lineage, inclusions, exclusions, deduplication, counts, and hashes
  - Production comparison is deterministic
  - Existing production remains untouched
- Recommended next safe gate: staging creation and diff-validation gate

### 8. Production canary

- Status: `partially_complete`
- Completion: **40%**
- Objective: Publish a minimal explicitly approved canary with verified backup, public-feed checks, map checks, and rollback.
- Exit criteria:
  - Pre-canary snapshot integrity verified
  - Minimal merge-not-replace publish succeeds
  - Raw feeds and public map are independently verified
  - Rollback restoration is demonstrated or independently validated
- Recommended next safe gate: production-canary authorization, verification, and rollback gate

### 9. Scheduled operations and monitoring

- Status: `partially_complete`
- Completion: **40%**
- Objective: Operate repeated refresh and QA runs with explicit authorization, freshness monitoring, alerts, and no automatic production promotion.
- Exit criteria:
  - Schedule is separately authorized
  - Freshness, source drift, anomalies, and failures alert correctly
  - Run history and ownership are recorded
  - Workflow cannot directly push or promote by default
- Recommended next safe gate: scheduled workflow and operational-readiness gate

### 10. Final project closeout

- Status: `not_started`
- Completion: **10%**
- Objective: Audit all definition-of-done requirements and establish durable operational ownership.
- Exit criteria:
  - Operating and maintenance runbooks complete
  - Public status artifact current
  - Zero unresolved critical blockers
  - Zero unintended open pull requests or issues
  - All completion claims trace to immutable evidence
- Recommended next safe gate: final evidence audit and closeout gate

## Definition of done

- Current-main executable inventory complete
- Fixture-only end-to-end validation passes on current main
- At least one allowlisted live source is integrated read-only
- Controlled non-production dry run passes
- Deterministic identity and deduplication are enforced
- Actual review package and controlled disposition are recorded
- Isolated staging succeeds
- Rollback snapshot and restoration are verified
- Limited production canary and public-feed verification succeed
- Scheduled workflow is explicitly authorized
- Freshness monitoring and failure alerts are active
- Operating and maintenance ownership are recorded
- Public status artifact is current
- Zero unresolved critical blockers and unintended open PRs/issues

## Historical XRI-G30–XRI-G40 correction

The recovered planning titles are retained as historical intent, but they do not replace actual merged repository history. Exact merged titles, PR numbers, and immutable merge SHAs remain authoritative.

| Phase | Recovered planning title | Actual merged title | PR | Merge SHA | Relationship |
|---|---|---|---:|---|---|
| XRI-G30 | merge validation-summary gate | XRI-G30 non-production manual review export validation summary gate | #40 | `5612fc8969b8db48a3b74f41bd17a099fde3abf9` | closely aligned |
| XRI-G31 | non-production manual review export readiness checkpoint gate | XRI-G31 non-production manual review export readiness checkpoint gate | #41 | `0511419a0c0120677dfcf192e5d0a54ac4b7b3d2` | aligned |
| XRI-G32 | production-readiness boundary contract | XRI-G32 production-boundary design gate | #42 | `ce4bf0e8a8054a4a828ba5eedd9dac9ec077a641` | conceptually aligned; actual title controls |
| XRI-G33 | candidate event registry schema gate | XRI-G33 candidate event registry schema gate | #43 | `b589a59ace787e897fe8726284dd2439780fcf57` | aligned |
| XRI-G34 | source ingestion contract for today/weekend events | XRI-G34 source ingestion contract for today/weekend events gate | #44 | `7f56aae80be31429103bc5c3ea78d4e08dbc12ea` | aligned |
| XRI-G35 | manual review approval queue gate | XRI-G35 non-production source ingestion sample contract gate | #45 | `fd16bff1fd58bdaedb6099bb548f546982a0dde0` | diverged; recovered plan was not the merged phase |
| XRI-G36 | production export feed dry-run gate | XRI-G36 non-production source ingestion sample validation gate | #46 | `022afcd1f0120da82c608873d9dfd23b9c59d6fe` | diverged; recovered plan was not the merged phase |
| XRI-G37 | public map feed integration gate | XRI-G37 non-production source ingestion validation summary gate | #47 | `111c8bb3f81b3b67c3b56888184161a641db9805` | diverged; recovered plan was not the merged phase |
| XRI-G38 | scheduled refresh / publish workflow gate | XRI-G38 source ingestion readiness checkpoint gate | #48 | `6e8a31a784b97d2fe61878730b80bb1db03651b2` | diverged; recovered plan was not the merged phase |
| XRI-G39 | live-map QA and rollback gate | XRI-G39 controlled implementation planning gate | #49 | `e2a82f8a80136a650de227ae6057b280c7d4e9ea` | diverged; recovered plan was not the merged phase |
| XRI-G40 | first controlled production map publish | XRI-G40 fixture-only scaffold gate | #50 | `f8cb2f6d00b7dbb24827e096c5e03644ccdad93f` | diverged; recovered plan was not the merged phase |

## Non-negotiable rules

- No direct-to-main changes.
- No automatic merge or continuation.
- No future XRI phase number without separate authorization.
- No runtime completion claim from documentation alone.
- This roadmap grants no production, publishing, WordPress, geocoding, workflow, cache, staging, map, or deployment authority.

## Update procedure

- Update the roadmap JSON and XRI status snapshot together after an approved milestone.
- Every update must cite immutable repository evidence.
- Do not change roadmap percentages without evidence satisfying the approved completion method.

## Permanent references

- [Recovery procedure](./live-feeds-master-roadmap-recovery-prompt.md)
- [Machine-readable roadmap](../admin/data/live-feeds-master-roadmap.json)
- [Read-only roadmap display](../admin/live-feeds-roadmap.html)

## Mandatory stop rule

This document grants no authority to execute, merge, publish, deploy, assign a future XRI phase, or continue work automatically. Stop unless Howard Weiss’s current instruction explicitly authorizes the next action.
