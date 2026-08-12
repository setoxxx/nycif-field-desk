# Rung 14 Field Desk public retirement rollback

Status: DRAFT CANDIDATE EVIDENCE ONLY. This file does not authorize merge, deployment, rollback, or any production mutation.

## Historical candidate creation anchor

Exact protected `main` snapshot from which this retirement candidate was originally created:

`c86db5e0a9334539d4fb2233bebdbf75dff6df65`

This SHA is preserved as historical candidate-creation evidence. It is not a timeless rollback target and must not be substituted for the effective rollback source after protected `main` advances.

## Current certified protected-base snapshot

Current protected `main` base for this draft candidate:

`c86db5e0a9334539d4fb2233bebdbf75dff6df65`

This snapshot is certification evidence only. It must be re-resolved immediately before any separately authorized merge. If protected `main` differs at that point, STOP: synchronize the draft candidate without force-rewriting history, update the recorded protected-base snapshot, review the resulting diff, and re-run all then-required exact-head gates.

## Effective rollback source at authorization

The effective rollback source for any future Field Desk retirement deployment is the exact protected `main` base SHA immediately before any separately authorized merge of the retirement candidate. Record that SHA together with the authorized candidate head, merge result, Pages run, and public post-deploy verification.

If the protected-base SHA immediately before merge is still `c86db5e0a9334539d4fb2233bebdbf75dff6df65`, that SHA becomes the effective pre-retirement rollback source. If it has advanced, this document and the candidate must be refreshed and exact-head recertified before merge consideration.

## Rollback contract

If a separately authorized retirement deployment later causes an unacceptable regression, rollback must be performed through a new reviewed change based on the then-current protected branch, restoring the required pre-retirement behavior from the recorded effective rollback source or an explicitly certified successor. Do not force-update protected history and do not reuse this document as authorization to deploy.

Before any rollback deployment:

1. Record the deployed commit, effective rollback source, and Pages run.
2. Verify rollback source bytes against the recorded effective rollback source or an explicitly certified successor.
3. Re-run the applicable Field Desk CI gates on the rollback candidate.
4. Require separate merge/deploy authorization.
5. After deployment, verify the intended public route and service-worker behavior with cache-busted requests.

## Stale-client safety

The retirement service worker deletes only caches whose names start with `nycif-rc-public-map-`, claims controlled clients, redirects same-origin navigations to `https://nycinfocus.com/map/`, and does not synthesize responses for legacy assets. `tests/retirement-service-worker.test.mjs` provides deterministic candidate evidence for these properties.
