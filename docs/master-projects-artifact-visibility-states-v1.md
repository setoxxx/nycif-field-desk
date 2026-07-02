# Master Projects Artifact Visibility States v1

## Purpose

Make optional status artifact fetch results visible on the Master Projects dashboard before continuing private-repo artifact rollout.

Previously, failed optional artifact fetches safely returned `null`, but the dashboard did not show which optional source loaded, which source was unreachable, or which source was rejected by the safety gate.

## Status states

The dashboard now reports each optional status artifact source as one of:

```text
loaded
unreachable
rejected
```

- `loaded`: the source fetched, passed public-safety validation, and was merged into the matching project row.
- `unreachable`: the source failed to fetch or returned a non-OK response. Manual fallback remains intact.
- `rejected`: the source fetched but failed public-safety validation. It is not merged into a project row.

## Required fallback

The required manual snapshot remains:

```text
./data/master-projects.json
```

If optional artifacts fail, the manual snapshot remains the base source of truth.

## Optional sources

This phase keeps the existing optional sources:

```text
./../status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-open-data/main/status/nycif-project-status.json
https://raw.githubusercontent.com/setoxxx/nycif-web-platform/main/status/nycif-project-status.json
```

The Web Platform source remains an optional private-source attempt and is expected to be `unreachable` on public GitHub Pages unless a later public-safe mirror is created.

## Safety

This phase does not:

- add GitHub tokens
- add credentials
- add browser-side GitHub API polling
- add write controls
- add deploy controls
- expose private repo internals
- expose unpublished implementation details
- expose operational data
- change public map runtime
- mutate production feed data
- touch WordPress
- modify any repository except `setoxxx/nycif-field-desk`

## Non-goals

- Does not create a private-repo mirror.
- Does not remove the Web Platform private-source attempt.
- Does not add authentication.
- Does not add a server-side proxy.
- Does not change production data or public map runtime.
