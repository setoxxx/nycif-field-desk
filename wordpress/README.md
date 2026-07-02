# NYC In Focus WordPress Template System

This directory is the source-of-truth library for NYC In Focus WordPress pages, reusable HTML templates, article wrappers, and publishing rules.

The live Field Desk PWA stays at the repository root. WordPress material belongs under `wordpress/` so template work does not interfere with the public map app.

## Directory map

```text
wordpress/
  README.md
  PAGE_REGISTRY.md
  PUBLISHING_SOP.md
  QA_CHECKLIST.md
  ARTICLE_TEMPLATE.html
  PAGE_TEMPLATE_BASE.html
  pages/
    active/README.md
    archive/README.md
```

## Core rule

WordPress is the publishing surface. GitHub is the master file system.

Do not rebuild major pages directly in WordPress from memory. Start from the saved template, update the template in GitHub, review the diff, then paste the approved final body into WordPress.

## Page types

### Active public pages

Pages that are safe to publish and keep linked from the site footer, utility navigation, or public hubs.

Examples:

- About NYC In Focus
- Contact NYC In Focus
- Editorial Standards
- Corrections Policy
- Privacy Policy
- Terms of Service
- Cookie Policy
- Photo Licensing
- Our Team
- NYC Civic Watch
- NYC Civic Radar
- NYC Events Watch
- NYC Events Radar
- NYC 311 Watch
- NYC Public Safety Watch
- NYC Street Permit Watch
- Things To Do in NYC
- NYC In Focus Map
- NYC Events Calendar

### Active but fragile pages

Pages that depend on a shortcode, iframe, external feed, GitHub Pages app, map app, calendar module, or JSON feed.

These require a live check before public promotion.

Examples:

- NYC In Focus Map
- NYC Events Calendar
- NYC Events Radar
- Things To Do in NYC

### Archive / do-not-use pages

Old pages that should stay as Draft or hidden until cleanup is complete.

Examples:

- OLD — Newsletter Archive — Do Not Use
- OLD — Newsletter Page — Do Not Use
- OLD — Newsletter System — Do Not Use
- OLD — Home Front Page Draft — Do Not Use
- OLD — Duplicate Map Page — Do Not Use

## Public source-language rules

Do not publicly brand the source as “The City Record.” Use language such as:

- public filings
- agency calendars
- agency rulemakings
- public records
- public-facing materials
- city permit filings and agency calendars reviewed by NYC In Focus
- agency rulemakings and public filings reviewed by NYC In Focus

Public page titles should use “NYC Civic Watch,” not “City Record Watch.”

## Newsletter status

The newsletter system is not public-ready. Until the signup flow, archive display, privacy/cookie language, and test signup are confirmed:

- Do not use `[newsletter]` shortcode.
- Do not link Newsletter Archive publicly.
- Do not claim subscriber counts.
- Do not put newsletter CTAs on core pages.

## WordPress edit safety

Do not touch these without an explicit approved publishing instruction:

- Front Page template
- `/map/`
- `/calendar/`
- menus
- theme files
- snippets
- plugins
- cache
- live public pages

For NYC In Focus article publishing, use `ARTICLE_TEMPLATE.html` and `QA_CHECKLIST.md` before pasting into WordPress.
