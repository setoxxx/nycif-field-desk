# NYCIF Live Feeds Master Roadmap Recovery Prompt

Use this prompt whenever a ChatGPT conversation is lost, reaches its limit, becomes contradictory, or needs to resume the NYCIF Live Feeds project from repository evidence.

## Copy-and-paste recovery prompt

```text
NYCIF LIVE FEEDS — MASTER ROADMAP RECOVERY AND MILESTONE UPDATE

Repositories:
- Primary operational repository: setoxxx/nycif-live-feeds
- God View / permanent roadmap repository: setoxxx/nycif-field-desk

Permanent roadmap sources:
- setoxxx/nycif-field-desk/admin/data/live-feeds-master-roadmap.json
- setoxxx/nycif-field-desk/admin/data/xri-status.json
- setoxxx/nycif-field-desk/docs/live-feeds-master-roadmap-recovery-prompt.md

Current roadmap identity:
- Track: nycif_live_feeds_project_completion_track
- Current planning phase: XRI-G102
- Exact title: XRI-G102 NYCIF Live Feeds End-to-End Project Completion Roadmap and Current-State Implementation Baseline Gate
- XRI-G102 contract: xri_g102_project_completion_roadmap_current_state_baseline_contract
- XRI-G102 contract version: 0.0

MISSION
Restore the current project state from live GitHub evidence, identify the next incomplete milestone, and prepare only the next explicitly authorized checkpoint or gate. Never rely on chat memory when repository evidence is available.

SOURCE-OF-TRUTH ORDER
1. Live GitHub state on setoxxx/nycif-live-feeds.
2. Immutable pull-request and commit evidence.
3. Approved roadmap artifacts in setoxxx/nycif-field-desk.
4. Current God View snapshot.
5. Conversation history only as a lead requiring verification.

MANDATORY IDENTITY RULE
A phase number alone is not sufficient identity. Historical identity requires:
- exact phase number
- exact title
- track identifier when available
- pull-request number
- branch name
- immutable head or merge SHA
- exact artifact paths

RECOVERED G30-G40 WARNING
The earlier recovered G30-G40 roadmap was partly an intended plan and partly aligned with repository history.
- G30-G34 closely align with the actual merged sequence.
- G35-G40 diverged from the actual merged titles.
- Never rename or reinterpret the actual merged phases to match the recovered plan.
- Use the legacyRoadmapCrosswalk in live-feeds-master-roadmap.json.

CURRENT COMPLETION BASELINE
- Control-framework completion: 90%
- Operational-system completion: 41%
- Overall combined completion: 56%
These values may change only when new evidence satisfies a milestone completion criterion.

CANONICAL MILESTONE ORDER
1. Canonical roadmap and status baseline
2. Current-main executable inventory
3. Fixture-only end-to-end validation
4. Read-only live-source adapter
5. Controlled non-production dry run
6. Human review and disposition
7. Isolated staging
8. Production canary
9. Scheduled operations and monitoring
10. Final project closeout

NON-NEGOTIABLE COMPLETION RULES
- Documentation counts only toward governance.
- Code existence is not execution proof.
- Historical execution is not current-baseline proof.
- A fixture, schema, report, contract, or planning artifact is not runtime completion.
- No category reaches 100% until every exit criterion is evidenced.
- No roadmap item grants production, publishing, staging, registry, WordPress, workflow, or public-map authority.
- Do not assign a future XRI phase number unless Howard separately authorizes it.
- Do not modify data/location_cache.json unless Howard explicitly authorizes that exact write.
- Do not directly update main.
- Do not merge without Howard's explicit approval.

RESTORATION PROCEDURE
1. Verify the current main SHA of setoxxx/nycif-live-feeds.
2. List all open pull requests and open issues.
3. Verify the most recent merged phase and its exact title, PR, branch, and merge SHA.
4. Read live-feeds-master-roadmap.json and xri-status.json.
5. Compare roadmap claims with current repository evidence.
6. Identify stale percentages, statuses, links, blockers, or milestone evidence.
7. Identify the earliest milestone whose exit criteria are not fully satisfied.
8. State the exact next safe gate type without inventing a future XRI number.
9. Ask for no information already available in GitHub or the roadmap.
10. Stop unless Howard explicitly authorizes a write or execution checkpoint.

MILESTONE UPDATE PROCEDURE
After an approved milestone changes:
1. Reverify both repository baselines.
2. Record exact evidence: paths, PRs, commits, test results, hashes, and execution status.
3. Update only the affected milestone fields.
4. Recalculate control-framework, operational-system, and combined completion using the approved method.
5. Update admin/data/live-feeds-master-roadmap.json.
6. Update admin/data/xri-status.json in the same review branch.
7. Update the God View page only when its renderer or labels require a schema change.
8. Preserve the legacy G30-G40 crosswalk unchanged unless new repository evidence proves it factually wrong.
9. Open a review-only pull request.
10. Do not merge automatically.

REQUIRED RESTORATION RETURN
MASTER ROADMAP RECOVERY VERDICT: PASS / FAIL / BLOCKED

Verified live-feeds state:
- Repository:
- Main SHA:
- Open pull requests:
- Open issues:
- Latest merged phase:
- Latest merged PR:
- Latest merge SHA:

Verified God View state:
- Repository:
- Main SHA:
- Roadmap schema:
- Roadmap generated date:
- Snapshot generated date:

Completion:
- Control framework:
- Operational system:
- Overall combined:

Current milestone:
- Number:
- Name:
- Status:
- Completion:
- Unsatisfied exit criteria:

Next safe gate type:
[exact gate type; no future XRI number unless separately authorized]

Required updates:
[list exact roadmap or God View fields that are stale; none if current]

Repository writes authorized:
[yes/no and exact paths]

Problems:
[none or exact blocking condition]

STOP. Do not execute, write, create a branch, open a PR, or continue unless Howard's current instruction explicitly authorizes that action.
```

## Maintenance rule

Update this prompt only when the roadmap's source-of-truth locations, completion methodology, milestone order, or non-negotiable safety rules change. Routine milestone progress belongs in the roadmap JSON and God View snapshot, not in a rewritten recovery procedure.

## END-OF-GATE NEXT-INSTRUCTION REQUIREMENT

1. Every completed gate must end with a final section titled:
   Next Instructions

2. The Next Instructions section must appear at the very bottom of the result.

3. The exact next prompt the user should provide must be placed inside a fenced code block.

4. The next prompt must be selected from the actual gate result:
   - PASS → identify the next authorized project gate
   - BLOCKED → identify the exact blocker-resolution gate
   - FAIL → identify the exact remediation gate
   - INCOMPLETE → identify the smallest safe follow-up gate
   - BLOCKED_FOR_SCOPE_EXPANSION → identify the exact scope-expansion authorization gate

5. The next prompt must never be left implicit.

6. The next prompt must not authorize work that the completed gate did not earn.

7. The result must not continue automatically.

8. The final code block must use this form:

Next Instructions

```text
Okay, provide the next prompt to [exact next authorized action].
```
