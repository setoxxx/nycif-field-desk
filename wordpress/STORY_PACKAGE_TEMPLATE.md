# NYC In Focus Story Package Template

Use this file as the standard package format before creating or updating a WordPress post.

Do not publish from an incomplete package.

```yaml
story_status: draft_ready | needs_reporting | needs_fact_check | ready_for_wp_draft | ready_to_publish
wordpress_site_id: 239339912
post_type: post

post_title: ""
slug: ""
status: draft
comment_status: closed

category:
  name: ""
  slug: ""
  id: null

tags:
  - name: ""
    slug: ""
    id: null

seo:
  seo_title: ""
  meta_description: ""
  schema_type: article
  noindex: false

jetpack:
  publicize_enabled: false
  dont_email_subscribers: true
  publicize_message: ""

featured_image:
  status: needed | selected | uploaded | assigned
  media_id: null
  alt_text: ""
  caption: ""
  credit: "Howard Weiss / NYC In Focus"
  crop: "1200x630 landscape"

article:
  kicker: ""
  deck: ""
  body_file: "wordpress/articles/YYYY-MM-DD-story-slug.html"

json_ld:
  needed: false
  file: ""

qa:
  verdict: pending
  checked_count: 0
  failures: []
  warnings: []
```

## Copy/paste publishing object

When creating a WordPress draft through the connector, use this shape only after the package is approved:

```json
{
  "title": {"raw": "POST TITLE"},
  "content": {"raw": "FULL GUTENBERG HTML BODY"},
  "excerpt": {"raw": "META DESCRIPTION / EXCERPT"},
  "status": "draft",
  "categories": [788853525],
  "tags": [],
  "comment_status": "closed",
  "meta": {
    "advanced_seo_description": "META DESCRIPTION",
    "jetpack_seo_html_title": "SEO TITLE",
    "jetpack_seo_noindex": false,
    "jetpack_seo_schema_type": "article",
    "_jetpack_dont_email_post_to_subs": true,
    "jetpack_publicize_feature_enabled": false
  }
}
```

## Required package notes

- `post_title` is the WordPress title and visible H1.
- The article HTML body must not include an H1.
- `excerpt.raw` should match or closely support the meta description.
- Featured image must have useful alt text.
- Jetpack Publicize remains off unless Howard explicitly approves social blast.
- Email/subscriber delivery remains off unless Howard explicitly approves newsletter/send.
