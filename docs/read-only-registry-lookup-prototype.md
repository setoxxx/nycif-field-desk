# XRI-G10 — Read-Only Registry Lookup Prototype

## 1. Executive summary

XRI-G10 creates an offline, read-only lookup prototype for the NYCIF XRI Master Location Registry project.

The prototype reads the XRI-G9 offline seed sample artifact and demonstrates safe lookup outcomes without wiring anything into production, public map runtime, WordPress, feeds, staging, or cache systems.

## 2. Project completion

- Completion before G10: 88%
- Expected completion after clean G10 merge: 94%

## 3. Relationship to previous phases

- XRI-G6 created preview-only candidate records.
- XRI-G7 defined operator review decisions.
- XRI-G8 created a review artifact schema and fixture validator.
- XRI-G9 created the first offline seed sample artifact.
- XRI-G10 proves the seed can be queried safely in a read-only prototype.

## 4. What this unlocks

G10 unlocks the next controlled integration planning phase.

After G10, NYCIF has:

- a seed sample artifact
- a seed validator
- a read-only lookup prototype
- sample lookup outcomes
- clear safety boundaries before any public/runtime integration

## 5. Files added

- `tools/xri/read_only_registry_lookup_prototype.py`
- `data/reports/read_only_registry_lookup_prototype_output.sample.json`
- `data/reports/read_only_registry_lookup_prototype_report.json`
- `docs/read-only-registry-lookup-prototype.md`
- `data/reports/xri_project_status.json`

## 6. Lookup inputs

The prototype reads only:

- `data/registry/registry_seed.sample.json`

It may accept a local path override for testing, but it does not fetch remote data.

## 7. Lookup outcomes

Supported outcomes:

- `exact_registry_match`
- `no_match`
- `manual_review_required`
- `seed_record_available_offline_only`

Blocked review examples remain audit-only and do not become registry matches.

## 8. Command

Demo output:

```bash
python3 tools/xri/read_only_registry_lookup_prototype.py
```

Single query:

```bash
python3 tools/xri/read_only_registry_lookup_prototype.py --query "Sample Seed-Ready Location"
```

## 9. Safety guarantees

G10 does not:

- modify `data/location_cache.json`
- read production feed JSON
- write production feed JSON
- touch public map runtime files
- touch WordPress
- touch iframe/embed settings
- touch scheduled workflows
- run live staging
- call external APIs
- fetch SODA data
- approve geocodes
- promote candidates
- create a production registry database
- create a production importer
- add runtime wiring

## 10. Admin/status handling

G10 updates only:

- `data/reports/xri_project_status.json`

No runtime admin UI or public app file is modified.

## 11. Next instruction after G10

After XRI-G10 is merged, ChatGPT should write the controlled integration planning contract:

**XRI-G11 — Internal Registry Review Surface / Admin Status Integration Plan**

G11 should decide how the seed and lookup prototype will be surfaced internally for review without changing the public map or production feeds.

## 12. XRI-G11 is not authorized by this PR

This PR does not authorize XRI-G11 work. G11 requires a new ChatGPT-controlled execution step and review gate.
