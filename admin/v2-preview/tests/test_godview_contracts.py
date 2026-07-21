"""GodView V2 preview contract tests (GV2-2). Standard library only.

Validates the 17 fixtures against their 17 JSON Schemas (Draft 2020-12 shape) and
enforces the GV2-2 governance invariants. If `jsonschema` is importable it is used
for Draft 2020-12 validation in addition to the standard-library invariant checks;
otherwise the custom standard-library validator below is used. No dependency is
installed. Negative tests mutate data in memory only and never modify fixtures.
"""
from __future__ import annotations

import copy
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # admin/v2-preview
SCHEMAS = ROOT / "schemas"
FIXTURES = ROOT / "fixtures"
MAP_PATH = SCHEMAS / "schema-fixture-map.json"

SUPPORTED_SCHEMA_KEYWORDS = [
    "$schema", "$id", "title", "type", "const", "enum", "properties", "required",
    "additionalProperties", "items", "minItems", "maxItems", "uniqueItems",
    "minimum", "maximum", "minLength", "maxLength", "pattern", "format(uri)",
]

try:  # optional; never installed by this suite
    import jsonschema  # type: ignore
    from jsonschema import Draft202012Validator  # type: ignore
    HAVE_JSONSCHEMA = True
    VALIDATOR_ENGINE = "jsonschema_draft2020_12"
except Exception:
    HAVE_JSONSCHEMA = False
    VALIDATOR_ENGINE = "custom_stdlib_contract_validator_v1"


def _stdlib_validate(inst, sc, path="$"):
    errs = []
    if "const" in sc:
        if inst != sc["const"]:
            errs.append(f"{path}: const {sc['const']!r} != {inst!r}")
        return errs
    if "enum" in sc and inst not in sc["enum"]:
        errs.append(f"{path}: {inst!r} not in enum")
    t = sc.get("type")
    if t:
        types = t if isinstance(t, list) else [t]

        def chk(tp):
            if tp == "integer":
                return isinstance(inst, int) and not isinstance(inst, bool)
            if tp == "number":
                return isinstance(inst, (int, float)) and not isinstance(inst, bool)
            if tp == "boolean":
                return isinstance(inst, bool)
            if tp == "string":
                return isinstance(inst, str)
            if tp == "array":
                return isinstance(inst, list)
            if tp == "object":
                return isinstance(inst, dict)
            if tp == "null":
                return inst is None
            return True

        if not any(chk(tp) for tp in types):
            errs.append(f"{path}: type {t} mismatch ({type(inst).__name__})")
            return errs
    if isinstance(inst, str):
        if "pattern" in sc and not re.search(sc["pattern"], inst):
            errs.append(f"{path}: pattern")
        if "maxLength" in sc and len(inst) > sc["maxLength"]:
            errs.append(f"{path}: maxLength")
        if "minLength" in sc and len(inst) < sc["minLength"]:
            errs.append(f"{path}: minLength")
        if sc.get("format") == "uri" and not re.match(r"^[a-z][a-z0-9+.\-]*:", inst):
            errs.append(f"{path}: uri")
    if (not isinstance(inst, bool)) and isinstance(inst, (int, float)):
        if "minimum" in sc and inst < sc["minimum"]:
            errs.append(f"{path}: minimum")
        if "maximum" in sc and inst > sc["maximum"]:
            errs.append(f"{path}: maximum")
    if isinstance(inst, list):
        if "minItems" in sc and len(inst) < sc["minItems"]:
            errs.append(f"{path}: minItems")
        if "maxItems" in sc and len(inst) > sc["maxItems"]:
            errs.append(f"{path}: maxItems")
        if sc.get("uniqueItems"):
            seen = [json.dumps(x, sort_keys=True) for x in inst]
            if len(seen) != len(set(seen)):
                errs.append(f"{path}: uniqueItems")
        if "items" in sc:
            for i, it in enumerate(inst):
                errs += _stdlib_validate(it, sc["items"], f"{path}[{i}]")
    if isinstance(inst, dict):
        props = sc.get("properties", {})
        for r in sc.get("required", []):
            if r not in inst:
                errs.append(f"{path}.{r}: required missing")
        if sc.get("additionalProperties") is False:
            for k in inst:
                if k not in props:
                    errs.append(f"{path}.{k}: additional property")
        for k, v in inst.items():
            if k in props:
                errs += _stdlib_validate(v, props[k], f"{path}.{k}")
    return errs


def validation_errors(inst, sc):
    if HAVE_JSONSCHEMA:
        return [e.message for e in Draft202012Validator(sc).iter_errors(inst)]
    return _stdlib_validate(inst, sc)


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


MAPPINGS = load(MAP_PATH)["mappings"]
FIXTURE_FILES = sorted(str(p.relative_to(FIXTURES)) for p in FIXTURES.rglob("*.json"))
SCHEMA_FILES = sorted(str(p.relative_to(SCHEMAS)) for p in SCHEMAS.rglob("*.schema.json"))


def fixture(name):
    return load(FIXTURES / name)


def schema_for(fixture_rel):
    for m in MAPPINGS:
        if m["fixture"] == f"fixtures/{fixture_rel}":
            return load(ROOT / m["schema"])
    raise KeyError(fixture_rel)


class GodViewContractTests(unittest.TestCase):
    def test_00_all_fixtures_validate_against_mapped_schema(self):
        for m in MAPPINGS:
            fx = load(ROOT / m["fixture"])
            sc = load(ROOT / m["schema"])
            self.assertEqual(validation_errors(fx, sc), [], f"{m['fixture']} failed {m['schema']}")

    def test_01_exactly_17_fixtures_exist(self):
        self.assertEqual(len(FIXTURE_FILES), 17, FIXTURE_FILES)

    def test_02_exactly_17_schemas_exist(self):
        self.assertEqual(len(SCHEMA_FILES), 17, SCHEMA_FILES)

    def test_03_exactly_17_one_to_one_mappings(self):
        self.assertEqual(len(MAPPINGS), 17)
        fixtures = [m["fixture"] for m in MAPPINGS]
        schemas = [m["schema"] for m in MAPPINGS]
        self.assertEqual(len(set(fixtures)), 17, "duplicate fixtures in map")
        self.assertEqual(len(set(schemas)), 17, "duplicate schemas in map")
        for m in MAPPINGS:
            self.assertTrue((ROOT / m["fixture"]).exists(), m["fixture"])
            self.assertTrue((ROOT / m["schema"]).exists(), m["schema"])

    def test_04_every_fixture_fixture_true_operational_false(self):
        for f in FIXTURE_FILES:
            d = fixture(f)
            self.assertIs(d.get("fixture"), True, f)
            self.assertIs(d.get("operational"), False, f)

    def test_05_every_fixture_schema_version(self):
        for f in FIXTURE_FILES:
            self.assertEqual(fixture(f).get("schema_version"), "1.0.0-fixture", f)

    def test_06_v1_remains_production_authority(self):
        self.assertEqual(fixture("global.json")["authoritative_production_version"], "V1")
        self.assertEqual(fixture("v1/summary.json")["authority"], "PRODUCTION")

    def test_07_v2_has_no_production_write_or_cutover_authority(self):
        self.assertEqual(fixture("v2/summary.json")["production_authority"], "NONE")
        self.assertIs(fixture("global.json")["write_controls_allowed"], False)
        self.assertEqual(fixture("v2/migration.json")["cutover_status"], "LOCKED")
        repos = {r["name"]: r for r in fixture("v2/repositories.json")["repositories"]}
        self.assertEqual(repos["setoxxx/nycif-field-desk"]["authority"], "PREVIEW_ONLY")
        self.assertEqual(repos["setoxxx/nycif-live-feeds"]["authority"], "NOT_YET_IMPLEMENTED")
        forbidden = {"PRODUCTION", "PRODUCTION_UI", "PRODUCTION_FEEDS", "WRITE", "DEPLOY",
                     "PROMOTE", "CUTOVER", "AUTHORIZED"}
        for c in fixture("v2/enigma-core.json")["components"]:
            self.assertNotIn(c["status"], forbidden, c)

    def test_08_five_acs_groups_contract_only(self):
        groups = fixture("v2/cultural.json")["required_groups"]
        ids = [g["group_id"] for g in groups]
        self.assertEqual(sorted(ids), ["B02001", "B03001", "B04006", "B05003", "B05006"])
        self.assertEqual(len(set(ids)), 5)
        for g in groups:
            self.assertEqual(
                set(g["status"]),
                {"REQUIRED_BY_CONTRACT", "NOT_ACQUIRED_IN_REIMPLEMENTATION", "ACQUISITION_UNAUTHORIZED"},
                g,
            )
            self.assertEqual(len(g["status"]), 3, g)

    def test_09_no_fixture_claims_checksum_equivalence_verified(self):
        forbidden = [
            r"checksum[s]?\s+(?:equivalence\s+)?verified",
            r"checksum[s]?\s+match",
            r"checksum\s+equivalence\s+(?:confirmed|established|proven)",
        ]
        for f in FIXTURE_FILES:
            text = json.dumps(fixture(f)).lower()
            for pat in forbidden:
                self.assertIsNone(re.search(pat, text), f"{f}: forbidden checksum-equivalence claim")
            if "checksum" in text:
                self.assertTrue(
                    any(k in text for k in ("lost", "no equivalence", "not permitted", "unavailable")),
                    f"{f}: checksum mentioned without a no-equivalence disclaimer",
                )

    def test_10_unknown_values_not_silently_zero(self):
        for f in ("v1/repositories.json", "v2/repositories.json"):
            for r in fixture(f)["repositories"]:
                self.assertIsInstance(r["ci"], str, f)
                self.assertIn(r["ci"], {"UNKNOWN", "PENDING", "PASS", "FAIL"}, f)
        self.assertTrue(any(r["ci"] == "UNKNOWN" for r in fixture("v1/repositories.json")["repositories"]))

    def test_11_no_paths_credentials_tokens_phones_or_private_emails(self):
        patterns = [
            r"/Users/", r"/home/", r"[A-Za-z]:\\\\",
            r"github_pat_[A-Za-z0-9_]{20,}", r"gh[pousr]_[A-Za-z0-9]{20,}",
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----", r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
            r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b",
            r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}",
        ]
        for f in FIXTURE_FILES:
            text = json.dumps(fixture(f))
            for pat in patterns:
                self.assertIsNone(re.search(pat, text), f"{f}: matched {pat}")

    def test_12_reject_html_js_and_shell_payloads(self):
        sc = schema_for("v1/alerts.json")
        for payload in ("<script>alert(1)</script>", "$(rm -rf /)", "`whoami`", "${IFS}"):
            bad = copy.deepcopy(fixture("v1/alerts.json"))
            bad["alerts"][0]["detail"] = payload
            self.assertNotEqual(validation_errors(bad, sc), [], f"payload accepted: {payload}")
        badurl = copy.deepcopy(fixture("v1/map.json"))
        badurl["embed_url"] = "javascript:alert(1)"
        self.assertNotEqual(validation_errors(badurl, schema_for("v1/map.json")), [])

    def test_13_controlled_vocabularies_enforced(self):
        # positive: all fixtures validate (enums enforced); negative: bad enum rejected
        for m in MAPPINGS:
            self.assertEqual(validation_errors(load(ROOT / m["fixture"]), load(ROOT / m["schema"])), [])
        bad = copy.deepcopy(fixture("v1/alerts.json"))
        bad["alerts"][0]["severity"] = "NOT_A_SEVERITY"
        self.assertNotEqual(validation_errors(bad, schema_for("v1/alerts.json")), [])

    def test_14_reject_negative_counts_and_percentages(self):
        bad_c = copy.deepcopy(fixture("v1/events.json"))
        bad_c["approved_event_count"] = -1
        self.assertNotEqual(validation_errors(bad_c, schema_for("v1/events.json")), [])
        bad_p = copy.deepcopy(fixture("v1/summary.json"))
        bad_p["production_health_percent"] = -5
        self.assertNotEqual(validation_errors(bad_p, schema_for("v1/summary.json")), [])

    def test_15_reject_percentage_over_100(self):
        bad = copy.deepcopy(fixture("v2/summary.json"))
        bad["architecture_completion_percent"] = 150
        self.assertNotEqual(validation_errors(bad, schema_for("v2/summary.json")), [])

    def test_16_reject_missing_required_field(self):
        bad = copy.deepcopy(fixture("global.json"))
        del bad["authoritative_production_version"]
        self.assertNotEqual(validation_errors(bad, schema_for("global.json")), [])

    def test_17_reject_additional_property(self):
        bad = copy.deepcopy(fixture("v1/feeds.json"))
        bad["unauthorized_extra"] = "x"
        self.assertNotEqual(validation_errors(bad, schema_for("v1/feeds.json")), [])

    def test_18_reject_duplicate_fixture_mappings(self):
        dup = MAPPINGS + [MAPPINGS[0]]
        fixtures = [m["fixture"] for m in dup]
        self.assertNotEqual(len(fixtures), len(set(fixtures)), "duplicate should be detectable")
        # the real mapping has no duplicates
        real = [m["fixture"] for m in MAPPINGS]
        self.assertEqual(len(real), len(set(real)))


if __name__ == "__main__":
    unittest.main()
