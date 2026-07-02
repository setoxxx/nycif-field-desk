# Master Projects Status v2

## Purpose

Upgrade the Master Projects dashboard from simple inventory to a static status tracker.

## Adds

- Per-repo current phase
- Completion percentage
- Health label
- Blocker/gap summary
- Active PR visibility
- Recent PR visibility
- Next action per repo

## Data source model

This is still a public static GitHub Pages page. It does not fetch GitHub APIs from the browser and does not include secrets.

The status is a manual snapshot based on connector-visible repo/PR metadata.

## Safety

- No GitHub token in browser
- No live GitHub API polling from public page
- No private repo contents exposed
- No password or secret stored in JavaScript
- No write controls
- No deployment controls
- No public map runtime change
- No production feed mutation

## Next phase recommendation

Create one public-safe status artifact per repo, then make the Master Projects dashboard consume those static status artifacts instead of manually maintained fields.
