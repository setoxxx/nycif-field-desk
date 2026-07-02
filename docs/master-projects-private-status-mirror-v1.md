# Master Projects Private Status Mirror v1

## Purpose

Create the first public-safe mirror path for a private repository status artifact.

The Master Projects dashboard is served from public static hosting. It must not depend on private raw GitHub URLs, browser credentials, tokens, or live GitHub API polling.

This phase mirrors only the already-approved high-level `nycif-web-platform` status summary into a public-safe Field Desk file.

## Added mirror

```text
status/private-summaries/nycif-web-platform.json
```

## Dashboard source change

The dashboard no longer reads the private raw Web Platform status URL.

It now reads:

```text
./../status/private-summaries/nycif-web-platform.json
```

The other optional artifact sources remain unchanged:

```text
./../status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-open-data/main/status/nycif-project-status.json
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

- modify `nycif-web-platform`
- modify any private repository
- add GitHub tokens
- add credentials
- add browser-side GitHub API polling
- add write controls
- add deploy controls
- change public map runtime
- mutate production feed data
- touch WordPress
