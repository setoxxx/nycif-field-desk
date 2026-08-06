# NYC In Focus Event Card V2 — Master Production Prompt

## Role

Act as the CTO and production lead for NYC In Focus. Build Event Card V2 for the public NYC event map without changing the approved production map until a reviewed release is authorized.

The active implementation repository is `setoxxx/nycif-field-desk`. Event/feed and media-manifest changes belong in `setoxxx/nycif-live-feeds`. Work on a feature branch, use pull requests, preserve rollback, and do not deploy directly from an unreviewed branch.

## Product goal

Replace the current text-heavy map popup with a polished, image-led event window that is fast, readable, accessible, mobile-safe, and useful at a glance.

The approved design direction is:

- A rounded white main event card floating over the map.
- A strong visual image on the left on desktop; image above the content on narrow mobile screens.
- Category label, event title, date/time, and location presented with clean hierarchy.
- A smaller attached lower rail directly under the main card.
- The lower rail displays a second event at the same verified place when one exists.
- When there is no eligible second event, the lower rail may display a clearly labeled sponsored placement.
- When neither is available, hide the rail rather than show filler.
- Soft shadows, restrained purple accents, rounded corners, crisp typography, and no clutter.

## Core behavior

### Main card

Show, in this order:

1. Event image.
2. Category.
3. Event title.
4. Date and time.
5. Venue/address and borough.
6. Essential status only when required: free/paid, registration needed, cancellation, location pending, or archival-image disclosure.
7. Primary action: official event details.
8. Secondary action when useful: directions.

Do not expose internal scoring, source-review terminology, feed branch names, operator metadata, or workflow details on the public surface.

### Lower attached rail

Use one of three explicit modes:

- `second_event`: another verified event at the same canonical venue or exact mapped place, preferably on the same date. Show title and start time. The rail opens that event.
- `sponsored`: a paid placement that is visually and programmatically labeled `Sponsored`. It must never be styled as an organic second event.
- `none`: rail hidden.

Selection priority:

1. Same canonical venue ID and same date.
2. Same canonical venue ID within the currently selected date window.
3. Same exact-location stack only when the coordinates are verified and events are genuinely co-located.
4. Eligible sponsored placement.
5. Hide.

Never use approximate-location stacks to imply two events are at the same venue.

### Multiple events

When more than two events share a verified venue, show the best secondary event in the rail and provide a compact `+N more here` affordance. Opening it must expose a keyboard-accessible list, not a tiny carousel.

## Image direction

The photo should support the place and activity without pretending to document the current event.

Preferred sourcing order:

1. Rights-cleared historical image of the exact park, venue, block, or neighborhood.
2. Rights-cleared historical image showing the same type of activity at that location.
3. Rights-cleared archival neighborhood image from a relevant era.
4. Rights-cleared 1960s–1980s documentary image that closely matches the activity and borough context.
5. Current official event image only when no stronger archival choice exists and its reuse is permitted.
6. NYC In Focus-owned image.
7. Designed fallback artwork.

Preferred visual character:

- Black-and-white documentary photography.
- 1960s, 1970s, or early-1980s New York street, park, arts, music, recreation, or neighborhood life.
- Human activity, candid moments, local texture, and strong composition.
- Avoid modern generic stock photography, fake event posters, or images that pull attention away from the event information.

Every image must carry structured provenance. Required fields:

- `image_url`
- `thumbnail_url`
- `alt`
- `caption`
- `creator`
- `source_name`
- `source_url`
- `rights_statement`
- `license_code`
- `license_url` when applicable
- `date_created` or `date_created_display`
- `location_match`: `exact`, `venue`, `neighborhood`, `borough`, `activity_only`, or `fallback`
- `activity_match`: boolean
- `is_archival`: boolean
- `is_ai_generated`: boolean
- `review_status`: `approved`, `needs_review`, or `rejected`
- `reviewed_by`
- `reviewed_at`
- `crop_focus_x` and `crop_focus_y` when needed

Never hotlink a third-party archival file unless its terms explicitly permit it and the source is stable. Prefer an approved local derivative with the original source and rights metadata preserved.

### Archival disclosure

Do not let an archival photograph imply that it depicts the listed event today. Use concise visible disclosure such as:

- `Archive photo, 1974`
- `Historical photo of the park`
- `Archive image; not the current event`

The full source and rights statement may live in the expanded details or accessible description.

### AI imagery

AI-generated imagery may be used for design prototypes and clearly identified fallback illustrations. It must not be represented as a historical photograph or documentary evidence. Production event cards should prefer real, rights-cleared archival or NYC In Focus-owned photographs.

## Data contract

Add optional public-safe fields without breaking existing event records:

```json
{
  "display_media": {
    "primary": {
      "image_url": "",
      "thumbnail_url": "",
      "alt": "",
      "caption": "",
      "creator": "",
      "source_name": "",
      "source_url": "",
      "rights_statement": "",
      "license_code": "",
      "license_url": "",
      "date_created_display": "",
      "location_match": "exact",
      "activity_match": true,
      "is_archival": true,
      "is_ai_generated": false,
      "review_status": "approved",
      "reviewed_by": "",
      "reviewed_at": "",
      "crop_focus_x": 0.5,
      "crop_focus_y": 0.5
    }
  },
  "venue_identity": {
    "canonical_venue_id": "",
    "canonical_venue_name": "",
    "location_confidence": "verified"
  },
  "secondary_slot": {
    "mode": "second_event",
    "event_id": "",
    "label": "Also here"
  }
}
```

The renderer must remain functional when all new fields are absent.

## Sponsored placement rules

- Label visibly as `Sponsored` and expose the same label to screen readers.
- Keep sponsored data separate from event data.
- Never let payment alter event verification, editorial medals, location confidence, or public-safety status.
- Do not display an ad in place of a real eligible second event unless the product owner explicitly changes the priority rule.
- Require campaign ID, advertiser name, destination URL, start/end dates, creative asset rights, and approval status.
- Sanitize destination URLs and use safe external-link attributes.
- Track aggregate impressions/clicks only under the site privacy policy. Do not add invasive location tracking.

## Responsive design

Desktop target:

- Main card width approximately 520–680 px depending on viewport.
- Image 38–44% of card width.
- Lower rail attached visually but implemented as a separate semantic region.

Mobile target:

- Maximum width `calc(100vw - 24px)`.
- Image above text, approximately 16:9 or 4:3 depending on available height.
- No horizontal scrolling.
- Touch targets at least 44 px.
- Long titles wrap without covering the close control.
- Lower rail may wrap to two lines but must remain readable.

## Accessibility

- Use semantic heading and definition/list structure where appropriate.
- Maintain logical reading order independent of visual columns.
- All functionality must work by keyboard.
- Focus must move into expanded event lists and return to the trigger on close.
- Use descriptive alt text; do not repeat the title as alt text.
- Decorative icons use `aria-hidden="true"`.
- Meet WCAG 2.2 AA contrast and focus visibility.
- Respect reduced motion.
- Do not depend on color alone to distinguish organic and sponsored content.

## Performance and resilience

- Render event text immediately; image loading must not block popup opening.
- Use responsive derivatives, `srcset`, fixed aspect-ratio containers, lazy decoding, and an intentional fallback.
- Prevent layout shift.
- Time out failed images and replace them cleanly.
- Cache approved media manifests.
- Do not fetch image-search results live in the user’s browser.
- Sanitize all feed-provided text and URLs.
- Preserve current popup behavior when Event Card V2 is disabled.

## Implementation plan

### Phase 0 — architecture and safety

- Work on `feat/event-card-v2-production` or a child branch.
- Document current popup renderer, stack behavior, CSS, feed schema, and deployment gates.
- Add a query-parameter or build-time feature flag. Default production behavior remains unchanged.
- Record rollback steps.

### Phase 1 — coded component prototype

Build the Event Card V2 renderer against fixture data covering:

- Single event with approved archival image.
- Single event without image.
- Same-venue second event.
- More than two same-venue events.
- Sponsored lower rail.
- No lower rail.
- Long title and long address.
- Location pending.
- Mobile and desktop.
- Image failure.

### Phase 2 — feed and media manifest

- Add backward-compatible event media and canonical venue fields.
- Build a separate approved media manifest keyed by stable event ID or reusable place/activity key.
- Add validation that blocks unreviewed, missing-rights, AI-as-archive, or broken media from public output.
- Keep internal rights-review notes out of public feeds.

### Phase 3 — integration

- Connect the renderer to existing Leaflet popup and exact-location stack logic.
- Keep existing list, filters, map controls, and popup close behavior intact.
- Ensure the second-event rail opens the correct event without losing map state.

### Phase 4 — QA

Test:

- Desktop and mobile breakpoints.
- Keyboard and screen reader behavior.
- Exact-location versus approximate-location grouping.
- Text-only fallback.
- Slow and failed images.
- Sponsored labeling.
- Rights/provenance display.
- Regression against current map controls, event list, filters, location control, clustering, and WordPress embed.

### Phase 5 — canary and release

- Merge only after code review, automated tests, visual comparison, and human viewport QA.
- Release behind the feature flag first.
- Use a new cache-bust token only after Pages deploy and QA.
- Update the WordPress map iframe only in the approved release window.
- Keep the prior runtime token and rollback instructions available.

## Team workstreams

### Front-end product engineer

Own component DOM, styling, responsive states, Leaflet integration, keyboard behavior, and image loading resilience.

### Feed/data engineer

Own backward-compatible schema, venue identity, second-event resolution, approved media manifest, validation, and public/private field separation.

### Archival image researcher

Find candidate images from authoritative archives and collections. Record exact source, creator, date, location relevance, rights statement, and reuse terms. Do not approve rights personally unless assigned that authority.

### Rights and standards editor

Approve or reject each candidate for public use, confirm required credit/disclosure, and block ambiguous rights.

### QA/accessibility engineer

Own fixtures, automated regression coverage, viewport testing, keyboard/screen-reader checks, sponsored labeling tests, and release evidence.

### Advertising operations lead

Define campaign eligibility, approvals, labeling, dates, destination safety, and reporting. Advertising must remain separate from event verification and editorial ranking.

## Acceptance criteria

The work is ready for release only when:

- Event cards match the approved image-led design direction on desktop and mobile.
- Current event text remains usable with no image or failed image.
- Archival images are clearly disclosed and rights-cleared.
- A real same-venue event outranks an ad in the lower rail.
- Approximate locations never create false co-location.
- Sponsored content is unmistakably labeled.
- No internal workflow data leaks publicly.
- Current map controls and event list still work.
- Automated tests pass.
- Human visual and accessibility QA pass.
- Rollback is documented and tested.

## Decision authority

Howard Weiss is the product owner and final release authority. Do not deploy to production, change the public WordPress map shell, or alter advertising priority without explicit approval.
