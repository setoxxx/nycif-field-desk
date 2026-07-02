# Master Projects Read Web Platform Status v1

## Purpose

Update the Master Projects dashboard so it can optionally attempt to read the private `nycif-web-platform` status artifact as a fourth static status source.

The existing manual dashboard snapshot remains the required fallback. The existing Field Desk, Live Feeds, and Open Data status artifact readers remain in place.

## Static status sources

The dashboard should read:

```text
./data/master-projects.json
./../status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-open-data/main/status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-web-platform/main/status/nycif-project-status.json
```

The first file is the required manual snapshot. The other four are optional status artifacts.

## Private repository limitation

`nycif-web-platform` is private. A public GitHub Pages page cannot load a private raw GitHub file unless credentials are provided.

This phase does not add credentials, tokens, browser-side GitHub API polling, proxy credentials, or write controls. Therefore, this fourth source is expected to fail safely from public GitHub Pages unless a separate controlled phase publishes a public-safe mirror of the artifact to a public location.

The existing optional loader behavior must remain in place: failed optional artifact fetches return `null`, and the manual dashboard snapshot remains the base source of truth.

## Safety model

Each optional artifact must pass the existing public-safety flag checks before it can be merged into a dashboard row.

The reader must reject artifacts that indicate:

- secrets
- credentials
- tokens
- private repo internals
- unpublished implementation details
- operational data
- browser-side GitHub API polling
- write controls
- deploy controls
- public map runtime changes
- production feed mutation
- WordPress changes

## Non-goals

This phase does not:

- modify `nycif-web-platform`
- modify other private repositories
- expose private repo internals
- expose unpublished implementation details
- expose operational data
- change dataset payloads
- mutate production feed data
- add GitHub tokens
- add browser-side GitHub API polling
- add credentials
- add write controls
- add deploy controls
- change public map runtime
- touch WordPress

## Expected public behavior

On public GitHub Pages, the first three reachable artifacts should continue loading normally. The private Web Platform artifact attempt should fail safely unless a public-safe mirror exists.

This means the dashboard should not break if the fourth source is unreachable.
