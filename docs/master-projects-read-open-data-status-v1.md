# Master Projects Read Open Data Status v1

## Purpose

Update the Master Projects dashboard so it can optionally read the public `nycif-open-data` status artifact as a third static status source.

The existing manual dashboard snapshot remains the required fallback. The existing Field Desk and Live Feeds status artifact readers remain in place.

## Static status sources

The dashboard should read:

```text
./data/master-projects.json
./../status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-open-data/main/status/nycif-project-status.json
```

The first file is the required manual snapshot. The other three are optional status artifacts.

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

- modify `nycif-open-data`
- modify private repositories
- change dataset payloads
- mutate production feed data
- add GitHub tokens
- add browser-side GitHub API polling
- add write controls
- add deploy controls
- change public map runtime
- touch WordPress

## Next phase

After review and merge, verify the live dashboard shows three loaded status artifacts: `nycif-field-desk`, `nycif-live-feeds`, and `nycif-open-data`.
