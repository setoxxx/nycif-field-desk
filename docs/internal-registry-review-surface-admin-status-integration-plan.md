# XRI-G11 — Internal Registry Review Surface / Admin Status Integration Plan

## 1. Executive summary

XRI-G11 is a planning-only phase for the NYCIF XRI Master Location Registry project.

The phase defines how the offline XRI registry seed artifact and read-only lookup prototype can be surfaced for internal operator review in a future admin/status context without changing production map behavior.

This phase does not implement the review surface. It creates the integration plan, safety gates, review states, and acceptance criteria for a later implementation phase.

## 2. Project completion

- Completion before G11: 94%
- Expected completion after clean G11 merge: 100%

## 3. Relationship to previous phases

- XRI-G8 created the review artifact schema and fixture validator.
- XRI-G9 created the offline registry seed sample artifact.
- XRI-G10 created the offline read-only registry lookup prototype.
- XRI-G11 plans how those offline artifacts may be surfaced internally for review.

## 4. G11 scope

G11 is allowed to define:

- the internal review-surface information architecture
- admin/status display requirements
- review state labels
- safety guardrails for internal visibility
- future implementation acceptance criteria
- non-production fixture/report expectations
- the boundary between internal review and public map behavior

G11 is not allowed to implement runtime behavior.

## 5. Proposed internal review surface

A future review surface may display registry-review information in an admin-only context with these sections:

1. Registry seed status
2. Lookup prototype summary
3. Review artifact validity summary
4. Seed candidate table
5. Blocked/excluded review records
6. Manual-review queue summary
7. Safety and runtime-isolation banner

The surface should be explicitly labeled as internal, static, read-only, and non-production.

## 6. Display-only fields

Future admin/status display may show:

- registry record id
- canonical display name
- normalized lookup key
- borough
- location kind
- source artifact path
- review decision
- review confidence
- exclusion reason
- lookup outcome
- fixture validation status
- seed validation status

The display must not show controls that approve, promote, geocode, publish, or mutate records.

## 7. Review states

Recommended internal review states:

- `seed_ready`
- `needs_manual_review`
- `excluded_by_review`
- `blocked_low_confidence`
- `duplicate_candidate`
- `lookup_only_match`
- `not_for_public_runtime`

These are review/display labels only. They do not create production approvals.

## 8. Safety gates before any future implementation

A future implementation phase must prove:

- the surface is read-only
- the source data is static/offline
- no public map runtime file is changed
- no production feed JSON is read or written
- `data/location_cache.json` is not modified
- no external API or SODA call is made
- no WordPress file or endpoint is touched
- no candidate is promoted
- no geocode is approved
- no deployment/publish control is added
- no runtime registry lookup is wired into the public app

## 9. Acceptance criteria for a future implementation phase

A future implementation may be accepted only if:

1. It modifies admin/status display files only.
2. It reads only static repo-local reports or fixture artifacts.
3. It displays seed/review/lookup information without mutation controls.
4. It includes visible warnings that the registry is not production authority.
5. It passes a local static-page browser check.
6. It includes a clear rollback path.
7. It leaves public map runtime and feed behavior unchanged.

## 10. Files intentionally not changed by G11

G11 does not modify:

- `admin/index.html`
- public map runtime files
- production feed JSON
- `data/nycif_staged_live_events.json`
- `data/location_cache.json`
- WordPress files or settings
- scheduled workflows
- service worker behavior
- deployment settings

## 11. Output of this phase

G11 outputs:

- this planning contract
- a report artifact summarizing the plan and gates
- an updated XRI project status file

## 12. Next instruction after G11

After XRI-G11 is merged, ChatGPT should not start a new phase automatically.

The recommended next phase is:

**XRI-G12 — Admin Review Surface Static Prototype**

XRI-G12 is not authorized by this PR and requires explicit Howard approval.
