# NYC In Focus WordPress Publishing SOP

This SOP keeps NYC In Focus pages and articles consistent across WordPress and GitHub.

## Operating principle

GitHub is the master template file system. WordPress is the final publishing surface.

Do not build important page HTML only inside WordPress. Keep the master body in this repository, then paste the final reviewed body into WordPress.

## Standard page workflow

1. Identify the page in `PAGE_REGISTRY.md`.
2. Confirm the page status:
   - active public
   - active but fragile
   - archive / do-not-use
3. Edit the relevant template file in GitHub.
4. Keep page-specific CSS scoped to one wrapper class.
5. Avoid global selectors unless the page intentionally needs full-screen behavior, such as the map page.
6. Remove newsletter CTAs unless the newsletter system is confirmed live.
7. Remove old navigation rows, duplicate headers, duplicate footers, and prototype copy.
8. Run `QA_CHECKLIST.md`.
9. Paste final title and body into WordPress.
10. Confirm mobile, desktop, incognito, and public URL behavior.

## Standard article workflow

1. Draft the article in NYC In Focus voice.
2. Build final article HTML using `ARTICLE_TEMPLATE.html`.
3. Wrap story HTML in a Custom HTML block.
4. Use the `.nycif-story` class.
5. Do not include Markdown fences, prompt text, AI notes, private-source labels, or unpublished working notes.
6. Do not put an H1 inside the article body; WordPress supplies the post title.
7. Use public-source language carefully:
   - “public filings reviewed by NYC In Focus”
   - “agency calendars reviewed by NYC In Focus”
   - “public records reviewed by NYC In Focus”
8. Do not publicly label the source as “The City Record.”
9. Confirm facts, dates, addresses, agency names, hearing details, and public-meeting language.
10. Run `QA_CHECKLIST.md` before publishing.

## Page CSS rules

Each page should use one scoped wrapper class.

Examples:

```css
.nyc-about-page { ... }
.nyc-civic-watch-page { ... }
.nyc-standards-page { ... }
.nyc-corrections-page { ... }
.nyc-cookie-page { ... }
.nyc-privacy-page { ... }
.nyc-terms-page { ... }
.nyc-licensing-page { ... }
.nyc-team-page { ... }
.nyc-public-safety-page { ... }
.nyc-street-permit-page { ... }
.nyc-things-page { ... }
```

Avoid styling bare `body`, `main`, `header`, `footer`, `h1`, `h2`, `p`, or `a` globally unless the page is a special full-screen app wrapper.

## Full-screen map exception

The live map page may use full-screen selectors because it intentionally hides WordPress chrome and fills the viewport.

Do not reuse map-page CSS on normal content pages.

## Newsletter rule

Until the newsletter system is active:

- no `[newsletter]` shortcode
- no newsletter archive links
- no Subscribe buttons
- no subscriber-count claims
- no newsletter CTA in page footers

Use Contact, Latest Coverage, Events Calendar, Photo Licensing, or Editorial Standards as safer CTA destinations.

## Naming convention for template files

Use lowercase, hyphenated names.

Examples:

```text
wordpress/pages/active/about.html
wordpress/pages/active/contact.html
wordpress/pages/active/editorial-standards.html
wordpress/pages/active/photo-licensing.html
wordpress/pages/active/nyc-civic-watch.html
wordpress/pages/archive/old-newsletter-archive.html
```

## Git workflow

Use a branch and pull request for template-system changes.

Recommended branch name:

```text
wordpress-template-system
```

Recommended commit format:

```text
Add WordPress template system docs
Update NYCIF page registry
Add article HTML template
Archive old newsletter template
```
