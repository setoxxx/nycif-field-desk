# NYC In Focus Mission Control

Status: production workstream draft

Product owner: Howard Weiss

## Mission

Create an administrative-assistant operating layer that tells the product owner, in plain business language, whether the NYC In Focus map is growing, earning revenue, slowing down, failing refreshes, or approaching a hosting, storage, bandwidth, or email-delivery limit.

Mission Control must provide:

1. A GitHub Project for product, operations, capacity, and revenue work.
2. A weekly CEO email with audience, reliability, performance, capacity, cost, and revenue metrics.
3. Exception alerts for outages, stale feeds, blocked refreshes, cost spikes, storage pressure, and major performance regressions.
4. Durable weekly snapshots for month-over-month and year-over-year comparison.

## Executive report

Each report begins with:

- overall status: GREEN, YELLOW, or RED;
- one-sentence business summary;
- three decisions or risks requiring Howard's attention;
- actions already taken;
- approvals needed.

### Audience and product usage

- users, sessions, pageviews, engaged sessions, returning users;
- search traffic and top landing pages;
- map opens, event-card opens, Event List opens;
- filter, search, date, official-details, and directions usage;
- tip-jar opens and payment-provider outbound clicks;
- rewarded-ad prompt views, opt-ins, starts, completions, grants, no-fill, and errors;
- device mix and aggregate geographic distribution.

### Reliability and performance

- public map availability;
- production feed status and age of newest successful refresh;
- failed workflow count;
- JavaScript, image, card-render, and outbound-link failure rates;
- mobile and desktop p75 LCP, INP, CLS, and TTFB;
- map boot time, first usable Event List time, event-card open latency, and image decode latency.

### Capacity and cost

- published site size and 30-day growth;
- repository size and 30-day growth;
- estimated bandwidth;
- generated feed volume;
- media and image-derivative storage;
- build duration and Action artifact/cache storage;
- third-party API usage;
- current monthly spend and projected month-end spend.

### Revenue

- gross and net ad revenue;
- page RPM and session RPM;
- rewarded-ad revenue and completion rate;
- direct sponsorship revenue;
- confirmed tip-jar contributions when available;
- revenue per 1,000 map sessions;
- infrastructure cost per 1,000 map sessions;
- net contribution after infrastructure and platform costs.

## Initial alert thresholds

Tune after 30 days of real traffic.

- P0: public map unavailable for 15 minutes.
- P1: production refresh BLOCKED or no successful refresh within 36 hours.
- P1: event-feed load failure above 5 percent for 30 minutes.
- P2: image failure above 3 percent for one day.
- P1: mobile p75 LCP above 4 seconds for 24 hours.
- P2: mobile p75 LCP above 2.5 seconds for three days.
- P1: p75 INP above 500 milliseconds for 24 hours.
- P2: p75 INP above 200 milliseconds for three days.
- P1: p75 CLS above 0.25 for 24 hours.
- P2: p75 CLS above 0.10 for three days.
- Warning: published site or source repository exceeds 70 percent of an applicable host limit.
- Critical: published site or source repository exceeds 85 percent of an applicable host limit.
- Warning: monthly bandwidth exceeds 70 percent of an applicable soft limit.
- Critical: monthly bandwidth exceeds 85 percent of an applicable soft limit.
- Upgrade review: monthly gross revenue is at least three times the incremental hosting/CDN cost for two consecutive months.

## GitHub Project

Create `NYCIF Mission Control` with these statuses:

- Inbox
- Ready
- In progress
- Blocked
- Review
- Released
- Monitoring

Fields:

- Workstream: Product, Reliability, Capacity, Revenue, Advertising, Editorial Data, Privacy, Security
- Owner
- Severity: P0, P1, P2, P3
- KPI affected
- Monthly cost impact
- Revenue impact
- Target date
- Release gate
- Evidence artifact
- Status summary

Views:

- Executive
- Capacity
- Reliability
- Revenue
- Approvals
- International rollout

## Email architecture

Do not make WordPress mail the sole operational alert system.

Use a dedicated transactional email provider with:

- API delivery;
- verified sending domain;
- SPF, DKIM, and DMARC;
- delivery and bounce webhooks;
- retries and suppression handling;
- provider status monitoring;
- message IDs stored with each report.

A scheduled GitHub Actions workflow or Mission Control service should generate and send reports. WordPress remains independent so a WordPress failure cannot silence infrastructure alerts.

Proposed cadence, pending explicit approval of recipient and delivery provider:

- weekly CEO email Monday at 8:00 AM America/New_York;
- monthly operating review on the first business day;
- immediate email only for P0/P1 exceptions.

Sensitive financial reports and recipient addresses must not be committed to a public repository.

## Advertising and rewarded support

Initial stack:

- conventional advertising: Google AdSense or Google Ad Manager after controlled testing;
- opt-in rewarded support: Google Ad Manager rewarded web format after account approval and policy review;
- future direct neighborhood sponsorships through a separate campaign feed.

Tip-jar copy:

`Support NYC In Focus by watching an ad`

The user must opt in. Recommended non-cash reward:

- activate Supporter Mode for 30 minutes;
- hide ordinary display-ad placements during that period;
- display a short thank-you confirmation.

Do not offer cash, transferable value, gift cards, or donation credit for ad completion.

Advertising cannot affect event verification, editorial ranking, location confidence, public-safety status, or publication eligibility.

## Tip-jar placement

The support button must remain in the top-right safe area above the date strip and map controls. Its panel opens inward from the right edge, must not overflow at 320 px, and must remain keyboard and screen-reader accessible.

The rewarded-ad option remains hidden until provider configuration, consent, policy, accessibility, and failure-state checks pass.

## Privacy

- aggregate executive metrics only;
- no raw IP storage in Mission Control;
- no precise visitor-location history;
- no sale of personal data;
- consent must precede personalized advertising where required;
- analytics and advertising identifiers must be documented in the privacy policy.

## Release gates

Mission Control email cannot go live until metric sources, recipient, cadence, provider secrets, dry-run report, retries, and failure handling are approved and tested.

Rewarded support cannot go live until provider approval, ad-unit IDs, opt-in copy, privacy/consent review, no-fill and error states, performance tests, accessibility tests, and explicit Howard Weiss authorization are complete.

## Rollback

- Feature flags default off.
- Email workflows can be disabled without affecting the public map.
- Rewarded-ad adapters can be removed while preserving the existing tip jar.
- Analytics, advertising, and report failures never block event publication.
