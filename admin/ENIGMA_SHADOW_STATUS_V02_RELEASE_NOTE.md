# Enigma Shadow Program Status panel — v02 release note

## What changed
The GodView admin "Enigma V2 Shadow Status" panel is replaced by a **program
status** panel (v02) that reflects the completed, owner-accepted Enigma
**SHADOW-1** program. `admin/index.html` now references
`enigma-shadow-status-v02.css` / `.js` instead of the v01 files. The v01 files
remain in the repository, **unreferenced**, as historical rollback evidence.

## Why
The v01 panel rendered a committed CORE-2.1 MOCK fixture and described lane
projections, duplicate policy, multi-day handling, normalization, and schema
enforcement as *deferred*, with V1/V2 comparison "not implemented." That is now
materially stale: SHADOW-1 Gates A–F are complete and owner-accepted for
private, synthetic-fixture, shadow-only use.

## What v02 shows
- **Authority banner:** SHADOW-ONLY · SYNTHETIC FIXTURE ONLY · NOT PRODUCTION
  AUTHORITY · REAL FEED NOT AUTHORIZED · V1 REMAINS THE SOLE PRODUCTION AND
  PUBLISHING AUTHORITY.
- **Program mode** distinguishing: synthetic validation **complete**, real-data
  comparison **not started**, production promotion **not authorized**.
- **Gate tree A–F** with exact final states (A–D complete, E accepted with
  parked minors, F owner accepted).
- **Verified test totals:** 16 / 127 / 125 / 61 / **329**.
- **Synthetic fixture outcomes:** 12 requested, 9 accepted rows, 7 distinct
  occurrences, 4 NYC pins, 0 outside viewport, 3 unpinnable, 2 duplicate groups,
  0 silent loss.
- **Parked maintenance (non-blocking):** generic JSON error wording; borough
  label contrast.
- **Next phase:** SHADOW-2 Gate A — **NOT AUTHORIZED**; real-data comparison not
  started; separate explicit owner authorization required.

## Data source
The panel reads the public-safe `enigma_shadow_program` block from the canonical
GodView project-state artifact
(`status/nycif-godview-project-state-v02.json` on `setoxxx/nycif-live-feeds`) —
the same artifact the Project Control Center already consumes. It does not copy
any private national-pilot file into field-desk. Requires the live-feeds
closeout PR to be merged first so the block is present; until then the panel
shows a safe "not present" fail-closed notice.

## Safety
- Read-only. No publish / promote / approve / dedupe / mutation / deployment /
  write controls.
- Safe DOM only (`createElement` / `textContent` / `createTextNode`); no
  `innerHTML` / `insertAdjacentHTML` for data.
- Fails closed on malformed or unsupported state (including any unsafe authority
  flag, a non-locked next phase, non-reconciling counts, or non-zero silent
  loss); a panel-local failure is caught so it cannot break sibling GodView
  panels.
- Renders no private links or commit SHAs.
- Responsive to 320 CSS px; reuses the dashboard palette utility classes.

## Deployment boundary
`setoxxx/nycif-field-desk` deploys the **entire tree to GitHub Pages on merge to
`main`** (`.github/workflows/static.yml`). Therefore the field-desk merge and the
public GodView deployment are one combined action. Do not merge without explicit
Howard Weiss authorization, and merge the live-feeds closeout PR first.

## Tests
`admin/tests/test_enigma_shadow_status_v02.py` — static safety (no unsafe DOM
APIs, v02-not-v01 references, v01 retained, stale CORE-2.1 wording removed,
authority banner strings, no private links/SHAs/paths/credentials) plus a Node
`validateProgram()` fail-closed matrix (wrong program id, missing/unsupported
gate, bad totals sum, fixture non-reconciliation, non-zero silent loss, unsafe
authority flags, unlocked next phase, started comparison/promotion). The v01
test suite remains green.
