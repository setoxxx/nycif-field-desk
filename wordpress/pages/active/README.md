# Active WordPress Page Templates

Store final approved page bodies here after cleanup.

Each file should contain the full WordPress body, including `<!-- wp:html -->` blocks and scoped CSS.

## Naming convention

```text
about.html
contact.html
editorial-standards.html
corrections-policy.html
privacy-policy.html
terms-of-service.html
cookie-policy.html
photo-licensing.html
our-team.html
nyc-civic-watch.html
nyc-civic-radar.html
nyc-events-watch.html
nyc-events-radar.html
nyc-311-watch.html
nyc-public-safety-watch.html
nyc-street-permit-watch.html
things-to-do-in-nyc.html
nyc-in-focus-map.html
nyc-events-calendar.html
```

## Required metadata at top of each file

Use an HTML comment before the WordPress block:

```html
<!--
NYC In Focus WordPress Page Template
Title: [Page title]
Slug: [slug]
Status: active-public | active-fragile | archive-draft
Last reviewed: YYYY-MM-DD
Notes: [short note]
-->
```

## Do not store

- WordPress passwords or app passwords
- private source notes
- unpublished personal information
- unapproved contributor bios
- production secrets
- old newsletter shortcodes on public pages
