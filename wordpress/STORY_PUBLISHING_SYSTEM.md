# NYC In Focus Story Publishing System

This is the master workflow for publishing new NYC In Focus stories in WordPress.

The goal is consistency: every article should match the site layout, be readable on mobile, support SEO indexing, preserve editorial standards, and avoid publishing residue from drafting tools.

## Confirmed WordPress setup

- Post types: Posts, Pages, Attachments.
- Post taxonomies: Categories, Tags, Formats.
- Active theme: Creatio 2.
- Theme content width: 620px.
- Theme wide width: 1200px.
- SEO / measurement plugins available include All in One SEO, MonsterInsights, Jetpack, Redirection, and WPConsent.

## Story package order

Every publishable article package should be built in this order:

1. WordPress post title
2. Slug
3. Category ID and category name
4. Tags
5. Excerpt / meta description
6. SEO title
7. Social share title
8. Featured image plan
9. Article HTML body
10. JSON-LD notes if needed
11. Newsletter / Jetpack Publicize decision
12. QA verdict

## Default article layout

Use `ARTICLE_TEMPLATE.html` for standard stories.

Required article wrapper:

```html
<article class="nycif-story">
```

Do not place an H1 in the article body. WordPress supplies the visible post title.

Recommended structure:

```text
Kicker
Deck
Lead
Context
What the records show / What happened / What changed
Why it matters
What comes next
Editor’s note only if needed
```

## SEO fields

Use the fields available in WordPress post creation/update:

```json
{
  "meta": {
    "advanced_seo_description": "Custom meta description, about 140–160 characters.",
    "jetpack_seo_html_title": "SEO title, ideally under 60 characters.",
    "jetpack_seo_noindex": false,
    "jetpack_seo_schema_type": "article",
    "_jetpack_dont_email_post_to_subs": true,
    "jetpack_publicize_feature_enabled": false
  }
}
```

Use `_jetpack_dont_email_post_to_subs: true` and `jetpack_publicize_feature_enabled: false` during staging unless Howard explicitly confirms social/newsletter distribution.

## Category rules

Use one primary category unless the story clearly belongs in a second category.

Known category IDs:

| Category | Slug | ID | Use |
|---|---|---:|---|
| Civic Watch | civic-watch | 788853525 | Public filings, agency calendars, rulemakings, hearings, contracts, civic accountability. |
| news | news | 103 | General news and standard reporting. |
| Public Safety Watch | public-safety-watch | 788853549 | Public safety data/context, not police blotter framing. |
| Street Permit Watch | street-permit-watch | 788853550 | Street work, permits, closures, public-space impacts. |
| Week Events | week-events | 33176117 | Weekly event roundup. |
| Weekend Events | weekend-events | 76199 | Weekend event guide. |
| Music | music | 18 | Music-specific coverage. |

## Tag rules

Tags should support discovery without stuffing.

Use 5 to 10 tags per article:

- 1 site/brand tag if appropriate: NYC In Focus
- 1 borough tag if relevant: Brooklyn, Manhattan, Queens, Bronx, Staten Island
- 1 topic tag: public records, NYC land use, NYC contracts, NYC parks, public hearings
- 1 agency/entity tag if central: DSNY, DOHMH, City Planning Commission
- 1 event/neighborhood tag if central
- avoid near-duplicates in the same post

## Slug rules

Use lowercase, hyphenated slugs.

Good:

```text
brooklyn-rezoning-hearing-park-avenue
nyc-street-permit-watch-sidewalk-closures
queens-public-hearing-affordable-housing
```

Avoid:

```text
this-is-crazy
nyc-news-today
city-record-watch-update
untitled-234
```

## SEO title formula

Use one of these:

```text
[Specific issue] in [Borough/Neighborhood] | NYC In Focus
[Agency/Board] Sets [Hearing/Deadline/Action] | NYC In Focus
[Neighborhood] Faces [Change/Closure/Permit/Plan] | NYC In Focus
```

Keep it specific. Avoid clickbait.

## Meta description formula

Use 140–160 characters when possible:

```text
NYC In Focus examines [specific action] in [place], based on [public filings/agency calendars/public records] and what comes next.
```

## Featured image rules

Preferred size:

```text
1200 x 630 px
1.91:1 landscape
```

If using AI illustration, keep the established NYC In Focus style:

```text
Sophisticated editorial illustration, hand-drawn ink and watercolor on cream newsprint. Saul Steinberg x Pascal Campion sensibility. Horizontal 1.91:1 composition. Masthead in a top corner: “NYCINFOCUS.COM / THE CITY, UNFILTERED.”
```

Do not reuse a featured image unless explicitly approved.

## Civic Watch language

Use:

- public filings reviewed by NYC In Focus
- agency calendars reviewed by NYC In Focus
- public records reviewed by NYC In Focus
- public-facing materials reviewed by NYC In Focus
- city permit filings and agency calendars reviewed by NYC In Focus

Avoid:

- The City Record says
- City Record Watch
- scrape language
- internal source notes

## Publishing controls

Before publishing:

- Draft first.
- Confirm preview.
- Check mobile.
- Check desktop.
- Confirm featured image crop.
- Confirm SEO title and meta description.
- Confirm category and tags.
- Confirm no newsletter/social blast unless approved.

Do not publish, update live posts, or trigger distribution without explicit user approval.
