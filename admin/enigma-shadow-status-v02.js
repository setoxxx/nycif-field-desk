/* Enigma Shadow Program Status panel (v02) — GodView internal diagnostic.
 *
 * Read-only. Loads the public-safe `enigma_shadow_program` block from the
 * canonical GodView project-state artifact on nycif-live-feeds
 * (status/nycif-godview-project-state-v02.json) — the same artifact the Project
 * Control Center already consumes — and renders the SHADOW-1 program status:
 * gate tree A-F, verified test totals, synthetic fixture accounting, parked
 * minors, and the SHADOW-2 lock.
 *
 * SHADOW-1 is complete and owner-accepted for SYNTHETIC-FIXTURE, SHADOW-ONLY
 * use. This panel does NOT connect to a real feed, does not compare against V1,
 * and holds no publish / promote / approve / dedupe / mutation / deployment
 * control. V1 remains the sole production and publishing authority.
 *
 * Validation is an EXACT CONTRACT, not a shape check: the payload must equal the
 * owner-accepted SHADOW-1 record pinned in CANONICAL_PROGRAM below. A payload
 * that is merely internally consistent (totals that re-sum, fixture counts that
 * reconcile, gate values drawn from the allowed vocabulary) is rejected unless
 * every approved value also matches exactly.
 *
 * Security: safe DOM only (createElement / textContent / createTextNode); no
 * innerHTML / insertAdjacentHTML for data; fails closed on malformed or
 * unapproved state; a panel-local failure is caught so it cannot break the
 * surrounding GodView panels; renders no private links or commit SHAs.
 *
 * Network: one read-only cross-origin GET to raw.githubusercontent.com for the
 * canonical public project-state artifact. No writes, no credentials.
 */
"use strict";

(function () {
  var MOUNT_ID = "enigma-shadow-status";
  var LIVE_FEEDS_BASE = "https://raw.githubusercontent.com/setoxxx/nycif-live-feeds";
  var BRANCH_CANDIDATES = ["main"];
  var STATE_PATH = "status/nycif-godview-project-state-v02.json";

  var GATE_LABELS = {
    A: "Decisions ratified",
    B: "Core schemas & observation lane",
    C: "Deterministic bundle producer",
    D: "Private SVG viewer",
    E: "Formal browser QA",
    F: "Owner acceptance",
  };
  var ALLOWED_GATE_STATES = {
    complete: "COMPLETE",
    accepted_with_conditions: "ACCEPTED (PARKED MINORS)",
    owner_accepted: "OWNER ACCEPTED",
  };
  var AUTHORITY_EXPECTED = {
    v1_is_sole_production_authority: true,
    shadow_only: true,
    synthetic_fixture_only: true,
    real_feed_authorized: false,
    deployment_authorized: false,
    public_promotion_authorized: false,
    publication_authorized: false,
  };

  /* The exact owner-accepted SHADOW-1 record. This panel is a status mirror, not
   * a general-purpose renderer: it must display the approved facts or nothing.
   * Every value below is pinned, so a substituted, re-summed, or otherwise
   * internally-consistent-but-different payload fails closed rather than
   * rendering an unapproved program state. Changing any value here is a
   * deliberate contract change requiring owner authorization, and must be made
   * in lockstep with build_enigma_shadow_program() in nycif-live-feeds
   * scripts/generate_godview_project_state.py. */
  var CANONICAL_PROGRAM = {
    program: "SHADOW-1",
    status: "owner_accepted_shadow_only",
    owner_decision: "APPROVE SHADOW-ONLY — PARK BOTH MINORS",
    synthetic_validation: "complete",
    real_data_comparison: "not_started",
    production_promotion: "not_authorized",
    gates: {
      A: "complete",
      B: "complete",
      C: "complete",
      D: "complete",
      E: "accepted_with_conditions",
      F: "owner_accepted",
    },
    test_totals: {
      isolation: 16,
      enigma_core: 127,
      bundle_producer: 125,
      viewer: 61,
      total: 329,
    },
    fixture_accounting: {
      requested: 12,
      accepted_rows: 9,
      distinct_occurrences: 7,
      in_viewport: 4,
      outside_viewport: 0,
      unpinnable: 3,
      duplicate_groups: 2,
      silent_loss: 0,
    },
    // Order is part of the contract: the list is rendered in this order.
    parked_minors: [
      "Genericize malformed-manifest JSON error wording",
      "Darken decorative borough labels to exceed 4.5:1 contrast",
    ],
    authority: AUTHORITY_EXPECTED,
    next_phase: {
      name: "SHADOW-2 Gate A",
      status: "not_authorized",
      purpose: "real-data governance, source selection, snapshot boundary, " +
        "sanitization, retention, and comparison metrics",
    },
  };
  var PINNED_SCALARS = ["program", "status", "owner_decision", "synthetic_validation",
    "real_data_comparison", "production_promotion"];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.setAttribute("class", className); }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }
  function badge(text, cls) { return el("span", "badge" + (cls ? " " + cls : ""), text); }
  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function isStr(v) { return typeof v === "string" && v.length > 0; }

  /* Exact flat-object match: same key set, same primitive values, strict
   * equality (so `true` never satisfies `1`, and `"16"` never satisfies `16`).
   * Extra keys are rejected inside a pinned block — an unexpected key there is
   * a contract change, not harmless metadata. */
  function exactObject(actual, expected) {
    if (!isObj(actual)) { return false; }
    var expectedKeys = Object.keys(expected);
    if (Object.keys(actual).length !== expectedKeys.length) { return false; }
    for (var i = 0; i < expectedKeys.length; i++) {
      var k = expectedKeys[i];
      if (!Object.prototype.hasOwnProperty.call(actual, k)) { return false; }
      if (actual[k] !== expected[k]) { return false; }
    }
    return true;
  }

  /* Exact ordered array match (order is rendered, so it is part of the contract). */
  function exactArray(actual, expected) {
    if (!Array.isArray(actual) || actual.length !== expected.length) { return false; }
    for (var i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) { return false; }
    }
    return true;
  }

  function renderError(root, message) {
    root.textContent = "";
    var box = el("div", "notice danger");
    box.setAttribute("role", "alert");
    box.appendChild(el("strong", null, "Enigma shadow program status unavailable. "));
    box.appendChild(document.createTextNode(String(message)));
    root.appendChild(box);
  }

  // -------------------------------------------------------------- validation
  /* Pure, deterministic, fail-closed. Returns null when the payload is exactly
   * the owner-accepted SHADOW-1 record, otherwise a short reason string.
   *
   * Every approved fact is matched exactly against CANONICAL_PROGRAM. Arithmetic
   * reconciliation, allowed-state membership, and the authority/next-phase
   * safety checks are retained ON TOP of the exact match as defence in depth —
   * they are no longer the acceptance criterion. Unknown TOP-LEVEL keys are
   * ignored (nothing outside the pinned set is read or rendered); unknown keys
   * inside a pinned block are rejected. */
  function validateProgram(p) {
    if (!isObj(p)) { return "program block missing or malformed"; }

    for (var s = 0; s < PINNED_SCALARS.length; s++) {
      var key = PINNED_SCALARS[s];
      if (p[key] !== CANONICAL_PROGRAM[key]) {
        return "approved fact '" + key + "' does not match the accepted SHADOW-1 record";
      }
    }

    if (!exactObject(p.gates, CANONICAL_PROGRAM.gates)) {
      return "gate states do not match the accepted SHADOW-1 record";
    }
    var g;
    for (g in CANONICAL_PROGRAM.gates) {
      if (!Object.prototype.hasOwnProperty.call(ALLOWED_GATE_STATES, p.gates[g])) {
        return "gate " + g + " has an unsupported state";
      }
    }

    if (!exactObject(p.test_totals, CANONICAL_PROGRAM.test_totals)) {
      return "verified test totals do not match the accepted SHADOW-1 record";
    }
    var t = p.test_totals;
    if (t.isolation + t.enigma_core + t.bundle_producer + t.viewer !== t.total) {
      return "test totals do not sum to total";
    }

    if (!exactObject(p.fixture_accounting, CANONICAL_PROGRAM.fixture_accounting)) {
      return "fixture accounting does not match the accepted SHADOW-1 record";
    }
    var f = p.fixture_accounting;
    if (f.in_viewport + f.outside_viewport + f.unpinnable !== f.distinct_occurrences) {
      return "fixture sections do not reconcile with distinct occurrences";
    }
    if (f.silent_loss !== 0) { return "silent loss is not zero"; }

    if (!exactArray(p.parked_minors, CANONICAL_PROGRAM.parked_minors)) {
      return "parked maintenance items do not match the accepted SHADOW-1 record";
    }

    if (!exactObject(p.authority, CANONICAL_PROGRAM.authority)) {
      return "authority block does not match the accepted SHADOW-1 record";
    }
    var k;
    for (k in AUTHORITY_EXPECTED) {
      if (p.authority[k] !== AUTHORITY_EXPECTED[k]) { return "authority flag " + k + " is unsafe"; }
    }

    if (!exactObject(p.next_phase, CANONICAL_PROGRAM.next_phase)) {
      return "next phase does not match the accepted SHADOW-1 record";
    }
    if (p.next_phase.status !== "not_authorized") { return "next phase is not locked"; }

    return null;
  }

  // ----------------------------------------------------------------- render
  function renderBanner(root) {
    var bar = el("div", "enigma-shadow-labels");
    ["SHADOW-ONLY", "SYNTHETIC FIXTURE ONLY", "NOT PRODUCTION AUTHORITY",
      "REAL FEED NOT AUTHORIZED", "V1 REMAINS THE SOLE PRODUCTION AND PUBLISHING AUTHORITY"
    ].forEach(function (t, i) {
      bar.appendChild(badge(t, i === 4 ? "violet" : (i >= 2 ? "warn" : "danger")));
    });
    root.appendChild(bar);
  }

  function renderMode(root, p) {
    var sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Program mode"));
    var grid = el("div", "grid");
    [["Synthetic validation", p.synthetic_validation.toUpperCase(), "ok"],
     ["Real-data comparison", p.real_data_comparison.replace(/_/g, " ").toUpperCase(), "warn"],
     ["Production promotion", p.production_promotion.replace(/_/g, " ").toUpperCase(), "danger"],
     ["Owner decision", p.owner_decision, "violet"]].forEach(function (row) {
      var w = el("div", "stat");
      w.appendChild(el("div", "label", row[0]));
      var v = el("div", "value");
      v.appendChild(badge(row[1], row[2]));
      w.appendChild(v);
      grid.appendChild(w);
    });
    sec.appendChild(grid);
    root.appendChild(sec);
  }

  function renderGates(root, p) {
    var sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Program milestone tree (Gates A–F)"));
    var list = el("ul", "enigma-gate-tree");
    ["A", "B", "C", "D", "E", "F"].forEach(function (g) {
      var li = el("li", "enigma-gate");
      li.appendChild(el("span", "enigma-gate-id", "Gate " + g));
      li.appendChild(el("span", "enigma-gate-label", GATE_LABELS[g]));
      var stateText = ALLOWED_GATE_STATES[p.gates[g]];
      li.appendChild(badge(stateText, p.gates[g] === "accepted_with_conditions" ? "warn" : "ok"));
      list.appendChild(li);
    });
    sec.appendChild(list);
    root.appendChild(sec);
  }

  function statGrid(entries) {
    var grid = el("div", "grid");
    entries.forEach(function (e) {
      var w = el("div", "stat");
      w.appendChild(el("div", "label", e[0]));
      w.appendChild(el("div", "value", e[1]));
      grid.appendChild(w);
    });
    return grid;
  }

  function renderTotals(root, p) {
    var sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Verified test totals"));
    var t = p.test_totals;
    sec.appendChild(statGrid([
      ["Production isolation", t.isolation],
      ["Enigma core", t.enigma_core],
      ["Bundle producer", t.bundle_producer],
      ["Viewer", t.viewer],
      ["Total passing", t.total],
    ]));
    root.appendChild(sec);
  }

  function renderFixture(root, p) {
    var sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Synthetic fixture outcomes"));
    var f = p.fixture_accounting;
    sec.appendChild(statGrid([
      ["Requested records", f.requested],
      ["Accepted rows", f.accepted_rows],
      ["Distinct occurrences", f.distinct_occurrences],
      ["NYC map pins", f.in_viewport],
      ["Outside viewport", f.outside_viewport],
      ["Unpinnable", f.unpinnable],
      ["Duplicate groups", f.duplicate_groups],
      ["Silent loss", f.silent_loss],
    ]));
    root.appendChild(sec);
  }

  function renderParked(root, p) {
    var sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Parked maintenance (non-blocking)"));
    var ul = el("ul", "enigma-parked");
    p.parked_minors.forEach(function (m) { ul.appendChild(el("li", null, String(m))); });
    if (!p.parked_minors.length) { ul.appendChild(el("li", "muted", "None.")); }
    sec.appendChild(ul);
    root.appendChild(sec);
  }

  function renderNext(root, p) {
    var sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Next phase"));
    var box = el("div", "notice warn");
    box.appendChild(el("strong", null, String(p.next_phase.name) + " — "));
    box.appendChild(badge("NOT AUTHORIZED", "danger"));
    box.appendChild(el("p", null, "Real-data comparison NOT STARTED. " +
      "Real-data source selection, frozen snapshot boundary, sanitization, retention, and " +
      "comparison metrics require separate explicit owner authorization."));
    if (isStr(p.next_phase.purpose)) { box.appendChild(el("p", "muted", String(p.next_phase.purpose))); }
    sec.appendChild(box);
    root.appendChild(sec);
  }

  function render(root, p) {
    root.textContent = "";
    renderBanner(root);
    renderMode(root, p);
    renderGates(root, p);
    renderTotals(root, p);
    renderFixture(root, p);
    renderParked(root, p);
    renderNext(root, p);
  }

  // ------------------------------------------------------------------ fetch
  function stateUrl(root, branch) {
    var override = root.getAttribute("data-state-url"); // local QA seam only
    if (override) { return override; }
    return LIVE_FEEDS_BASE + "/" + branch + "/" + STATE_PATH;
  }

  function loadAndRender(root) {
    var candidates = BRANCH_CANDIDATES.slice();
    function attempt(idx) {
      if (idx >= candidates.length) {
        renderError(root, "Could not load the God View project-state artifact.");
        return;
      }
      var url = stateUrl(root, candidates[idx]);
      fetch(url, { cache: "no-store" }).then(function (resp) {
        if (!resp.ok) { throw new Error("http " + resp.status); }
        return resp.json();
      }).then(function (state) {
        if (!isObj(state) || !("enigma_shadow_program" in state)) {
          renderError(root, "Enigma program status is not present in the current published project state.");
          return;
        }
        var p = state.enigma_shadow_program;
        var err = validateProgram(p);
        if (err) { renderError(root, "Fail-closed: " + err + "."); return; }
        render(root, p);
      }).catch(function () {
        attempt(idx + 1);
      });
    }
    attempt(0);
  }

  function boot() {
    var root = document.getElementById(MOUNT_ID);
    if (!root) { return; }
    try {
      loadAndRender(root);
    } catch (e) {
      try { renderError(root, "Panel failed to initialize."); } catch (e2) { /* never break siblings */ }
    }
  }

  // Expose the pure layer for manual/console verification and tests (read-only).
  var PURE_API = {
    validateProgram: validateProgram,
    CANONICAL_PROGRAM: CANONICAL_PROGRAM,
    GATE_LABELS: GATE_LABELS,
    ALLOWED_GATE_STATES: ALLOWED_GATE_STATES,
    AUTHORITY_EXPECTED: AUTHORITY_EXPECTED,
  };
  if (typeof window !== "undefined") { window.EnigmaShadowProgram = PURE_API; }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PURE_API; // Node import for tests; DOM code stays guarded off.
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})();
