# NYCIF God View Master Source of Truth v1

## Purpose

God View is the read-only project control center for NYC In Focus. It explains where the project is now, which engineering gate is active, what is completed, what is held for later, and which files are authoritative.

The current operating objective remains: **Finish and freeze Map v1 before beginning Phase 2 expansion.**

God View does not ingest agency data, geocode events, calculate Pin Integrity, publish WordPress content, modify feeds, or change the public map or Assignment Desk Calendar.

## Source-of-truth order

When sources disagree, use this order:

1. Current GitHub repository, branch, commit, pull-request, and deployment metadata.
2. `admin/data/god-view-project-state-v01.json` for the current stage, gates, decisions, workstreams, risks, and bookmarks.
3. `shared/nycif-feed-registry-v01.js` for runtime, fallback, diagnostic, interface, and lineage paths.
4. `shared/nycif-candidate-source-evaluation-v01.js` for candidate connector decisions.
5. Generated artifacts in `setoxxx/nycif-live-feeds` for counts, freshness, Pin Integrity, and event data.
6. Platform roadmap and historical documentation for long-term direction and prior milestones.

Conversation memory and old summaries never override current repository evidence.

## Immutable recovery anchor

The pre-God-View baseline is:

`acb27c958b4aba4b75d229e3170fe7ff256e7b53`

This commit is the Field Desk `main` state immediately before the God View Project Control Center branch was created. It is an immutable historical anchor and must not be replaced with a moving branch reference.

Original implementation:

- Pull request: `#122`
- Branch: `feat/god-view-project-control-center-v01`
- Repository: `setoxxx/nycif-field-desk`

Current verified branch metadata is recorded in `admin/data/god-view-recovery-manifest-v01.json`.

## Canonical God View files

- `admin/index.html` — page shell, navigation, visual sections, and static architecture diagram.
- `admin/god-view-project-control-v01.js` — project-state renderer.
- `admin/god-view-recovery-v01.js` — recovery-manifest renderer and failure handling.
- `admin/data/god-view-project-state-v01.json` — current operational project status.
- `admin/data/god-view-recovery-manifest-v01.json` — immutable baseline and recovery metadata.
- `admin/live-pipeline-panel-v01.js` — current source registry, lineage, candidate evaluation, and live pipeline display.
- `admin/legacy-admin-data-v01.js` — historical/local diagnostic panels.
- `shared/nycif-feed-registry-v01.js` — canonical feed paths and source lineage.
- `shared/nycif-candidate-source-evaluation-v01.js` — canonical candidate-source decisions.
- `docs/god-view-master-recovery-prompt-v01.md` — reusable recovery instructions.

## Protected systems

Repairing or refreshing God View must not change:

- Public-map runtime or category logic.
- Assignment Desk Calendar functionality.
- Service worker.
- Backend feeds or generation scripts.
- Pin Integrity.
- GitHub Actions workflows.
- WordPress.
- `location_cache.json`.
- MOME, DOB, Parks, or Newsroom Engine ingestion.

## Recovery procedures

### PR #122 is still unmerged

The safest full rollback is to close the PR. `main` remains unaffected. A branch-only file can also be restored from the immutable baseline or another verified good commit.

### God View was merged and later breaks

Identify the exact merge commit and create a normal revert commit. Do not force-push shared `main` and do not overwrite unrelated work.

### One file is broken

Restore only that file from the most recent verified good commit. Re-run the God View tests and browser checks.

### Project status is stale but the page works

Verify current GitHub and backend evidence, then update only `admin/data/god-view-project-state-v01.json`. Do not change feed routing or runtime code merely to refresh status text.

### Recovery manifest is stale

Re-verify the repository, PR, SHAs, and protected-surface list. Update the manifest timestamp and current verified head while preserving the immutable baseline.

## Safe project-state updates

1. Verify current repository and PR state.
2. Keep the active program stage unchanged unless Howard explicitly authorizes a transition.
3. Update current and next gates from verified evidence.
4. Record uncertainty as `unknown` or `unverified` rather than guessing.
5. Keep future connector work visibly disconnected until separately authorized.
6. Run JSON validation, God View tests, and visual QA.
7. Keep the pull request draft and unmerged until Howard reviews it.

## Operational versus long-term documentation

God View is authoritative for current operational state. The Platform Roadmap describes long-term product direction and historical milestones. A stale roadmap entry must not override the current gate shown in God View.

## Verification checklist

After any God View update or recovery, confirm:

- `/admin/` renders meaningful content.
- The current objective and current/next gates load.
- Recovery status is current, stale, or unavailable—never falsely healthy.
- Source Lineage renders.
- Candidate Source Evaluation renders.
- Candidate feeds connected remains zero unless separately authorized.
- Assignment Desk Calendar behavior is unchanged.
- Public map behavior is unchanged.
- No agency endpoint is requested by the new project-control or recovery renderer.
- No `data/newsroom_engine/**` artifact is requested.
- No relevant console errors appear.
- Desktop and mobile layouts remain usable.
- The recovery manifest still contains the immutable baseline SHA.

## Handoff rule

A future assistant or developer must read, in order:

1. The current GitHub repository and PR metadata.
2. `admin/data/god-view-recovery-manifest-v01.json`.
3. `admin/data/god-view-project-state-v01.json`.
4. This document.
5. The feed and candidate registries before discussing sources or connectors.

Stop and report ambiguity rather than inventing current state.
