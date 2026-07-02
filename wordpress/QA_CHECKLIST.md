# NYC In Focus WordPress QA Checklist

Use this checklist before any page or article is pasted into WordPress or published.

## Hard fail checks

Fail the package if any of these appear:

- Markdown code fences in the WordPress body.
- AI prompt residue.
- Internal notes that should not be public.
- Private-source labels or confidential source handling notes.
- Duplicate H1 inside article body.
- Old top navigation rows pasted inside page content.
- Newsletter CTAs while newsletter is not active.
- `[newsletter]` shortcode on public pages.
- “City Record Watch” as a public page title.
- Unsupported claims written as confirmed facts.
- Unverified event claims written as confirmed details.
- Broken iframe, shortcode, map feed, calendar feed, or public data feed.
- Header/footer template content pasted into ordinary page body.

## Page checks

- Page title matches `PAGE_REGISTRY.md`.
- Body uses one scoped wrapper class.
- Links point to the current intended site pages.
- No old Subscribe buttons.
- No Newsletter Archive links unless newsletter is active.
- No stale reader/follower count unless intentionally current.
- Mobile layout is readable.
- Desktop layout is readable.
- Incognito/public view works.
- Footer/legal links remain intact where needed.

## Article checks

- WordPress post title supplies the H1.
- Article body starts inside `.nycif-story`.
- Short paragraphs.
- Clear attribution.
- No unsupported facts.
- Dates are exact.
- Event times and locations are verified.
- Public-source language avoids “The City Record” as public branding.
- No prompt residue.
- No code fences.
- JSON-LD, SEO title, excerpt, category, and tags match the story.
- Featured image is correct, safe-cropped, and not a duplicate unless approved.

## Civic Watch source-language checks

Allowed public phrasing:

- public filings reviewed by NYC In Focus
- agency calendars reviewed by NYC In Focus
- city permit filings and agency calendars reviewed by NYC In Focus
- public records reviewed by NYC In Focus
- public-facing materials reviewed by NYC In Focus

Avoid public phrasing:

- The City Record says...
- City Record Watch
- private source dump
- raw filing scrape

## Newsletter checks

Until the newsletter is active, fail if any of these are present:

- Subscribe button
- Newsletter Archive public link
- `[newsletter]` shortcode
- “enter your email below” signup copy
- subscriber-count claim
- newsletter workflow/system language visible to readers

## Fragile page checks

For Map, Calendar, Events Radar, and Things To Do:

- shortcode or iframe loads
- feed URL is current
- mobile viewport works
- desktop viewport works
- no duplicate map page is linked publicly
- map page does not replace calendar page
- calendar page does not replace map page

## Final verdict format

Use this format when reviewing a final package:

```text
VERDICT: PASS or FAIL
Checked count: [number]
Failures:
- [issue]
Warnings:
- [issue]
```
