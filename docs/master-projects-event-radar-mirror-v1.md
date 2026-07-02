# Master Projects Event Radar Mirror v1

## Purpose

Add a public-safe mirror artifact for the private `nycif-event-radar` repository.

The Master Projects dashboard is served from public static hosting. It must not read private raw GitHub URLs, browser credentials, tokens, or live GitHub API polling for private repository status.

This phase mirrors only a high-level public-safe Event Radar status summary into a Field Desk file.

## Added mirror

```text
status/private-summaries/nycif-event-radar.json
```

## Dashboard source change

The dashboard now includes:

```text
./../status/private-summaries/nycif-event-radar.json
```

The existing optional artifact sources remain:

```text
./../status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-open-data/main/status/nycif-project-status.json
./../status/private-summaries/nycif-web-platform.json
```

The required manual fallback remains:

```text
./data/master-projects.json
```

## Mirror safety

The mirror contains only high-level public-safe status fields:

- artifact type and schema version
- project and repository name
- visibility
- public summary scope
- current phase
- completion percentage
- health
- status summary
- empty active/recent PR arrays
- generic blockers
- next action
- data freshness
- safety flags
- generated timestamp

The mirror does not include private repo internals, secrets, credentials, tokens, unpublished implementation details, operational data, PR titles, implementation specifics, private file paths, source URLs, or private run details.

## Preserved dashboard behavior

This phase preserves:

- required manual fallback
- optional source visibility states
- loaded / unreachable / rejected reporting
- public-safety validation
- rejected artifact non-merge behavior
- unreachable artifact safe-fail behavior

## Non-goals

This phase does not:

- modify `nycif-event-radar`
- modify any private repository
- add GitHub tokens
- add credentials
- add browser-side GitHub API polling
- add write controls
- add deploy controls
- change public map runtime
- mutate production feed data
- touch WordPress
