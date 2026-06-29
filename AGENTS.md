# AGENTS.md - NYCIF Field Desk / Public Map Coding-Agent Rules

This repository powers the NYC In Focus field desk and public map frontend.

These instructions apply to Cursor, GitHub Copilot, Claude Code, Codex, ChatGPT, and any other coding agent or automated assistant working in this repository.

## Related repositories

Primary backend/feed repo:

- `setoxxx/nycif-live-feeds`

Frontend/map repo:

- `setoxxx/nycif-field-desk`

The backend repo is the source of truth for generated event feeds, GPS staging artifacts, manual approval queues, and GPS promotion controls.

The frontend repo should consume feed outputs. It should not silently create, approve, or promote GPS coordinates.

## Prime directive

Do not break the public map.

Do not publish unreviewed GPS or event data.

Do not change frontend behavior in a way that bypasses backend QA, GPS review, or staging safeguards.

## Protected frontend areas

Treat the following as protected. Do not modify them unless explicitly instructed:

- public-map entrypoint files
- scripts that auto-load live/staged feeds
- popup behavior files used by `nycinfocus.com/map/`
- map feed URL constants
- production/public map embed URLs
- GitHub Pages deployment settings
- GitHub Actions secrets or deployment configuration

If a task can be completed in a test/admin-only path instead of changing the public map, prefer the test/admin-only path.

## Backend feed contract

The public map should consume the staged feed only after backend QA has generated it.

Known backend public feed:

- `https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json`

Do not replace this feed source with unvalidated artifacts such as:

- GPS proposal files
- GPS filled-proposal files
- manual approval queues
- manual review sheets
- review findings files

These files are for review and QA only, not public display.

## GPS pipeline boundaries

The frontend must not treat any of these as live/published data:

- `gps_review_geocoding_proposals.json`
- `gps_review_geocoding_filled_proposals.json`
- `gps_manual_approval_queue.json`
- `gps_manual_approval_review_sheet.json`
- `gps_manual_approval_review_findings.json`

Only the backend promotion process may update public-ready GPS data.

Phase 2E promotion is not authorized by default. If a coding agent sees Phase 2E mentioned, it must preserve the approval/validation gate and avoid public-map changes unless the human explicitly instructs promotion/publication.

## Public-map rule

Never publish frontend changes to the production public map unless the human explicitly says to publish or update the public map.

The following are not permission to publish:

- "review"
- "inspect"
- "stage"
- "prepare"
- "test"
- "QA"
- "admin-only"
- "ready"

Publishing requires explicit language such as:

- "publish this public map change"
- "update the production map"
- "change nycinfocus.com/map/"

## Safe frontend work

Allowed by default when requested:

- create admin-only review UI
- add QA/debug panels behind explicit admin/test paths
- improve readability of map popups
- add non-public filters or review views
- document feed contracts
- add tests/checks that prevent bad feed files from being used publicly

Not allowed without explicit approval:

- changing the production feed URL
- changing the WordPress/public iframe URL
- changing GitHub Pages deployment settings
- displaying GPS proposal/review artifacts as public events
- changing event coordinates client-side to override backend QA
- hiding warnings/errors that indicate bad feed data

## Cross-repo coordination

When a frontend change depends on backend data:

1. Confirm the backend artifact exists in `setoxxx/nycif-live-feeds`.
2. Confirm the artifact is intended for frontend consumption.
3. Do not infer that a review artifact is public-ready.
4. Update docs/comments with the backend file name and purpose.
5. Keep public and admin/test paths clearly separated.

## QA requirements

Before claiming success:

- inspect the changed frontend file
- confirm whether the change is public, admin-only, or documentation-only
- verify the production public map feed URL was not changed unless explicitly requested
- verify no GPS review artifact is being loaded as live/public data

If the backend repo is relevant, inspect backend QA reports before making public-map claims.

Backend QA artifacts to know about:

- `data/backend_reliability_gate_report.json`
- `data/row_disposition_report.json`
- `data/gps_manual_approval_validation_report.json`
- `data/gps_manual_approval_review_sheet_report.json`

## Coding-agent workflow

Preferred workflow for Cursor/Copilot/Claude Code/Codex:

1. Read this file before editing.
2. Read the backend repo `AGENTS.md` when changing feed behavior.
3. Make the smallest safe change.
4. Prefer admin/test views over public-map changes.
5. Inspect changed files.
6. State exactly what changed and whether the public map was affected.

## Final response rules

Final responses should state:

- files changed
- whether the production public map changed
- whether the feed URL changed
- whether backend/public GPS data changed
- what QA artifact or frontend file was inspected

Never claim a public-map update unless it was intentionally changed and verified.
