# Rung 14 Field Desk public retirement rollback

Status: DRAFT CANDIDATE EVIDENCE ONLY. This file does not authorize merge, deployment, rollback, or any production mutation.

## Pre-retirement anchor

Exact protected `main` snapshot used to create this retirement candidate:

`c86db5e0a9334539d4fb2233bebdbf75dff6df65`

The pre-retirement Pages deployment at that snapshot uploads the repository root and contains the legacy public application/service-worker implementation. The candidate intentionally changes only the future Pages boundary and public-root behavior; it does not rewrite or delete the historical source tree.

## Rollback contract

If a separately authorized retirement deployment later causes an unacceptable regression, rollback must be performed through a new reviewed change based on the then-current protected branch, restoring the required pre-retirement behavior from the exact anchor above or an explicitly certified successor. Do not force-update protected history and do not reuse this document as authorization to deploy.

Before any rollback deployment:

1. Record the currently deployed commit and Pages run.
2. Verify the rollback source bytes against the exact anchor or certified successor.
3. Re-run the applicable Field Desk CI gates on the rollback candidate.
4. Require separate merge/deploy authorization.
5. After deployment, verify the intended public route and service-worker behavior with cache-busted requests.

## Stale-client safety

The retirement service worker deletes only caches whose names start with `nycif-rc-public-map-`, claims controlled clients, redirects same-origin navigations to `https://nycinfocus.com/map/`, and does not synthesize responses for legacy assets. `tests/retirement-service-worker.test.mjs` provides deterministic candidate evidence for these properties.
