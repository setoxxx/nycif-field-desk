# XRI-G7 — Candidate Review Rules + Operator Decision Model

## 1. Purpose

XRI-G7 defines the human/operator review rules for NYCIF Master Location Registry candidates. It is a contract for how candidate records are reviewed, held, rejected, excluded, and prepared for future seed eligibility.

This phase does not implement runtime tooling. It does not create registry rows, public map rows, production feed rows, geocode approvals, or automated promotion logic.

The purpose of G7 is to make the review decision model explicit before any future schema, validator, user interface, registry importer, or production pipeline is built.

## 2. Inputs

G7 uses the XRI-G6 preview artifact as its conceptual input:

- `seed_ready_preview`
- `needs_review_preview`
- `conflict_hold_preview`
- `rejected_or_excluded_preview`

The G6 preview artifact remains preview-only. G7 does not mutate the G6 artifact and does not convert any preview record into a production record.

## 3. Non-production guarantee

G7 is a non-production contract phase.

G7 does not create or authorize:

- production registry rows
- public map rows
- production feed rows
- staged feed rows
- location cache writes
- geocode approvals
- WordPress output
- runtime registry wiring
- automated candidate promotion

Any candidate that reaches a seed-eligible review state under this contract remains non-production until a later Howard-authorized final gate explicitly permits production seeding.

## 4. Review states

The following future review states are allowed for candidate review artifacts or review tooling. These are decision-state labels only; they do not publish or promote anything.

### `pending_review`

The candidate has entered operator review and has not received a decision.

### `needs_more_evidence`

The candidate may be useful, but required evidence is incomplete or contradictory.

### `conflict_hold`

The candidate has a material conflict that blocks seed eligibility until resolved.

### `duplicate_hold`

The candidate appears to duplicate another candidate or known registry/location entity.

### `borough_mismatch_hold`

The candidate contains inconsistent borough evidence or mismatched borough/location signals.

### `coordinate_conflict_hold`

The candidate has conflicting coordinate evidence, uncertain coordinate provenance, or a coordinate/location mismatch.

### `rejected`

The candidate is determined not suitable for seed eligibility because it fails review criteria.

### `excluded`

The candidate is intentionally out of registry scope even if the source record itself is valid.

### `seed_eligible_pending_final_gate`

The candidate has passed operator review for possible future seeding, but remains non-production. This state is not an approval for production registry insertion, public map use, feed publication, or geocode acceptance.

## 5. Operator actions

The following future operator actions are allowed. These actions change review state only in a future review artifact or review tool. They do not write production outputs.

### `mark_needs_more_evidence`

Move a candidate to `needs_more_evidence` when required evidence is incomplete.

### `mark_duplicate_hold`

Move a candidate to `duplicate_hold` when it may duplicate another candidate or known location.

### `mark_conflict_hold`

Move a candidate to `conflict_hold` when material conflict exists but is not specifically a duplicate, borough mismatch, or coordinate conflict.

### `mark_borough_mismatch_hold`

Move a candidate to `borough_mismatch_hold` when borough evidence conflicts or cannot be reconciled.

### `mark_coordinate_conflict_hold`

Move a candidate to `coordinate_conflict_hold` when coordinate evidence is inconsistent, unsupported, or mismatched to the normalized location.

### `mark_rejected`

Move a candidate to `rejected` when it fails seed eligibility criteria.

### `mark_excluded`

Move a candidate to `excluded` when it is valid source data but outside registry scope.

### `mark_seed_eligible_pending_final_gate`

Move a candidate to `seed_eligible_pending_final_gate` only after all required evidence is present, no hard block remains, and the operator has provided an audit trail.

## 6. Forbidden actions

The following actions are explicitly forbidden in G7 and any direct descendant work unless a later Howard-authorized phase allows them:

- `approve_for_production`
- `publish_to_public_map`
- `write_to_location_cache`
- `write_to_staged_feed`
- `write_to_production_feed`
- `approve_geocode`
- `bypass_review`
- `auto_promote`

A review state must never be interpreted as production permission.

## 7. Required evidence model

A candidate cannot become `seed_eligible_pending_final_gate` unless the following evidence is present and documented.

### Source record identity

The source record must have stable identity fields sufficient to trace it back to the originating record.

Examples include:

- source dataset ID
- source record ID
- event ID
- correction ID
- fixture ID
- source artifact row ID

### Source path / provenance

The candidate must identify where the evidence came from, such as a source artifact path, report path, fixture path, or documented source reference.

### Normalized name

The candidate must have a normalized display/location name that is clear enough for operator review.

### Borough confidence

The candidate must include borough evidence and a confidence determination. Missing or conflicting borough evidence blocks seed eligibility.

### Address/location confidence

The candidate must include an address, venue name, park area, intersection, route, or other location evidence with enough specificity to support future registry use.

### Coordinate provenance, if any

If coordinates exist in a candidate, their origin must be clear. Coordinates without provenance are not enough for seed eligibility.

### Duplicate check

The candidate must be checked against known duplicates, related records, or other candidates.

### Conflict check

The candidate must be checked for coordinate conflicts, borough conflicts, name conflicts, source conflicts, and public-map safety conflicts.

### Operator note

An operator note is required before a candidate can be marked `seed_eligible_pending_final_gate`. The note must explain why the candidate can proceed to the final gate.

## 8. Hard block rules

The following conditions must remain blocked. A candidate with any hard block cannot become seed eligible.

### Coordinate conflict

Any coordinate conflict, unsupported coordinate, or coordinate/location mismatch requires `coordinate_conflict_hold`.

### Duplicate conflict

Any unresolved duplicate requires `duplicate_hold`.

### Borough mismatch

Any unresolved borough mismatch requires `borough_mismatch_hold`.

### Missing source identity

A candidate without stable source identity cannot be seed eligible.

### Missing provenance

A candidate without source path or provenance cannot be seed eligible.

### Rejected/excluded source

A candidate from a rejected or excluded source category cannot be seed eligible unless a later phase explicitly defines a reversal workflow.

### Unclear location text

A candidate with unclear, generic, or insufficient location text must remain in `needs_more_evidence`, `conflict_hold`, `rejected`, or `excluded`.

### Public-map flag true before final gate

Any candidate with `public_map_allowed: true` before a future final production gate is invalid and must be blocked.

## 9. Soft warning rules

Soft warnings require operator review but are not automatic rejection rules.

Examples:

- weak name normalization
- low-confidence borough
- incomplete address
- non-unique venue name
- stale source
- multi-segment route
- neighborhood-only location

A candidate with a soft warning may advance only if the operator documents why the warning does not prevent seed eligibility.

## 10. Duplicate adjudication

Duplicate adjudication compares candidate records against each other and against known registry/location evidence.

Operators should compare:

- normalized name
- aliases or alternate names
- borough
- address/location text
- coordinate evidence
- source record identity
- source path/provenance
- event/correction context

If two candidates appear to describe the same real-world location, both should be held until one of the following is true:

- one candidate is selected as the stronger seed candidate
- the candidates are documented as distinct locations
- both candidates are rejected or excluded
- the duplicate relationship is reserved for future reconciliation

No duplicate candidate may be auto-promoted.

## 11. Borough mismatch handling

Borough mismatch is a hard block. A candidate must be placed in `borough_mismatch_hold` when borough evidence conflicts with:

- source borough field
- normalized address/location text
- coordinate borough inference
- correction artifact borough
- known venue or park borough
- operator evidence

A borough mismatch can only be resolved when the operator documents the stronger evidence and the reason the mismatch is no longer blocking.

## 12. Coordinate conflict handling

Coordinate conflict is a hard block. A candidate must be placed in `coordinate_conflict_hold` when:

- coordinates point to a different borough than the candidate borough
- coordinates are materially distant from the named location
- multiple sources provide conflicting coordinates
- coordinate provenance is missing
- coordinates appear copied, guessed, or defaulted
- location text describes a route or multi-segment area rather than a point

Coordinate conflict handling does not approve, correct, or write coordinates. It only records the hold state and the evidence needed for later review.

## 13. Rejection and exclusion model

### Rejected

Use `rejected` when a candidate fails registry seed criteria.

Examples:

- invalid or unusable source record
- impossible location evidence
- unsupported candidate identity
- unresolvable conflict
- insufficient evidence after review

### Excluded

Use `excluded` when a candidate is valid data but out of registry scope.

Examples:

- temporary route-only item not appropriate for registry seeding
- event-only record with no durable location entity
- source category intentionally excluded from registry seed
- duplicate source not selected for seed preparation

Rejected and excluded candidates are not seed eligible.

## 14. Audit trail requirements

Every future operator review action must preserve an audit trail.

Required audit fields:

- `reviewed_by`
- `reviewed_at`
- `review_action`
- `review_reason`
- `evidence_summary`
- `source_refs`
- `previous_state`
- `next_state`

The audit trail must be append-only in future implementations unless a later contract explicitly defines correction semantics.

## 15. Final gate model

`seed_eligible_pending_final_gate` is the highest state allowed by this contract.

This state means:

- evidence is sufficient for future final-gate review
- no current hard block remains
- soft warnings are documented
- duplicate checks are documented
- conflict checks are documented
- operator note exists

This state does not mean:

- production registry approval
- public map approval
- geocode approval
- feed approval
- location cache approval
- WordPress approval
- automated promotion approval

A future Howard-authorized phase must define and approve any final production seeding gate.

## 16. Relationship to G6

G7 builds on the G6 preview artifact by defining the operator decision model for the preview groups.

G7 does not mutate:

- `data/previews/registry_candidate_preview.sample.json`
- `data/reports/registry_candidate_preview_report.json`

G6 remains a preview-only artifact. G7 defines how similar candidates may be reviewed in future artifacts or tools.

## 17. Relationship to future G8

G8 is reserved for implementation planning around review artifact schema and fixture validation.

Likely next phase:

**XRI-G8 — Review Artifact Schema + Fixture Validator**

G7 does not start G8 and does not create the G8 schema or validator.

## 18. Safety checklist

G7 confirms:

- no live staging executed
- no WordPress touched
- no production feed touched
- no public map runtime touched
- no external APIs or SODA endpoints called
- no `location_cache.json` modified
- no geocodes approved
- no candidates promoted
- no runtime wiring added
- no registry importer created
- no registry database created
- no public GPS data changed
- no write/publish/deploy/approval controls added

## 19. Acceptance criteria

G7 passes when:

- this contract exists in `docs/candidate-review-rules-operator-decision-model.md`
- review states are defined
- operator actions are defined
- forbidden actions are defined
- required evidence model is defined
- hard block rules are defined
- soft warning rules are defined
- duplicate adjudication is defined
- borough mismatch handling is defined
- coordinate conflict handling is defined
- rejection and exclusion model is defined
- audit trail requirements are defined
- final gate model is defined
- G6 relationship is documented
- G8 relationship is reserved
- safety checklist is explicit
- `data/reports/xri_project_status.json` reflects G7 as the current contract phase
- no runtime, production, public map, WordPress, cache, workflow, or feed files are changed

## 20. Next phase

The likely next phase is:

**XRI-G8 — Review Artifact Schema + Fixture Validator**

G8 is not started by G7. G8 is not authorized by G7.
