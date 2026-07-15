# NYCIF God View Master Recovery Prompt v1

You are recovering or auditing the NYCIF God View Project Control Center.

## Repository

`setoxxx/nycif-field-desk`

## God View route

`/admin/`

## Canonical recovery manifest

`admin/data/god-view-recovery-manifest-v01.json`

## Canonical project-state file

`admin/data/god-view-project-state-v01.json`

## Immutable pre-God-View baseline

`acb27c958b4aba4b75d229e3170fe7ff256e7b53`

## Original implementation

- PR: `#122`
- Branch: `feat/god-view-project-control-center-v01`

## Recovery rules

1. Inspect current GitHub repository and pull-request state first.
2. Do not trust conversation memory over repository evidence.
3. Read the recovery manifest before editing.
4. Read the project-state JSON before changing roadmap status.
5. Read the feed registry before changing any feed URL.
6. Read the candidate-source registry before describing connector status.
7. Do not fetch agency endpoints from God View.
8. Do not create or activate Newsroom Engine artifacts during recovery.
9. Do not modify the public map, calendar functionality, service worker, backend, workflows, WordPress, Pin Integrity, or `location_cache.json`.
10. Never force-push shared `main`.
11. Never overwrite unrelated work.
12. Prefer restoring one broken file over reverting unrelated project changes.
13. When PR #122 is unmerged, the safest full rollback is to close it or restore branch files from the immutable baseline.
14. When the work was merged, identify the exact merge commit and create a normal revert commit.
15. When only project status is stale, update only the project-state data after verifying current GitHub evidence.
16. Stop and report ambiguity rather than inventing repository state.

## Source-of-truth order

1. Current GitHub repository and PR metadata.
2. `admin/data/god-view-project-state-v01.json`.
3. `shared/nycif-feed-registry-v01.js`.
4. `shared/nycif-candidate-source-evaluation-v01.js`.
5. Backend-generated artifacts in `nycif-live-feeds`.
6. Long-term roadmap and historical documentation.

## Recovery verification

After recovery, verify:

- `/admin/` renders.
- The current objective appears.
- The current and next gates load.
- The recovery panel identifies the immutable baseline.
- Source Lineage renders.
- Candidate Source Evaluation renders.
- Candidate feeds connected remains zero unless separately authorized.
- Assignment Desk Calendar remains functional.
- Public map remains unchanged.
- No agency endpoint is requested.
- No nonexistent Newsroom Engine artifact is requested.
- No relevant browser console errors appear.
- Desktop and mobile layouts remain usable.
- The recovery manifest still points to the immutable baseline.

## Required report

Return:

- Repository SHAs checked.
- Files restored or changed.
- Tests run.
- Browser checks.
- Remaining uncertainty.
- Confirmation that no protected surface changed.

Do not automatically begin another milestone after recovery.
