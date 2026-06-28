# NYCIF Field Desk Map — Stable UI Fallback Snapshot

Date: 2026-06-28
Repository: `setoxxx/nycif-field-desk`
Public app: `https://setoxxx.github.io/nycif-field-desk/`
Reference tested URL: `https://setoxxx.github.io/nycif-field-desk/?v=popup-artifact-01`
WordPress wrapper page: `https://nycinfocus.com/map/`

## Purpose

This document records the current stable GitHub-hosted map UI as the fallback reference before additional live-site or WordPress wrapper changes are made.

The working rule going forward:

1. Test UI and behavior on the GitHub-hosted map app first.
2. Confirm the GitHub map is stable on mobile and desktop.
3. Only then update the live WordPress `/map/` wrapper.
4. Do not use the live WordPress page as the first place to experiment.

## Stable behavior to preserve

- The GitHub-hosted map app displays full-screen.
- Map panning and zooming work.
- The plus/minus Leaflet zoom buttons are hidden on the public map UI.
- Date chips remain visible at the top.
- Filters are compressed by roughly 15% compared with the earlier version.
- Popup black X close button is hidden.
- Popups close naturally when tapping off, panning, dragging, scrolling, or opening another marker.
- Event List remains accessible.
- Near Me remains accessible.
- Search and borough filters remain accessible in the Event List drawer.

## Files that define the stable UI

- `index.html`
- `style.css`
- `fielddesk-v02.css`
- `weekstrip-v06-safe.css`
- `staged-map-mode-v01.css`
- `public-map-v01.css`
- `app-v06-safe.js`
- `popup-autoclose-fix-v01.js`
- `public-map-autoload-v01.js`

## Important recent fixes

### Popup behavior

File: `popup-autoclose-fix-v01.js`

Preserve:

- mobile pan closes popup
- map background tap closes popup
- wheel/touchmove closes popup
- popup internal scrolling remains usable
- black popup X is hidden

### Public UI polish

File: `public-map-v01.css`

Preserve:

- hidden Leaflet zoom control
- smaller public Filters button/panel
- hidden internal test controls on public map
- public intro hidden on small screens

### Do not preserve / repeat

Do not reapply the unstable internal full-height patch that forced `html`, `body`, `#app`, `.app`, `.map-shell`, and `.map` heights inside `public-map-v01.css`. That patch caused mobile rendering regression and was rolled back.

## WordPress wrapper caution

The GitHub app is the canonical UI reference. The WordPress page should only be a clean iframe wrapper around the GitHub app.

The WordPress wrapper must not allow WordPress to inject malformed paragraph tags around the iframe or script, such as:

```html
<p><iframe ...></iframe><br />
</section>
<p><script>...</script></p>
```

If the WordPress `/map/` page fails but the GitHub URL works, treat the bug as a WordPress wrapper issue first, not a GitHub map-app issue.

## Future development rule

Before changing the live site:

- make the change in the GitHub-hosted map app
- test direct GitHub URL
- snapshot or document the working state
- then update WordPress wrapper cache/version only after the GitHub app is confirmed working

## Current fallback principle

If a live-site change breaks the map, compare against:

`https://setoxxx.github.io/nycif-field-desk/?v=popup-artifact-01`

and restore the WordPress wrapper to a clean iframe-only shell pointing at the known-good GitHub app.
