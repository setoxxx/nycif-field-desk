# Master Admin Projects v1

## Purpose

Create a single read-only portfolio control center for the NYCIF repository set.

This is intended to help track all active NYCIF projects as one master project without exposing secrets, private repository internals, credentials, or operational tokens.

## Repositories tracked

- `setoxxx/nycif-web-platform`
- `setoxxx/nycif-field-desk`
- `setoxxx/nycif-prompt-engine`
- `setoxxx/nycif-event-radar`
- `setoxxx/nycif-live-feeds`
- `setoxxx/nycif-data-pipeline`
- `setoxxx/nycif-open-data`

## Public/static safety model

The current admin dashboard is deployed through GitHub Pages from `setoxxx/nycif-field-desk`.

Because this is public static hosting, Master Admin Projects v1 must publish only safe, non-secret, summary-level information:

- project name
- full repo name
- visibility
- default branch
- high-level role
- high-level tracking status
- next-action placeholder

It must not include:

- private repo contents
- tokens
- credentials
- unpublished operational data
- API keys
- live GitHub API polling from the browser
- write/deploy/publish controls

## Password/access note

A JavaScript password prompt on GitHub Pages would not be real protection because the page source and JSON snapshot remain downloadable by anyone with the URL.

Recommended real protection options:

- Cloudflare Access in front of a custom admin domain
- Cloudflare Pages with Access policy
- Netlify password protection or identity gate
- Vercel deployment with authentication middleware
- private internal dashboard outside GitHub Pages

## Files added

- `admin/master-projects.html`
- `admin/data/master-projects.json`
- `docs/master-admin-projects-v1.md`

## Non-goals

- No public map runtime change
- No production feed change
- No WordPress change
- No GitHub token in browser
- No browser-side GitHub API polling
- No password stored in JavaScript
- No write controls
- No deployment controls
