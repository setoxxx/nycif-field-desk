# NYC In Focus Page Registry

This registry tracks the current intended status of NYC In Focus WordPress pages after the July 2026 cleanup pass.

Use this file before editing WordPress. If a page body changes, update the relevant template file and this registry first.

## Active public pages

| Page | Recommended title | Status | Navigation | Notes |
|---|---|---:|---|---|
| Homepage | NYC In Focus — The City, Unfiltered | Publish | Front page | Do not rewrite unless visibly broken. Body lives in the live homepage page, not the Front Page template. |
| About | About NYC In Focus \| Visual Journalism & Civic Reporting | Publish | Footer / utility | No newsletter CTA. |
| Contact | Contact NYC In Focus \| Tips, Licensing & Coverage | Publish | Footer / utility | Central route for tips, corrections, licensing, coverage requests. |
| Editorial Standards | Editorial Standards \| NYC In Focus | Publish | Footer / utility | Core trust page. |
| Corrections Policy | Corrections Policy \| NYC In Focus | Publish | Footer / utility | Core trust page. |
| Privacy Policy | Privacy Policy \| NYC In Focus | Publish | Footer / legal | Core legal page. Newsletter/payment language only if enabled. |
| Terms of Service | Terms of Service \| NYC In Focus | Publish | Footer / legal | Core legal page. Newsletter/payment language only if enabled. |
| Cookie Policy | Cookie Policy \| NYC In Focus | Publish | Footer / legal | Keep cookie shortcode if active. |
| Photo Licensing | Photo Licensing \| NYC In Focus | Publish | Footer / utility | Main image reuse and assignment request page. |
| Our Team | Our Team \| NYC In Focus | Publish | Optional | Keep centered on Howard unless contributors approve public bios. |

## Civic Radar / watch pages

| Page | Recommended title | Status | Navigation | Notes |
|---|---|---:|---|---|
| NYC Civic Radar | NYC Civic Radar \| Public Filings, Events, 311 & City Signals | Publish | Optional hub | Main civic monitoring hub. |
| NYC Civic Watch | NYC Civic Watch \| Public Filings, Hearings & Agency Actions | Publish | Optional | Public name should not say “City Record Watch.” |
| NYC Events Watch | NYC Events Watch \| Public Events, Civic Meetings & Coverage Leads | Publish | Optional | Explainer/hub; do not replace calendar/map. |
| NYC Events Radar | NYC Events Radar \| Field Map & Coverage Leads | Publish if shortcode loads | Optional | Check shortcode/feed before public promotion. |
| NYC 311 Watch | NYC 311 Watch \| Quality-of-Life Complaints & City Service Signals | Publish | Optional | Page should explain signals, not overclaim live data. |
| NYC Public Safety Watch | NYC Public Safety Watch \| Data, Trends & Civic Context | Publish | Optional | Not a police blotter. No fear framing. |
| NYC Street Permit Watch | NYC Street Permit Watch \| Street Work, Closures & Public Space | Publish | Optional | Permit data is a reporting lead, not final reporting. |

## Map and event pages

| Page | Recommended title | Status | Navigation | Notes |
|---|---|---:|---|---|
| NYC In Focus Map | NYC In Focus Map | Publish | Map route | Full-screen iframe shell. Do not alter unless live feed changes. |
| NYC Events Calendar | NYC Events Calendar | Publish if live | Calendar route | Preserve shortcode/embed. Do not replace with Events Radar. |
| Things To Do in NYC | Things To Do in NYC \| Events, Maps & Public Happenings | Publish if map loads | Optional | Feed URL must be checked for staleness before promotion. |

## Hidden / archive pages

| Page | Recommended title | Status | Navigation | Notes |
|---|---|---:|---|---|
| Newsletter page | NYC In Focus Newsletter \| Coming Soon | Draft or hidden | None | No `[newsletter]` shortcode until workflow is active. |
| Newsletter Archive | OLD — Newsletter Archive — Do Not Use | Draft | None | Keep as cleanup archive only. |
| Newsletter System | OLD — Newsletter System — Do Not Use | Draft | None | Internal archive/prototype only. |
| Old Homepage Draft | OLD — Home Front Page Draft — Do Not Use | Draft | None | Do not assign as homepage. Later slug: `old-home-front-page-draft`. |
| Duplicate Map Page | OLD — Duplicate Map Page — Do Not Use | Draft | None | Do not use for `/map/`. |

## Required before publishing a page change

1. Check this registry.
2. Confirm whether the page is active, fragile, or archive-only.
3. Update the template file in GitHub first.
4. Review the diff.
5. Run the QA checklist.
6. Paste into WordPress only after the page body is final.
7. Do not add newsletter CTAs unless newsletter is confirmed live.
