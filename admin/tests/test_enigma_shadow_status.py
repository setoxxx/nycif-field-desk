#!/usr/bin/env python3
"""Tests for the GodView Enigma Shadow Status panel (v01).

Read-only, offline. Exercises the ACTUAL panel JavaScript pure/render layer via a
Node subprocess harness (Node is used only if present; pure-data + render checks
skip with a clear message otherwise). Static safety, secret/PII/path, and
file-scope checks run in pure Python (stdlib only). No dependencies are installed.

Run:  python3 -B -m unittest discover -s admin/tests -t . -p 'test_*.py' -v
"""
import json
import os
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "admin" / "enigma-shadow-status-v01.js"
CSS = ROOT / "admin" / "enigma-shadow-status-v01.css"
FIXTURE = ROOT / "admin" / "fixtures" / "enigma-shadow-bundle-v01.json"
SCHEMA = ROOT / "admin" / "schemas" / "enigma-shadow-bundle-v01.schema.json"
INDEX = ROOT / "admin" / "index.html"

AUTHORIZED = {
    "admin/enigma-shadow-status-v01.js",
    "admin/enigma-shadow-status-v01.css",
    "admin/fixtures/enigma-shadow-bundle-v01.json",
    "admin/schemas/enigma-shadow-bundle-v01.schema.json",
    "admin/tests/test_enigma_shadow_status.py",
    "admin/index.html",
}
PROTECTED_UNCHANGED = [
    "index.html", "app.js", "app-schema-v1-major-all-v01.js", "service-worker.js",
    ".github/workflows/static.yml",
]

NODE = shutil.which("node")

# --- Node harness: dispatch to the real pure functions -----------------------
PURE_HARNESS = r"""
const api = require(process.env.JS);
const req = JSON.parse(require('fs').readFileSync(process.env.REQ, 'utf8'));
let out;
switch (req.op) {
  case 'validate': out = api.validateBundle(req.bundle); break;
  case 'derive':   out = api.deriveMetrics(req.bundle); break;
  case 'project':  out = api.projectEventForInspection(req.arg); break;
  case 'occkey':
    try { out = { ok: true, key: api.computeOccurrenceKey(req.arg) }; }
    catch (e) { out = { ok: false, error: String(e.message) }; }
    break;
  case 'age': out = { days: api.fixtureAgeDays(req.arg, req.now) }; break;
  case 'tz':  out = api.timezoneStatus(req.arg); break;
}
process.stdout.write(JSON.stringify(out));
"""

# --- Node harness: drive the REAL render() through a minimal DOM stub --------
RENDER_HARNESS = r"""
const textSink = [];
function mkEl(tag) {
  return {
    tagName: String(tag || '').toUpperCase(), _attrs: {}, childNodes: [], _text: '',
    get textContent() { return this._text + this.childNodes.map(c => c.textContent || '').join(''); },
    set textContent(v) { this._text = String(v); this.childNodes = []; },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k]; },
    appendChild(c) { this.childNodes.push(c); return c; },
    set innerHTML(v) { throw new Error('innerHTML used'); },
    set outerHTML(v) { throw new Error('outerHTML used'); },
    insertAdjacentHTML() { throw new Error('insertAdjacentHTML used'); },
    querySelector(sel) {
      const cls = sel.replace(/^\./, '');
      const stack = this.childNodes.slice();
      while (stack.length) {
        const n = stack.shift();
        if (n && n._attrs && String(n._attrs.class || '').split(/\s+/).indexOf(cls) !== -1) return n;
        if (n && n.childNodes) for (const c of n.childNodes) stack.push(c);
      }
      return null;
    },
  };
}
global.document = {
  readyState: 'complete',
  createElement: mkEl,
  createTextNode: (s) => ({ nodeType: 3, _text: String(s), childNodes: [], get textContent() { return this._text; } }),
  getElementById: () => null,   // no mount -> boot() no-ops (no fetch)
  addEventListener: () => {},
};
const api = require(process.env.JS);
const req = JSON.parse(require('fs').readFileSync(process.env.REQ, 'utf8'));
const root = mkEl('div');
let threw = null;
try { api.render(root, req.bundle); } catch (e) { threw = String(e.message); }
process.stdout.write(JSON.stringify({ threw, text: root.textContent }));
"""


def _valid_bundle():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _run_node(harness, payload):
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(payload, fh)
        req_path = fh.name
    try:
        env = {**os.environ, "JS": str(JS), "REQ": req_path}
        proc = subprocess.run([NODE, "-e", harness], capture_output=True, text=True, env=env, timeout=30)
        if proc.returncode != 0:
            raise AssertionError("node harness failed: " + proc.stderr.strip())
        return json.loads(proc.stdout)
    finally:
        os.unlink(req_path)


needs_node = unittest.skipIf(NODE is None, "node not available; pure/render checks are manual")


class ArtifactTests(unittest.TestCase):
    def test_00_files_exist(self):
        for p in (JS, CSS, FIXTURE, SCHEMA, INDEX):
            self.assertTrue(p.exists(), p)

    def test_schema_parses(self):
        json.loads(SCHEMA.read_text(encoding="utf-8"))

    def test_fixture_parses_and_classified(self):
        b = _valid_bundle()
        self.assertEqual(b["classification"], "MOCK_FIXTURE_NON_OPERATIONAL")
        self.assertIs(b["fixture"], True)
        self.assertIs(b["operational"], False)


class PureLayerTests(unittest.TestCase):
    @needs_node
    def test_01_valid_fixture(self):
        v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": _valid_bundle()})
        self.assertTrue(v["ok"], v.get("errors"))

    @needs_node
    def test_02_classification_required(self):
        b = _valid_bundle(); del b["classification"]
        v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": b})
        self.assertFalse(v["ok"])
        self.assertTrue(any("classification" in e for e in v["errors"]))

    @needs_node
    def test_03_invalid_non_object(self):
        for bad in (None, "x", [1, 2]):
            v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": bad})
            self.assertFalse(v["ok"], bad)

    @needs_node
    def test_04_unsupported_schema_version(self):
        b = _valid_bundle(); b["bundle_schema_version"] = 2
        v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": b})
        self.assertFalse(v["ok"])
        self.assertTrue(any("bundle_schema_version" in e for e in v["errors"]))

    @needs_node
    def test_05_missing_required_fields(self):
        b = _valid_bundle(); del b["enigma"]
        v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": b})
        self.assertFalse(v["ok"])

    @needs_node
    def test_06_invalid_count_relationships(self):
        b = _valid_bundle(); b["enigma"]["counts"]["silent_loss"] = 1
        v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": b})
        self.assertFalse(v["ok"])

    @needs_node
    def test_07_accepted_rows_vs_distinct_keys(self):
        m = _run_node(PURE_HARNESS, {"op": "derive", "bundle": _valid_bundle()})
        self.assertEqual(m["acceptedRows"], 3)
        self.assertEqual(m["distinctKeys"], 2)
        self.assertEqual(m["collisions"], 1)
        self.assertNotEqual(m["acceptedRows"], m["distinctKeys"])

    @needs_node
    def test_08_duplicate_occurrence_keys_preserved(self):
        m = _run_node(PURE_HARNESS, {"op": "derive", "bundle": _valid_bundle()})
        self.assertEqual(len(m["collisionGroups"]), 1)
        g = m["collisionGroups"][0]
        self.assertEqual(g["accepted_row_count"], 2)
        self.assertEqual(g["distinct_observation_count"], 2)

    @needs_node
    def test_09_no_silent_record_removal(self):
        m = _run_node(PURE_HARNESS, {"op": "derive", "bundle": _valid_bundle()})
        self.assertEqual(len(m["orderedResults"]), 6)
        self.assertEqual(len(m["orderedPreFailures"]), 2)

    @needs_node
    def test_10_timezone_ready(self):
        s = _run_node(PURE_HARNESS, {"op": "tz", "arg": {"timezone_ready": True, "timezone_ready_source": "fixture_synthetic"}})
        self.assertTrue(s["text"].startswith("READY"))
        self.assertEqual(s["cls"], "ok")

    @needs_node
    def test_11_timezone_missing_unknown_never_ready(self):
        for arg in ({}, {"timezone_ready": None}, {"timezone_ready": "yes"}):
            s = _run_node(PURE_HARNESS, {"op": "tz", "arg": arg})
            self.assertEqual(s["text"], "UNKNOWN — NOT REPORTED")
            self.assertEqual(s["cls"], "warn")

    @needs_node
    def test_12_stale_fixture(self):
        old = _run_node(PURE_HARNESS, {"op": "age", "arg": "2020-01-01T00:00:00Z", "now": 1786000000000})
        self.assertGreater(old["days"], 120)
        fresh = _run_node(PURE_HARNESS, {"op": "age", "arg": "2026-07-20T00:00:00Z", "now": 1784900000000})
        self.assertLess(fresh["days"], 120)

    @needs_node
    def test_13_empty_bundle(self):
        b = _valid_bundle()
        b["source_observations"], b["processing_results"], b["pre_observation_failures"] = [], [], []
        b["enigma"]["counts"] = {"requested": 0, "observations": 0, "processing_results": 0,
                                 "pre_observation_failures": 0, "accepted": 0, "rejected_or_blocked": 0,
                                 "rejected": 0, "accepted_distinct_occurrence_keys": 0,
                                 "terminal_outcomes": 0, "silent_loss": 0}
        v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": b})
        self.assertTrue(v["ok"], v.get("errors"))
        m = _run_node(PURE_HARNESS, {"op": "derive", "bundle": b})
        self.assertEqual(m["acceptedRows"], 0)
        self.assertEqual(len(m["collisionGroups"]), 0)

    @needs_node
    def test_14_deterministic_ordering(self):
        m1 = _run_node(PURE_HARNESS, {"op": "derive", "bundle": _valid_bundle()})
        m2 = _run_node(PURE_HARNESS, {"op": "derive", "bundle": _valid_bundle()})
        ids1 = [r["result_id"] for r in m1["orderedResults"]]
        ids2 = [r["result_id"] for r in m2["orderedResults"]]
        self.assertEqual(ids1, ids2)
        self.assertEqual(m1["orderedResults"][0]["disposition"], "ACCEPTED")

    @needs_node
    def test_15_reason_and_disposition_aggregation(self):
        m = _run_node(PURE_HARNESS, {"op": "derive", "bundle": _valid_bundle()})
        self.assertEqual(m["perDisposition"], {"ACCEPTED": 3, "REJECTED": 1, "BLOCKED": 1, "REVIEW_REQUIRED": 1})
        self.assertEqual(m["postReason"]["ACCEPTED_OK"], 3)
        self.assertEqual(m["postReason"]["REJECTED_INVALID_EVENT_DATETIME"], 1)
        self.assertEqual(m["preReason"]["PREOBS_INVALID_RECORD_STRUCTURE"], 1)
        self.assertEqual(m["preReason"]["PREOBS_MISSING_SOURCE_METADATA"], 1)

    @needs_node
    def test_16_invalid_occurrence_key(self):
        r = _run_node(PURE_HARNESS, {"op": "occkey", "arg": {"dataset": "a|b", "source_event_id": "1", "event_date": "2026-09-01"}})
        self.assertFalse(r["ok"])
        b = _valid_bundle()
        b["processing_results"][0]["normalized_value"]["dataset"] = "bad|dataset"
        v = _run_node(PURE_HARNESS, {"op": "validate", "bundle": b})
        self.assertFalse(v["ok"])

    @needs_node
    def test_17_full_hash_preservation(self):
        b = _valid_bundle()
        proj = _run_node(PURE_HARNESS, {"op": "project", "arg": b["processing_results"][0]})
        self.assertEqual(len(proj["observation_id"]), 64)
        self.assertEqual(len(proj["result_id"]), 64)
        self.assertNotIn("raw_value", proj)


class RenderSafetyTests(unittest.TestCase):
    @needs_node
    def test_21_hostile_xss_rendered_as_text(self):
        b = _valid_bundle()
        hostile = "<script>alert(1)</script>${x}`inject`"
        b["processing_results"][0]["normalized_value"]["title"] = hostile
        out = _run_node(RENDER_HARNESS, {"bundle": b})
        self.assertIsNone(out["threw"], out["threw"])          # no innerHTML sink hit
        self.assertIn(hostile, out["text"])                     # present verbatim as text
        self.assertIn("V2 SHADOW", out["text"])                 # authority labels rendered
        self.assertIn("MOCK FIXTURE", out["text"])


class StaticSafetyTests(unittest.TestCase):
    def test_22_no_unsafe_dom_apis(self):
        src = JS.read_text(encoding="utf-8")
        # Match USAGE forms (dotted/paren), which cannot appear in the prose header.
        for banned in (".innerHTML", ".outerHTML", ".insertAdjacentHTML",
                       "document.write", "eval("):
            self.assertNotIn(banned, src, "panel must not use " + banned)
        self.assertIn("textContent", src)
        self.assertIn("createTextNode", src)

    def test_18_no_private_paths(self):
        for p in (JS, FIXTURE, SCHEMA, CSS):
            t = p.read_text(encoding="utf-8")
            for needle in ("/Users/", "/private/", "/home/", "/tmp/", "C:\\"):
                self.assertNotIn(needle, t, f"{p.name} leaks path {needle}")

    def test_19_no_secret_or_token_leak(self):
        for p in (JS, FIXTURE, SCHEMA):
            low = p.read_text(encoding="utf-8").lower()
            for needle in ("api_key", "apikey", "secret", "bearer ", "password", "private key", "ghp_", "token="):
                self.assertNotIn(needle, low, f"{p.name} contains {needle}")

    def test_20_fixture_no_personal_data(self):
        raw = FIXTURE.read_text(encoding="utf-8")
        self.assertNotRegex(raw, r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "fixture contains an email")
        self.assertNotRegex(raw, r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b", "fixture contains a phone number")
        b = _valid_bundle()
        for r in b["processing_results"]:
            nv = r.get("normalized_value")
            if nv and nv.get("latitude") is not None:
                self.assertFalse(nv["latitude"] == 0 and nv["longitude"] == 0, "0.0/0.0 placeholder coords")


class RepositoryScopeTests(unittest.TestCase):
    def _changed_vs_main(self):
        proc = subprocess.run(["git", "diff", "--name-only", "origin/main"],
                              cwd=str(ROOT), capture_output=True, text=True)
        if proc.returncode != 0:
            self.skipTest("git diff unavailable")
        return [ln.strip() for ln in proc.stdout.splitlines() if ln.strip()]

    def test_25_only_authorized_files_changed(self):
        changed = self._changed_vs_main()
        unauthorized = [f for f in changed if f not in AUTHORIZED]
        self.assertEqual(unauthorized, [], "unauthorized changed files: " + repr(unauthorized))

    def test_24_production_map_files_unchanged(self):
        changed = set(self._changed_vs_main())
        for f in PROTECTED_UNCHANGED:
            self.assertNotIn(f, changed, f"protected file changed: {f}")


class NoNetworkTests(unittest.TestCase):
    @needs_node
    def test_23_pure_layer_makes_no_network(self):
        # The pure/render harnesses never fetch; boot() is guarded off (getElementById null).
        # A deny-all fetch is injected; a network attempt would throw and fail the harness.
        harness = ("global.fetch = () => { throw new Error('network attempted'); };\n"
                   "global.document = { readyState:'complete', getElementById:()=>null, addEventListener:()=>{} };\n"
                   "const api = require(process.env.JS);\n"
                   "const b = JSON.parse(require('fs').readFileSync(process.env.REQ,'utf8')).bundle;\n"
                   "const v = api.validateBundle(b); api.deriveMetrics(b);\n"
                   "process.stdout.write(JSON.stringify({ok:v.ok}));")
        out = _run_node(harness, {"bundle": _valid_bundle()})
        self.assertTrue(out["ok"])


if __name__ == "__main__":
    unittest.main()
