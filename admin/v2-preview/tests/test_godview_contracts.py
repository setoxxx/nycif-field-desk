"""GodView V2 preview contract tests (GV2-2, repaired GV2-2.1). Standard library only.

Validates the 17 fixtures against their 17 JSON Schemas and enforces GV2-2 governance
invariants. If `jsonschema` is importable it is used for Draft 2020-12 validation in
addition to the standard-library checks; otherwise the custom standard-library
validator below is used. No dependency is installed. Negative tests mutate data in
memory only and never modify fixtures.
"""
from __future__ import annotations

import copy
import json
import re
import unittest
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]          # admin/v2-preview
SCHEMAS = ROOT / "schemas"
FIXTURES = ROOT / "fixtures"
MAP_PATH = SCHEMAS / "schema-fixture-map.json"

URI_CAPABILITY = "format(http_https_uri_v1)"
VALIDATED_KEYWORDS = [
    "type", "const", "enum", "properties", "required", "additionalProperties",
    "items", "minItems", "maxItems", "uniqueItems", "minimum", "maximum",
    "minLength", "maxLength", "pattern", URI_CAPABILITY,
]
RECOGNIZED_METADATA_KEYWORDS = ["$schema", "$id", "title"]

try:  # optional; never installed by this suite
    import jsonschema  # type: ignore
    from jsonschema import Draft202012Validator  # type: ignore
    HAVE_JSONSCHEMA = True
    VALIDATOR_ENGINE = "jsonschema_draft2020_12"
except Exception:
    HAVE_JSONSCHEMA = False
    VALIDATOR_ENGINE = "custom_stdlib_contract_validator_v1"


# --------------------------------------------------------------------------- #
# Repair 2 — URI evaluation (format(http_https_uri_v1))
# --------------------------------------------------------------------------- #
def check_http_https_uri(value):
    errs = []
    if not isinstance(value, str):
        return ["uri: not a string"]
    if any(ord(c) < 32 or ord(c) == 127 for c in value):
        errs.append("uri: control character")
    if re.search(r"\s", value):
        errs.append("uri: whitespace")
    try:
        parts = urlsplit(value)
    except Exception:
        errs.append("uri: parse failure")
        return errs
    if parts.scheme not in ("http", "https"):
        errs.append("uri: scheme not http/https")
    if not parts.hostname:
        errs.append("uri: missing hostname")
    if parts.username:
        errs.append("uri: username present")
    if parts.password:
        errs.append("uri: password present")
    try:
        _ = parts.port  # raises ValueError for an invalid port
    except ValueError:
        errs.append("uri: invalid port")
    return errs


# --------------------------------------------------------------------------- #
# Repair 2 — custom validator: const no longer short-circuits other constraints
# --------------------------------------------------------------------------- #
def _stdlib_validate(inst, sc, path="$"):
    errs = []
    if "const" in sc and inst != sc["const"]:
        errs.append(f"{path}: const {sc['const']!r} != {inst!r}")
        # no early return — continue evaluating any other applicable constraints
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
        if sc.get("format") == "uri":
            errs += [f"{path}: {e}" for e in check_http_https_uri(inst)]
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
        base = [e.message for e in Draft202012Validator(sc).iter_errors(inst)]
        # augment with the http_https_uri checks jsonschema does not perform
        for key, ps in sc.get("properties", {}).items():
            if isinstance(ps, dict) and ps.get("format") == "uri" and key in inst:
                base += check_http_https_uri(inst[key])
        return base
    return _stdlib_validate(inst, sc)


# --------------------------------------------------------------------------- #
# Repair 3 — public-safe content validation (GodView governance, not a JSON keyword)
# --------------------------------------------------------------------------- #
_PUBLIC_SAFE_PATTERNS = [
    ("local_macos_path", re.compile(r"/Users/")),
    ("local_linux_path", re.compile(r"/home/")),
    ("windows_abs_path", re.compile(r"[A-Za-z]:\\")),
    ("path_traversal", re.compile(r"\.\.")),
    ("github_token", re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}")),
    ("private_key_marker", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("aws_access_key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("phone_number", re.compile(r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b")),
    ("email_address", re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")),
    ("html_or_tag", re.compile(r"[<>]")),
    ("javascript_uri", re.compile(r"(?i)javascript:")),
    ("shell_command_substitution", re.compile(r"\$\(")),
    ("template_substitution", re.compile(r"\$\{")),
    ("backtick_execution", re.compile(r"`")),
]


def _scan_string(s, where, errs):
    if any(ord(c) < 32 or ord(c) == 127 for c in s):
        errs.append(f"{where}: control/null character")
    for name, rx in _PUBLIC_SAFE_PATTERNS:
        if rx.search(s):
            errs.append(f"{where}: {name}")


def validate_public_safe_content(instance, where="$"):
    errs = []
    if isinstance(instance, dict):
        for k, v in instance.items():
            _scan_string(str(k), f"{where}.<key:{k}>", errs)
            errs += validate_public_safe_content(v, f"{where}.{k}")
    elif isinstance(instance, list):
        for i, v in enumerate(instance):
            errs += validate_public_safe_content(v, f"{where}[{i}]")
    elif isinstance(instance, str):
        _scan_string(instance, where, errs)
    return errs


# --------------------------------------------------------------------------- #
# Repair 1 — schema-fixture map validation
# --------------------------------------------------------------------------- #
EXPECTED_FIXTURES = sorted(f"fixtures/{p.relative_to(FIXTURES)}" for p in FIXTURES.rglob("*.json"))
EXPECTED_SCHEMAS = sorted(f"schemas/{p.relative_to(SCHEMAS)}" for p in SCHEMAS.rglob("*.schema.json"))


def validate_schema_fixture_map(document):
    errs = []
    if not isinstance(document, dict):
        return ["map: not an object"]
    meta = {"schema_version": "1.0.0", "artifact_kind": "SCHEMA_FIXTURE_MAP",
            "fixture": False, "operational": False}
    for k, v in meta.items():
        if document.get(k) != v:
            errs.append(f"map: metadata {k} != {v!r}")
    mappings = document.get("mappings")
    if not isinstance(mappings, list):
        return errs + ["map: mappings not a list"]
    if len(mappings) != 17:
        errs.append(f"map: expected 17 mappings, found {len(mappings)}")
    fixtures, schemas = [], []
    root_resolved = ROOT.resolve()
    for i, m in enumerate(mappings):
        if not isinstance(m, dict):
            errs.append(f"map[{i}]: not an object")
            continue
        for field in ("fixture", "schema"):
            if field not in m:
                errs.append(f"map[{i}]: missing {field}")
        for field in ("fixture", "schema"):
            val = m.get(field)
            if not isinstance(val, str):
                continue
            if ".." in val:
                errs.append(f"map[{i}].{field}: path traversal")
            if val.startswith("/") or re.match(r"^[A-Za-z]:\\", val):
                errs.append(f"map[{i}].{field}: absolute path")
            try:
                resolved = (ROOT / val).resolve()
                if root_resolved not in resolved.parents and resolved != root_resolved:
                    errs.append(f"map[{i}].{field}: outside admin/v2-preview")
            except Exception:
                errs.append(f"map[{i}].{field}: unresolvable")
            if not (ROOT / val).exists():
                errs.append(f"map[{i}].{field}: missing file {val}")
        if isinstance(m.get("fixture"), str):
            fixtures.append(m["fixture"])
        if isinstance(m.get("schema"), str):
            schemas.append(m["schema"])
    if len(fixtures) != len(set(fixtures)):
        errs.append("map: duplicate fixture paths")
    if len(schemas) != len(set(schemas)):
        errs.append("map: duplicate schema paths")
    if set(fixtures) != set(EXPECTED_FIXTURES):
        errs.append("map: incomplete fixture coverage")
    if set(schemas) != set(EXPECTED_SCHEMAS):
        errs.append("map: incomplete schema coverage")
    return errs


# --------------------------------------------------------------------------- #
def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


MAP_DOC = load(MAP_PATH)
MAPPINGS = MAP_DOC["mappings"]
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
    # 1-4 structure
    def test_01_exactly_17_fixtures_exist(self):
        self.assertEqual(len(FIXTURE_FILES), 17, FIXTURE_FILES)

    def test_02_exactly_17_schemas_exist(self):
        self.assertEqual(len(SCHEMA_FILES), 17, SCHEMA_FILES)

    def test_03_map_is_valid_17_one_to_one(self):
        self.assertEqual(validate_schema_fixture_map(MAP_DOC), [], "real map must validate")
        self.assertEqual(len(MAPPINGS), 17)

    def test_04_every_fixture_validates_against_mapped_schema(self):
        for m in MAPPINGS:
            self.assertEqual(validation_errors(load(ROOT / m["fixture"]), load(ROOT / m["schema"])),
                             [], f"{m['fixture']} failed {m['schema']}")

    # 5 fixture metadata
    def test_05_fixture_metadata(self):
        for f in FIXTURE_FILES:
            d = fixture(f)
            self.assertEqual(d.get("schema_version"), "1.0.0-fixture", f)
            self.assertIs(d.get("fixture"), True, f)
            self.assertIs(d.get("operational"), False, f)

    # 6-8 governance
    def test_06_v1_production_authority(self):
        self.assertEqual(fixture("global.json")["authoritative_production_version"], "V1")
        self.assertEqual(fixture("v1/summary.json")["authority"], "PRODUCTION")

    def test_07_v2_no_authority(self):
        self.assertEqual(fixture("v2/summary.json")["production_authority"], "NONE")
        self.assertIs(fixture("global.json")["write_controls_allowed"], False)
        self.assertEqual(fixture("v2/migration.json")["cutover_status"], "LOCKED")
        repos = {r["name"]: r for r in fixture("v2/repositories.json")["repositories"]}
        self.assertEqual(repos["setoxxx/nycif-field-desk"]["authority"], "PREVIEW_ONLY")
        self.assertEqual(repos["setoxxx/nycif-live-feeds"]["authority"], "NOT_YET_IMPLEMENTED")
        forbidden = {"PRODUCTION", "PRODUCTION_UI", "PRODUCTION_FEEDS", "WRITE",
                     "DEPLOY", "PROMOTE", "CUTOVER", "AUTHORIZED"}
        for c in fixture("v2/enigma-core.json")["components"]:
            self.assertNotIn(c["status"], forbidden, c)

    def test_08_five_acs_groups_contract_only(self):
        groups = fixture("v2/cultural.json")["required_groups"]
        ids = [g["group_id"] for g in groups]
        self.assertEqual(sorted(ids), ["B02001", "B03001", "B04006", "B05003", "B05006"])
        self.assertEqual(len(set(ids)), 5)
        for g in groups:
            self.assertEqual(set(g["status"]),
                             {"REQUIRED_BY_CONTRACT", "NOT_ACQUIRED_IN_REIMPLEMENTATION",
                              "ACQUISITION_UNAUTHORIZED"}, g)
            self.assertEqual(len(g["status"]), 3, g)

    # 9 checksum equivalence
    def test_09_no_checksum_equivalence_claim(self):
        forbidden = [r"checksum[s]?\s+(?:equivalence\s+)?verified", r"checksum[s]?\s+match",
                     r"checksum\s+equivalence\s+(?:confirmed|established|proven)"]
        for f in FIXTURE_FILES:
            text = json.dumps(fixture(f)).lower()
            for pat in forbidden:
                self.assertIsNone(re.search(pat, text), f"{f}: forbidden checksum claim")
            if "checksum" in text:
                self.assertTrue(any(k in text for k in ("lost", "no equivalence", "not permitted", "unavailable")), f)

    # 10 unknown values not zero (narrowed to ci fields that exist)
    def test_10_unknown_ci_not_converted_to_zero(self):
        allowed = {"UNKNOWN", "PENDING", "PASS", "FAIL"}
        for f in ("v1/repositories.json", "v2/repositories.json"):
            for r in fixture(f)["repositories"]:
                self.assertIsInstance(r["ci"], str, f)
                self.assertIn(r["ci"], allowed, f)
        self.assertTrue(any(r["ci"] == "UNKNOWN" for r in fixture("v1/repositories.json")["repositories"]))
        # numeric 0 for a ci field must be rejected by the schema
        bad = copy.deepcopy(fixture("v1/repositories.json"))
        bad["repositories"][0]["ci"] = 0
        self.assertNotEqual(validation_errors(bad, schema_for("v1/repositories.json")), [])

    # 11 public-safe passes for all fixtures
    def test_11_public_safe_all_fixtures(self):
        for f in FIXTURE_FILES:
            self.assertEqual(validate_public_safe_content(fixture(f)), [], f)

    # 12-15 public-safe negatives (constructed in memory)
    def test_12_reject_local_paths_and_traversal(self):
        for payload in ("/Users/example/private.json", "/home/example/private.json",
                        "../../private.json", r"C:\Users\x\secret.json"):
            self.assertNotEqual(validate_public_safe_content({"detail": payload}), [], payload)

    def test_13_reject_credentials_and_private_keys(self):
        gh = "ghp_" + ("A" * 36)
        aws = "AKIA" + "".join("A" for _ in range(16))
        for payload in (gh, "-----BEGIN PRIVATE KEY-----", aws):
            self.assertNotEqual(validate_public_safe_content({"detail": payload}), [], payload[:12])

    def test_14_reject_phone_and_email(self):
        for payload in ("212-555-1212", "private@example.com"):
            self.assertNotEqual(validate_public_safe_content({"detail": payload}), [], payload)

    def test_15_reject_html_js_shell(self):
        for payload in ("<script>alert(1)</script>", "javascript:alert(1)", "$(rm -rf /)",
                        "`whoami`", "${IFS}"):
            self.assertNotEqual(validate_public_safe_content({"detail": payload}), [], payload)
        # and the schema-level rejection for an HTML payload in a text field
        bad = copy.deepcopy(fixture("v1/alerts.json"))
        bad["alerts"][0]["detail"] = "<script>alert(1)</script>"
        self.assertNotEqual(validation_errors(bad, schema_for("v1/alerts.json")), [])

    # 16 malformed URIs
    def test_16_reject_malformed_http_https_uris(self):
        for payload in ("https:", "https://", "https:///missing-host", "https:// user.example",
                        "https://user:password@example.com/path", "https://example.com:invalid/path",
                        "javascript:alert(1)"):
            bad = copy.deepcopy(fixture("v1/map.json"))
            bad["embed_url"] = payload
            self.assertNotEqual(validation_errors(bad, schema_for("v1/map.json")), [], payload)

    # 17-20 schema constraints
    def test_17_reject_negative_counts_and_percentages(self):
        bad_c = copy.deepcopy(fixture("v1/events.json"))
        bad_c["approved_event_count"] = -1
        self.assertNotEqual(validation_errors(bad_c, schema_for("v1/events.json")), [])
        bad_p = copy.deepcopy(fixture("v1/summary.json"))
        bad_p["production_health_percent"] = -5
        self.assertNotEqual(validation_errors(bad_p, schema_for("v1/summary.json")), [])

    def test_18_reject_percentage_over_100(self):
        bad = copy.deepcopy(fixture("v2/summary.json"))
        bad["architecture_completion_percent"] = 150
        self.assertNotEqual(validation_errors(bad, schema_for("v2/summary.json")), [])

    def test_19_reject_missing_required(self):
        bad = copy.deepcopy(fixture("global.json"))
        del bad["authoritative_production_version"]
        self.assertNotEqual(validation_errors(bad, schema_for("global.json")), [])

    def test_20_reject_additional_property(self):
        bad = copy.deepcopy(fixture("v1/feeds.json"))
        bad["unauthorized_extra"] = "x"
        self.assertNotEqual(validation_errors(bad, schema_for("v1/feeds.json")), [])

    # 21-24 map validation via validate_schema_fixture_map
    def test_21_reject_duplicate_fixture_mapping(self):
        bad = copy.deepcopy(MAP_DOC)
        bad["mappings"][1]["fixture"] = bad["mappings"][0]["fixture"]
        self.assertNotEqual(validate_schema_fixture_map(bad), [])

    def test_22_reject_duplicate_schema_mapping(self):
        bad = copy.deepcopy(MAP_DOC)
        bad["mappings"][1]["schema"] = bad["mappings"][0]["schema"]
        self.assertNotEqual(validate_schema_fixture_map(bad), [])

    def test_23_reject_missing_coverage(self):
        bad = copy.deepcopy(MAP_DOC)
        bad["mappings"] = bad["mappings"][:-1]  # 16 mappings
        errs = validate_schema_fixture_map(bad)
        self.assertNotEqual(errs, [])

    def test_24_reject_traversal_absolute_and_out_of_root(self):
        for evil in ("../secret.json", "/etc/passwd", "fixtures/../../escape.json"):
            bad = copy.deepcopy(MAP_DOC)
            bad["mappings"][0]["fixture"] = evil
            self.assertNotEqual(validate_schema_fixture_map(bad), [], evil)
        self.assertNotEqual(validate_schema_fixture_map([]), [])
        self.assertNotEqual(validate_schema_fixture_map({"mappings": MAPPINGS}), [])  # missing metadata

    # 25 const no short-circuit
    def test_25_const_does_not_short_circuit(self):
        # const matches but a co-located constraint is violated -> must still error
        self.assertNotEqual(_stdlib_validate("AB", {"const": "AB", "maxLength": 1}), [])
        # const matches and co-located constraint satisfied -> no error
        self.assertEqual(_stdlib_validate("AB", {"const": "AB", "maxLength": 5}), [])


if __name__ == "__main__":
    unittest.main()
