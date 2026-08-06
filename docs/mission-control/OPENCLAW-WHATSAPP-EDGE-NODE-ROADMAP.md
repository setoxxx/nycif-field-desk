# NYC In Focus Mission Control: OpenClaw, WhatsApp, and Edge-Node Roadmap

Status: future architecture, no production activation

Product owner: Howard Weiss

## Goal

Evolve Mission Control into an approval-oriented agent that can send concise operational decisions to Howard by WhatsApp, accept explicit approve/reject/defer responses, record the decision in GitHub, and continue only within a narrowly defined authorization policy.

## Architecture decision

Use the older Mac as a private edge/control node, not as the public website, public webhook endpoint, primary database, or only copy of operational state.

The public app and messaging gateway must remain available when the Mac is asleep, offline, rebooting, or disconnected.

Recommended split:

1. Public application layer
   - WordPress remains the editorial/publication surface.
   - GitHub Pages or a later CDN/application host serves map assets.
   - Public APIs, webhooks, and approval callbacks run on a managed cloud endpoint.

2. Mission Control layer
   - Scheduled cloud jobs collect aggregate metrics.
   - GitHub issues/projects remain the system of record for work and approvals.
   - A small durable database stores approval state, message IDs, idempotency keys, and audit history.
   - Transactional email and WhatsApp are delivery channels, not the source of truth.

3. Private Mac edge node
   - OpenClaw Gateway or equivalent local agent runtime.
   - Local administrative tools, browser automation, private files, and operator-only workflows.
   - Read-only monitoring by default.
   - No inbound router port forwarding.
   - Remote access only through a private authenticated tunnel or managed relay.
   - Automatic launch after reboot, health heartbeat, local log rotation, and encrypted secrets.

## WhatsApp approval flow

Example message:

NYCIF APPROVAL REQUIRED
Event Card V2 release candidate passed 42/42 checks.
Risk: low
Rollback: previous runtime retained

[Approve]
[Reject]
[Defer 24h]
[Open evidence]

Required controls:

- Only pre-approved administrative phone numbers may respond.
- Business-initiated notifications use approved WhatsApp templates.
- Responses are received by a public webhook and validated before use.
- Every approval includes a one-time token, expiry, action scope, target commit, environment, and rollback reference.
- Duplicate webhook deliveries are idempotent.
- Approval messages never contain GitHub tokens, API keys, private-source details, or sensitive financial data.
- High-risk actions require a second confirmation or manual GitHub approval.
- No free-text message may be interpreted as permission to deploy.
- The agent records APPROVED, REJECTED, DEFERRED, EXPIRED, or SUPERSEDED in an immutable audit log.

## Authorization tiers

### Tier 0: notify only

- health reports
- capacity warnings
- revenue summaries
- failed refreshes
- expiring credentials

### Tier 1: reversible operational actions

- rerun a failed workflow
- create or update a GitHub issue
- disable a feature flag
- send a test report

Requires one explicit approval.

### Tier 2: release actions

- merge an approved pull request
- deploy a reviewed runtime
- change a public feature flag
- activate a new ad placement

Requires explicit approval tied to an exact commit and environment.

### Tier 3: irreversible or financial actions

- delete data
- change DNS
- buy a service or increase a spending limit
- sign an advertising contract
- rotate ownership credentials
- enable international data collection with new legal obligations

Never automatic. Require direct manual action outside WhatsApp or two independent confirmations.

## Mac suitability gate

A five-year-old Mac may be suitable for the private edge node when it passes:

- supported macOS version for the chosen runtime;
- stable wired Ethernet where possible;
- FileVault enabled;
- automatic security updates;
- sufficient free storage with a 30 percent reserve;
- no unresolved disk-health warnings;
- restart after power failure configured;
- sleep disabled only while connected to power;
- automatic service launch after login or boot;
- temperature and memory pressure remain normal under a 72-hour soak test;
- UPS recommended for 24/7 operation;
- daily encrypted configuration backup;
- heartbeat alerts when the node is unreachable.

The Mac must not hold the only copy of data, credentials, reports, or audit logs.

## Geographic expansion

Build geography as configuration and data partitions rather than hard-coded NYC rules.

Recommended hierarchy:

- country
- first-level administrative area
- metro or county
- municipality
- neighborhood
- venue

Each region requires:

- timezone
- locale
- date and address formatting
- currency
- map bounds
- source registry
- category taxonomy mapping
- legal/privacy policy
- advertising eligibility
- emergency and public-service labeling rules
- data-retention policy

Expansion phases:

1. New York City
2. New York State and selected U.S. metros/counties
3. United States national partitioning
4. selected international pilots
5. broader international rollout after privacy, localization, data-license, and moderation review

Do not load every country into one undifferentiated feed or one repository. Use region-specific manifests, storage partitions, caches, and health reports.

## Email architecture

Do not make the WordPress mail function the sole delivery system for Mission Control.

WordPress may trigger editorial notifications, but operational and executive reports should use a dedicated transactional email provider with:

- API delivery
- verified sending domain
- SPF, DKIM, and DMARC
- delivery and bounce webhooks
- retry policy
- suppression list
- provider status monitoring
- message IDs saved with the report

GitHub Actions or the Mission Control service sends the report. WordPress remains independent, so a site failure cannot silence infrastructure alerts.

## Scale triggers

Move workloads off the Mac or current static hosting when any of these occur:

- the Mac misses two heartbeats in seven days;
- sustained memory pressure or thermal throttling;
- public webhook availability cannot meet the alerting requirement;
- repository or Pages growth approaches configured capacity thresholds;
- image/media traffic becomes the dominant bandwidth cost;
- one region's refresh delays another region;
- report generation exceeds its delivery window;
- advertising or analytics integrations require durable queues;
- international operations require regional data processing or retention controls.

## Security gates

Before WhatsApp approvals are enabled:

- threat model completed;
- webhook signature validation implemented;
- administrator allowlist implemented;
- short-lived approval tokens implemented;
- action-specific confirmation implemented;
- audit records stored outside public repositories;
- secrets stored only in encrypted secret managers;
- incident-revocation procedure tested;
- lost-phone procedure tested;
- SIM-swap and account-takeover risks documented;
- safe failure mode is no action.

## Delivery phases

Phase 0: documentation and GitHub Mission Control board.

Phase 1: weekly email report using dedicated transactional email; no approvals.

Phase 2: WhatsApp notifications to one approved administrator; links open GitHub evidence; no actions from chat.

Phase 3: approve/reject/defer for Tier 1 reversible actions.

Phase 4: commit-bound Tier 2 release approvals with second confirmation and rollback proof.

Phase 5: OpenClaw local edge node for private operator workflows, after Mac soak test and security review.

Phase 6: multi-region and international control plane with regional partitions and policy packs.

## Non-goals

- Do not expose the old Mac directly to the public internet.
- Do not use the consumer WhatsApp app as an unsupported automation interface.
- Do not let an AI agent spend money, sign contracts, delete data, or deploy an unspecified commit.
- Do not use WordPress email delivery as the only alert channel.
- Do not store sensitive CEO financial reports in a public repository.
