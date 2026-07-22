#!/usr/bin/env python3
"""Tests for the GodView Enigma Shadow Program Status panel (v02).

Read-only, offline. Static safety / file-scope / no-leak checks run in pure
Python (stdlib only). The actual validateProgram() fail-closed layer is exercised
via a Node subprocess harness when Node is present (skips with a clear message
otherwise). No dependencies are installed.

Run:  python3 -B admin/tests/test_enigma_shadow_status_v02.py
  or: python3 -B -m unittest discover -s admin/tests -t . -p 'test_*v02.py' -v
"""
import json
import os
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "admin" / "enigma-shadow-status-v02.js"
CSS = ROOT / "admin" / "enigma-shadow-status-v02.css"
INDEX = ROOT / "admin" / "index.html"
V01_JS = ROOT / "admin" / "enigma-shadow-status-v01.js"
V01_CSS = ROOT / "admin" / "enigma-shadow-status-v01.css"

NODE = shutil.which("node")

# Canonical valid program block (mirrors generate_godview_project_state.py).
VALID_PROGRAM = {
    "program": "SHADOW-1",
    "status": "owner_accepted_shadow_only",
    "owner_decision": "APPROVE SHADOW-ONLY — PARK BOTH MINORS",
    "synthetic_validation": "complete",
    "real_data_comparison": "not_started",
    "production_promotion": "not_authorized",
    "gates": {"A": "complete", "B": "complete", "C": "complete", "D": "complete",
              "E": "accepted_with_conditions", "F": "owner_accepted"},
    "test_totals": {"isolation": 16, "enigma_core": 127, "bundle_producer": 125, "viewer": 61, "total": 329},
    "fixture_accounting": {"requested": 12, "accepted_rows": 9, "distinct_occurrences": 7, "in_viewport": 4,
                           "outside_viewport": 0, "unpinnable": 3, "duplicate_groups": 2, "silent_loss": 0},
    "parked_minors": ["Genericize malformed-manifest JSON error wording",
                      "Darken decorative borough labels to exceed 4.5:1 contrast"],
    "authority": {"v1_is_sole_production_authority": True, "shadow_only": True, "synthetic_fixture_only": True,
                  "real_feed_authorized": False, "deployment_authorized": False,
                  "public_promotion_authorized": False, "publication_authorized": False},
    "next_phase": {"name": "SHADOW-2 Gate A", "status": "not_authorized", "purpose": "real-data governance"},
}

HARNESS = r"""
const api = require(process.env.JS);
const p = JSON.parse(require('fs').readFileSync(process.env.REQ, 'utf8'));
process.stdout.write(JSON.stringify({result: api.validateProgram(p)}));
"""


def _node_validate(program):
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        req = Path(d) / "req.json"
        req.write_text(json.dumps(program), encoding="utf-8")
        harness = Path(d) / "h.js"
        harness.write_text(HARNESS, encoding="utf-8")
        env = dict(os.environ, JS=str(JS), REQ=str(req))
        out = subprocess.run(["node", str(harness)], capture_output=True, text=True, env=env, timeout=20)
        if out.returncode != 0:
            raise AssertionError("node harness failed: " + out.stderr[:200])
        return json.loads(out.stdout)["result"]


class StaticSafetyTests(unittest.TestCase):
    def setUp(self):
        self.js = JS.read_text(encoding="utf-8")
        self.css = CSS.read_text(encoding="utf-8")
        self.index = INDEX.read_text(encoding="utf-8")

    def test_files_exist(self):
        self.assertTrue(JS.exists() and CSS.exists())

    def test_no_unsafe_dom_apis(self):
        # Strip block and line comments so documentation mentioning these APIs
        # (e.g. "no innerHTML ...") does not trip the check; scan real code only.
        code = re.sub(r"/\*.*?\*/", "", self.js, flags=re.S)
        code = re.sub(r"//[^\n]*", "", code)
        for bad in ("innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function"):
            self.assertNotIn(bad, code, "v02 panel uses unsafe API " + bad)

    def test_index_references_v02_not_v01(self):
        self.assertIn("enigma-shadow-status-v02.css", self.index)
        self.assertIn("enigma-shadow-status-v02.js", self.index)
        self.assertNotIn("enigma-shadow-status-v01.css", self.index)
        self.assertNotIn("enigma-shadow-status-v01.js", self.index)

    def test_v01_files_retained_for_rollback(self):
        self.assertTrue(V01_JS.exists() and V01_CSS.exists(), "v01 files must remain as rollback evidence")

    def test_stale_core21_wording_removed_from_active_panel(self):
        # The active section notice must no longer claim CORE-2.1 mirroring or a SHADOW-1 comparison.
        section = self.index.split('id="enigma-shadow-status-section"')[1].split("</section>")[0]
        low = section.lower()
        self.assertNotIn("mirrors the accepted enigma core-2.1", low)
        self.assertIn("shadow-1", low)
        self.assertIn("not authorized", low)

    def test_authority_banner_strings_present(self):
        for s in ("SHADOW-ONLY", "SYNTHETIC FIXTURE ONLY", "NOT PRODUCTION AUTHORITY",
                  "REAL FEED NOT AUTHORIZED", "V1 REMAINS THE SOLE PRODUCTION AND PUBLISHING AUTHORITY"):
            self.assertIn(s, self.js)

    def test_distinguishes_validation_comparison_promotion(self):
        for s in ("Synthetic validation", "Real-data comparison", "Production promotion"):
            self.assertIn(s, self.js)

    def test_no_private_links_shas_paths_or_credentials(self):
        for blob, name in ((self.js, "v02.js"), (self.css, "v02.css")):
            for bad in ("national-pilot", "nycif-national", "/private/tmp", "/Users/", "ghp_", "github_pat_"):
                self.assertNotIn(bad, blob, name + " leaks " + bad)
            self.assertFalse(re.search(r"[0-9a-f]{40}", blob), name + " contains a 40-hex SHA")

    def test_reads_canonical_state_artifact(self):
        self.assertIn("status/nycif-godview-project-state-v02.json", self.js)
        self.assertIn("enigma_shadow_program", self.js)

    def test_no_write_or_promotion_controls(self):
        low = self.js.lower()
        for bad in ("method: \"post\"", "method: 'post'", ".submit(", "promote(", "publish(", "approve("):
            self.assertNotIn(bad, low)


@unittest.skipUnless(NODE, "Node not available; validateProgram behavior covered by browser QA")
class ValidateProgramTests(unittest.TestCase):
    def test_valid_program_accepted(self):
        self.assertIsNone(_node_validate(VALID_PROGRAM))

    def test_wrong_program_id_rejected(self):
        p = dict(VALID_PROGRAM, program="SHADOW-2")
        self.assertIsNotNone(_node_validate(p))

    def test_missing_gate_rejected(self):
        g = dict(VALID_PROGRAM["gates"]); del g["F"]
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, gates=g)))

    def test_unsupported_gate_state_rejected(self):
        g = dict(VALID_PROGRAM["gates"]); g["F"] = "in_progress"
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, gates=g)))

    def test_bad_test_total_sum_rejected(self):
        t = dict(VALID_PROGRAM["test_totals"], total=999)
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, test_totals=t)))

    def test_fixture_reconciliation_enforced(self):
        f = dict(VALID_PROGRAM["fixture_accounting"], unpinnable=99)
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, fixture_accounting=f)))

    def test_nonzero_silent_loss_rejected(self):
        f = dict(VALID_PROGRAM["fixture_accounting"], silent_loss=1)
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, fixture_accounting=f)))

    def test_unsafe_authority_flag_rejected(self):
        for k, bad in (("real_feed_authorized", True), ("deployment_authorized", True),
                       ("public_promotion_authorized", True), ("shadow_only", False),
                       ("v1_is_sole_production_authority", False)):
            a = dict(VALID_PROGRAM["authority"]); a[k] = bad
            self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, authority=a)), k)

    def test_next_phase_must_be_locked(self):
        n = dict(VALID_PROGRAM["next_phase"], status="authorized")
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, next_phase=n)))

    def test_comparison_or_promotion_started_rejected(self):
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, real_data_comparison="started")))
        self.assertIsNotNone(_node_validate(dict(VALID_PROGRAM, production_promotion="authorized")))


if __name__ == "__main__":
    unittest.main()
