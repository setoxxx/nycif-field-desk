# Master Projects Read Field Status v1

## Purpose

Update the Master Projects dashboard so it can optionally read the local Field Desk status artifact:

```text
../status/nycif-project-status.json
```

The existing manual dashboard snapshot remains the fallback.

## Files changed

- `admin/master-projects.html`
- `docs/master-projects-read-field-status-v1.md`

## What changed

The dashboard now:

- loads the existing manual snapshot from `./data/master-projects.json`
- attempts to load the local Field Desk status artifact from `../status/nycif-project-status.json`
- validates the artifact's safety flags before using it
- merges the status artifact into the matching `nycif-field-desk` row
- leaves the manual snapshot in place when the status artifact is missing or invalid
- displays a count of loaded status artifacts in the summary cards

## Safety

This phase does not add:

- GitHub tokens
- browser-side GitHub API polling
- write controls
- deploy controls
- private repo internals
- public map runtime changes
- production feed mutation
- WordPress changes

## Non-goals

- Does not modify public map runtime.
- Does not mutate production feeds.
- Does not touch WordPress.
- Does not modify private repositories.
- Does not create status artifacts for the other six repos.
- Does not add any live GitHub API calls.

## Next phase

After this is merged and live-checked, create equivalent `status/nycif-project-status.json` artifacts one repo at a time for the remaining NYCIF repositories.
