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

## Validation is an exact contract
`validateProgram()` pins the owner-accepted SHADOW-1 record in
`CANONICAL_PROGRAM` and matches the fetched payload against it **value by
value**: the six scalar facts, all six gate states, all five test totals, all
eight fixture counts, both parked minors *in order*, all seven authority flags,
and `next_phase.name` / `status` / `purpose`. Unknown keys inside a pinned block
are rejected; unknown top-level keys are ignored because nothing outside the
pinned set is read or rendered.

This closes a real gap: the earlier implementation validated only shape,
allowed-state membership, and arithmetic reconciliation, so a payload that was
merely *internally consistent* — swapped gate→state mapping, all four suite
totals changed but re-summing to 329, inflated fixture counts that still
reconcile, `duplicate_groups` altered, an emptied parked-minors list, a changed
`next_phase.name` — would have rendered as if approved. Arithmetic and
allowed-state checks are retained on top of the exact match as defence in depth,
not as the acceptance criterion.

Any future change to the approved facts is a deliberate contract change
requiring owner authorization, and must be made in lockstep with
`build_enigma_shadow_program()` in nycif-live-feeds
`scripts/generate_godview_project_state.py`.

## Safety
- Read-only. No publish / promote / approve / dedupe / mutation / deployment /
  write controls.
- Safe DOM only (`createElement` / `textContent` / `createTextNode`); no
  `innerHTML` / `insertAdjacentHTML` for data.
- Fails closed on any payload that is not exactly the approved record, and on
  malformed state (including any unsafe authority flag, a non-locked next phase,
  non-reconciling counts, or non-zero silent loss); a panel-local failure is
  caught so it cannot break sibling GodView panels.
- Renders no private links or commit SHAs.
- Responsive to 320 CSS px; reuses the dashboard palette utility classes.

## Network
No unexpected network requests. The panel performs **one expected read-only
cross-origin GET** to `raw.githubusercontent.com` for the canonical public
project-state artifact — the same established pattern
`god-view-project-control-v01.js` already uses from GitHub Pages. No writes, no
credentials, no third-party hosts.

## Deployment boundary
`setoxxx/nycif-field-desk` deploys the **entire tree to GitHub Pages on merge to
`main`** (`.github/workflows/static.yml`). Therefore the field-desk merge and the
public GodView deployment are one combined action. Do not merge without explicit
Howard Weiss authorization, and merge the live-feeds closeout PR first.

## Tests
`admin/tests/test_enigma_shadow_status_v02.py` — **36 tests, 36 passed**:
static safety (no unsafe DOM APIs, v02-not-v01 references, v01 retained, stale
CORE-2.1 wording removed, authority banner strings, no private
links/SHAs/paths/credentials); a Node `validateProgram()` fail-closed matrix
(wrong program id, missing/unsupported gate, bad totals sum, fixture
non-reconciliation, non-zero silent loss, unsafe authority flags, unlocked next
phase, started comparison/promotion); and an exact-approved-fact mutation matrix
in which **every** case is internally consistent and must still be rejected
(changed status, changed owner decision, each gate swapped to another supported
state, a fully swapped gate mapping, totals changed while still summing, fixture
counts changed while still reconciling, parked minors emptied / reordered /
reworded / extended, changed `next_phase.name` and `purpose`, every authority
value flipped or type-substituted).

`admin/tests/test_enigma_shadow_status.py` (v01 safety suite) — **28 tests, 28
passed**, after adding exactly the four v02 paths to its `AUTHORIZED`
changed-file allow-list. Before that fix the v01 suite failed 1 of 28 on this
branch; an earlier claim in this note and in the PR body that it "remains green"
was inaccurate and has been corrected.

Combined: `python3 -B -m unittest discover -s admin/tests -t admin/tests -p
'test*.py'` — **64 tests, 64 passed**. `node --check
admin/enigma-shadow-status-v02.js` — PASS. (The `-t .` form documented in the
suite docstrings fails on Python 3.12+ with "Start directory is not importable"
because `admin/tests/` has no `__init__.py`; that is pre-existing and unrelated
to this change.)
