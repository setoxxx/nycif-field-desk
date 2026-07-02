# Master Projects Status Artifacts v1

## Purpose

Define a standard public-safe status artifact for each NYCIF repository, then stage the first implementation in `setoxxx/nycif-field-desk`.

The goal is to move the Master Projects dashboard away from manually edited status fields and toward per-repo static status artifacts.

## Standard artifact path

Each NYCIF repo should eventually publish:

```text
status/nycif-project-status.json
```

A shared schema is staged here:

```text
status/nycif-project-status.schema.json
```

## Repositories covered by the plan

- `setoxxx/nycif-web-platform`
- `setoxxx/nycif-field-desk`
- `setoxxx/nycif-prompt-engine`
- `setoxxx/nycif-event-radar`
- `setoxxx/nycif-live-feeds`
- `setoxxx/nycif-data-pipeline`
- `setoxxx/nycif-open-data`

## Implementation in this PR

This PR implements only the first artifact for:

```text
setoxxx/nycif-field-desk
```

It does not modify the other six repositories.

## Safe data contract

Each artifact may include:

- project name
- repository name
- visibility
- current phase
- completion percentage
- health label
- status summary
- active PR title/number/link/state
- recent PR title/number/link/state
- blockers
- next action
- data freshness note
- explicit safety flags

Each artifact must not include:

- secrets
- credentials
- tokens
- private repo internals
- unpublished operational details
- browser-side GitHub API polling
- write controls
- deployment controls
- public map runtime changes
- production feed mutation
- WordPress changes

## Safety assertions for this PR

- No private repository internals are exposed.
- No secrets are added.
- No credentials are added.
- No GitHub tokens are added.
- No browser-side GitHub API polling is added.
- No write controls are added.
- No deploy controls are added.
- No public map runtime is changed.
- No production feed is mutated.
- No WordPress files or settings are touched.
- No private repositories are modified.

## Next phase

After this field-desk artifact is reviewed and merged, create equivalent safe status artifacts in the remaining six repositories one at a time.

Then update the Master Projects dashboard to consume static status artifacts instead of hardcoded manually curated fields.
