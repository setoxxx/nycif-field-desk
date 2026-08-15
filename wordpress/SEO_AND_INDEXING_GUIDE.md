# NYC In Focus SEO and Indexing Guide

This guide standardizes SEO fields for NYC In Focus articles.

## What SEO means for NYC In Focus

SEO should help readers and search engines understand the story. It should not make the article sound like clickbait or generic AI content.

Every story needs:

- clear WordPress title
- clean slug
- one primary category
- useful tags
- short excerpt
- SEO title
- meta description
- featured image alt text
- indexable status unless intentionally hidden
- internal links where natural

## Title rules

The WordPress post title should be readable as a headline and should usually include:

- what happened
- where it happened
- why it matters

Good patterns:

```text
Brooklyn Rezoning Hearing Puts Park Avenue Development Back on the Calendar
NYC Street Permit Filings Point to Another Round of Sidewalk Disruptions
Queens Public Hearing Sets Up New Fight Over Affordable Housing Plan
```

Avoid:

```text
You Won’t Believe What NYC Just Did
Breaking News Update
City Record Watch: Important New Filing
```

## SEO title rules

The SEO title may be tighter than the visible headline.

Target length: under 60 characters when possible.

Format:

```text
[Specific Story] | NYC In Focus
```

Examples:

```text
Brooklyn Rezoning Hearing Returns | NYC In Focus
NYC Street Permit Filings Signal Closures | NYC In Focus
Queens Housing Hearing Set for July | NYC In Focus
```

## Meta description rules

Target length: 140–160 characters.

Formula:

```text
NYC In Focus examines [specific action] in [place], based on [public filings/agency calendars/public records] and what comes next.
```

Good examples:

```text
NYC In Focus examines a Brooklyn rezoning hearing based on public filings, agency calendars and what comes next for the project.
```

```text
NYC In Focus tracks street permit filings, closures and public-space impacts across New York City using public records and field reporting.
```

## Slug rules

Use lowercase and hyphens.

Include topic and place.

Examples:

```text
brooklyn-park-avenue-rezoning-hearing
nyc-street-permit-sidewalk-closures
queens-affordable-housing-public-hearing
```

## Category rules

Use one primary category:

```text
Civic Watch: public filings, hearings, contracts, agency rules, public records
news: general reporting
Public Safety Watch: public safety data/context
Street Permit Watch: street permits, road work, public-space disruption
Week Events: weekly event guide
Weekend Events: weekend event guide
Music: music coverage
```

## Tag rules

Use 5 to 10 tags.

Recommended tag mix:

1. NYC In Focus
2. borough or neighborhood
3. agency or board
4. topic
5. record type or event type
6. project/entity/person when central

Do not tag-stuff.

Avoid duplicate variants in one post unless needed:

```text
NYC, NewYorkCity, nyc events, NYCevents
```

Pick the cleanest version.

## Internal link rules

Use natural links to:

- latest coverage
- related prior story
- relevant NYCIF watch page
- Editorial Standards
- Corrections Policy when appropriate
- Contact for tips
- Photo Licensing only when image use is relevant

Do not over-link the first paragraph.

## Image SEO rules

Featured image requirements:

- 1200 x 630 px preferred
- landscape 1.91:1
- descriptive alt text
- clean caption
- credit line
- no misleading AI labels
- no duplicate featured image unless approved

Alt text formula:

```text
[Subject/action] at [place] in [borough/neighborhood], photographed or illustrated for NYC In Focus.
```

## Indexing rules

Default:

```json
"jetpack_seo_noindex": false
```

Use noindex only for:

- archive pages
- duplicate pages
- staging posts
- internal cleanup notes
- test posts
- pages not intended for public search

## Social / newsletter controls

Default for drafts and staging:

```json
"_jetpack_dont_email_post_to_subs": true,
"jetpack_publicize_feature_enabled": false
```

Turn on social/newsletter only after explicit approval.
