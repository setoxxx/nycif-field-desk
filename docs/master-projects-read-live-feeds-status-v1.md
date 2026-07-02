# Master Projects Read Live Feeds Status v1

## Purpose

Update the Master Projects dashboard so it can optionally read the public `nycif-live-feeds` status artifact as a second static status source.

The existing manual dashboard snapshot remains the required fallback. The existing local Field Desk status artifact reader remains in place.

## Static status sources

The dashboard should read:

```text
./data/master-projects.json
./../status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/status/nycif-project-status.json
```

The first file is the required manual snapshot. The other two are optional status artifacts.

## Safety model

Each optional artifact must pass the existing public-safety flag checks before it can be merged into a dashboard row.

The reader must reject artifacts that indicate:

- secrets
- credentials
- tokens
- private repo internals
- browser-side GitHub API polling
- write controls
- deploy controls
- public map runtime changes
- production feed mutation
- WordPress changes

## Non-goals

This phase does not:

- modify `nycif-live-feeds`
- modify private repositories
- change feed payloads
- mutate production feed data
- add GitHub tokens
- add browser-side GitHub API polling
- add write controls
- add deploy controls
- change public map runtime
- touch WordPress

## Next phase

After review and merge, verify the live dashboard shows two loaded status artifacts: `nycif-field-desk` and `nycif-live-feeds`.
