/**
 * Enigma Shadow Status panel (v01) — GodView internal diagnostic.
 *
 * READ-ONLY. V2 SHADOW. NOT PRODUCTION AUTHORITY. V1 REMAINS AUTHORITATIVE.
 * Loads a same-origin, fully synthetic MOCK fixture (never operational data) that
 * mirrors the accepted Enigma CORE-2.1 event-lane output, validates it fail-closed,
 * and renders diagnostics. It never resolves duplicates, selects winners, promotes,
 * publishes, reconciles, or mutates any source.
 *
 * Contract references (NOT runtime dependencies):
 *   CORE-1.1  9d1a8efd555b0a4a2050541e33967bc927f6ba1e
 *   CORE-2.1  254972f582ad005f82ce880f1e1de9372e00d11f
 *
 * Rendering is DOM-safe: dynamic text is written only via textContent /
 * createTextNode. No innerHTML / insertAdjacentHTML / template-string HTML is used
 * for data-derived content.
 */
(() => {
  "use strict";

  const VERSION = "enigma-shadow-status-v01";
  const FIXTURE_URL = "./fixtures/enigma-shadow-bundle-v01.json";
  const MOUNT_ID = "enigma-shadow-status";
  const SUPPORTED_BUNDLE_VERSION = 1;
  const REQUIRED_CLASSIFICATION = "MOCK_FIXTURE_NON_OPERATIONAL";
  const SUPPORTED_EVENT_LANE_VERSION = 1;
  const STALE_FIXTURE_DAYS = 120; // documented threshold; fixture age, not pipeline staleness

  const DISPOSITIONS = ["ACCEPTED", "REJECTED", "BLOCKED", "REVIEW_REQUIRED"];
  const REASON_TO_DISPOSITION = {
    ACCEPTED_OK: "ACCEPTED",
    REJECTED_MISSING_REQUIRED_FIELD: "REJECTED",
    REJECTED_INVALID_EVENT_DATETIME: "REJECTED",
    REJECTED_INVALID_NORMALIZED_VALUE: "REJECTED",
    REJECTED_UNSUPPORTED_SCHEMA_VERSION: "REJECTED",
    BLOCKED_DUPLICATE: "BLOCKED",
    BLOCKED_CONFLICT: "BLOCKED",
    REVIEW_REQUIRED_MANUAL: "REVIEW_REQUIRED",
  };
  const POST_REASONS = Object.keys(REASON_TO_DISPOSITION);
  const PRE_REASONS = [
    "PREOBS_INVALID_RECORD_STRUCTURE",
    "PREOBS_MISSING_SOURCE_METADATA",
    "PREOBS_INVALID_RETRIEVAL_TIMESTAMP",
    "PREOBS_OBSERVATION_CONTRACT_FAILURE",
  ];
  const NORMALIZED_FIELDS = ["dataset", "source_event_id", "event_date", "title",
    "start_date_time", "end_date_time", "timezone", "borough", "location", "latitude",
    "longitude", "category", "interests", "tags"];
  const OCCURRENCE_FIELDS = ["dataset", "source_event_id", "event_date"];

  const SHA_RE = /^[0-9a-f]{64}$/;
  const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  // ------------------------------------------------------------------ pure layer
  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function isInt(v) { return typeof v === "number" && Number.isInteger(v); }
  function isSha(v) { return typeof v === "string" && SHA_RE.test(v); }

  /** Business occurrence identity; throws on a '|' inside a component (invalid key). */
  function computeOccurrenceKey(nv) {
    const parts = [];
    for (const f of OCCURRENCE_FIELDS) {
      const v = nv ? nv[f] : undefined;
      if (typeof v !== "string" || v.length === 0) {
        throw new Error("occurrence_key requires non-empty " + f);
      }
      if (v.indexOf("|") !== -1) {
        throw new Error("occurrence_key field " + f + " must not contain '|'");
      }
      parts.push(v);
    }
    return parts.join("|");
  }

  /** Fail-closed validation. Returns { ok, errors:[...] }. No exceptions escape. */
  function validateBundle(bundle) {
    const errors = [];
    const fail = (m) => errors.push(m);
    try {
      if (!isObj(bundle)) return { ok: false, errors: ["bundle is not an object"] };
      if (bundle.bundle_schema_id !== "nycif-godview-enigma-shadow-bundle") fail("bad bundle_schema_id");
      if (bundle.bundle_schema_version !== SUPPORTED_BUNDLE_VERSION) fail("unsupported bundle_schema_version");
      if (bundle.classification !== REQUIRED_CLASSIFICATION) fail("missing/incorrect fixture classification");
      if (bundle.fixture !== true) fail("fixture flag must be true");
      if (bundle.operational !== false) fail("operational flag must be false");

      const e = bundle.enigma;
      if (!isObj(e)) return { ok: false, errors: errors.concat(["missing enigma block"]) };
      if (e.event_lane_schema_id !== "enigma-event-lane") fail("bad event_lane_schema_id");
      if (e.event_lane_schema_version !== SUPPORTED_EVENT_LANE_VERSION) fail("unsupported event_lane_schema_version");
      if (!isSha(e.run_id)) fail("run_id not sha256 hex");
      if (!isSha(e.input_artifact_sha256)) fail("input_artifact_sha256 not sha256 hex");
      if (typeof e.generated_at_utc !== "string" || !UTC_RE.test(e.generated_at_utc)) fail("generated_at_utc not canonical UTC");

      const c = e.counts;
      const cKeys = ["requested", "observations", "processing_results", "pre_observation_failures",
        "accepted", "rejected_or_blocked", "accepted_distinct_occurrence_keys", "terminal_outcomes", "silent_loss"];
      if (!isObj(c)) { fail("missing counts"); }
      else {
        for (const k of cKeys) if (!isInt(c[k])) fail("count " + k + " not an integer");
      }

      const obs = bundle.source_observations, res = bundle.processing_results, pre = bundle.pre_observation_failures;
      if (!Array.isArray(obs) || !Array.isArray(res) || !Array.isArray(pre)) {
        return { ok: false, errors: errors.concat(["observations/results/failures must be arrays"]) };
      }

      // Per-row structural checks.
      res.forEach((r, i) => {
        if (!isObj(r)) return fail("result " + i + " not object");
        if (r.schema_version !== 1) fail("result " + i + " schema_version");
        if (!isSha(r.result_id)) fail("result " + i + " result_id");
        if (!isSha(r.observation_id)) fail("result " + i + " observation_id");
        if (!isSha(r.result_hash)) fail("result " + i + " result_hash");
        if (DISPOSITIONS.indexOf(r.disposition) === -1) fail("result " + i + " disposition");
        if (POST_REASONS.indexOf(r.reason_code) === -1) fail("result " + i + " reason_code");
        else if (REASON_TO_DISPOSITION[r.reason_code] !== r.disposition) fail("result " + i + " reason/disposition mismatch");
        const accepted = r.disposition === "ACCEPTED";
        if (accepted) {
          if (!isObj(r.normalized_value)) fail("result " + i + " accepted needs normalized_value");
          else {
            for (const f of NORMALIZED_FIELDS) if (!(f in r.normalized_value)) fail("result " + i + " normalized missing " + f);
            if (typeof r.normalized_value.event_date !== "string" || !DATE_RE.test(r.normalized_value.event_date)) fail("result " + i + " event_date");
            try { computeOccurrenceKey(r.normalized_value); } catch (ex) { fail("result " + i + " invalid occurrence key"); }
          }
        } else if (r.normalized_value !== null) {
          fail("result " + i + " non-accepted must have null normalized_value");
        }
      });
      obs.forEach((o, i) => {
        if (!isObj(o)) return fail("observation " + i + " not object");
        if (o.schema_version !== 1) fail("observation " + i + " schema_version");
        if (!isSha(o.observation_id)) fail("observation " + i + " observation_id");
        if (!isSha(o.source_artifact_sha256)) fail("observation " + i + " source_artifact_sha256");
        if (!isSha(o.observation_hash)) fail("observation " + i + " observation_hash");
        if (typeof o.retrieved_at_utc !== "string" || !UTC_RE.test(o.retrieved_at_utc)) fail("observation " + i + " retrieved_at_utc");
        if (typeof o.source_id !== "string" || !o.source_id) fail("observation " + i + " source_id");
        if (typeof o.source_record_id !== "string" || !o.source_record_id) fail("observation " + i + " source_record_id");
      });
      pre.forEach((p, i) => {
        if (!isObj(p)) return fail("pre_failure " + i + " not object");
        if (p.schema_version !== 1) fail("pre_failure " + i + " schema_version");
        if (!isInt(p.input_ordinal) || p.input_ordinal < 0) fail("pre_failure " + i + " input_ordinal");
        if (PRE_REASONS.indexOf(p.reason_code) === -1) fail("pre_failure " + i + " reason_code");
        if (typeof p.detail !== "string") fail("pre_failure " + i + " detail");
        if (!(p.raw_input_sha256 === null || isSha(p.raw_input_sha256))) fail("pre_failure " + i + " raw_input_sha256");
        if (!isSha(p.failure_hash)) fail("pre_failure " + i + " failure_hash");
      });

      // Count-relationship + declared-vs-actual cross checks (fail closed on any mismatch).
      if (isObj(c) && errors.length === 0) {
        const acc = res.filter((r) => r.disposition === "ACCEPTED").length;
        const nonAcc = res.length - acc;
        const distinct = new Set(res.filter((r) => r.disposition === "ACCEPTED")
          .map((r) => computeOccurrenceKey(r.normalized_value))).size;
        if (c.observations !== obs.length) fail("counts.observations != rows");
        if (c.processing_results !== res.length) fail("counts.processing_results != rows");
        if (c.pre_observation_failures !== pre.length) fail("counts.pre_observation_failures != rows");
        if (c.accepted !== acc) fail("counts.accepted != rows");
        if (c.rejected_or_blocked !== nonAcc) fail("counts.rejected_or_blocked != rows");
        if (c.accepted_distinct_occurrence_keys !== distinct) fail("counts.distinct occurrence keys != rows");
        if (c.accepted + c.rejected_or_blocked !== c.processing_results) fail("accepted+rejected_or_blocked != processing_results");
        if (c.observations !== c.processing_results) fail("observations != processing_results");
        if (c.terminal_outcomes !== c.processing_results + c.pre_observation_failures) fail("terminal_outcomes relationship");
        if (c.silent_loss !== 0 || c.terminal_outcomes !== c.requested) fail("silent loss / requested relationship");
        if (c.accepted_distinct_occurrence_keys > c.accepted) fail("distinct keys exceed accepted rows");
      }
    } catch (ex) {
      return { ok: false, errors: ["validation aborted"] };
    }
    return { ok: errors.length === 0, errors };
  }

  function orderResults(res) {
    return res.slice().sort((a, b) => {
      const da = DISPOSITIONS.indexOf(a.disposition), db = DISPOSITIONS.indexOf(b.disposition);
      if (da !== db) return da - db;
      const ka = a.normalized_value ? computeOccurrenceKey(a.normalized_value) : "";
      const kb = b.normalized_value ? computeOccurrenceKey(b.normalized_value) : "";
      if (ka !== kb) return ka < kb ? -1 : 1;
      return a.result_id < b.result_id ? -1 : a.result_id > b.result_id ? 1 : 0;
    });
  }

  /** Derive presentation-only metrics from the immutable bundle. Discards nothing. */
  function deriveMetrics(bundle) {
    const res = bundle.processing_results, pre = bundle.pre_observation_failures;
    const perDisposition = {}; DISPOSITIONS.forEach((d) => (perDisposition[d] = 0));
    const postReason = {}; POST_REASONS.forEach((r) => (postReason[r] = 0));
    const preReason = {}; PRE_REASONS.forEach((r) => (preReason[r] = 0));
    res.forEach((r) => {
      if (r.disposition in perDisposition) perDisposition[r.disposition] += 1;
      if (r.reason_code in postReason) postReason[r.reason_code] += 1;
    });
    pre.forEach((p) => { if (p.reason_code in preReason) preReason[p.reason_code] += 1; });

    const groups = new Map();
    res.filter((r) => r.disposition === "ACCEPTED").forEach((r) => {
      const key = computeOccurrenceKey(r.normalized_value);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    const acceptedRows = perDisposition.ACCEPTED;
    const distinctKeys = groups.size;
    const collisions = acceptedRows - distinctKeys;
    const collisionGroups = [];
    groups.forEach((rows, key) => {
      if (rows.length > 1) {
        const datasets = {};
        rows.forEach((r) => {
          const ds = r.normalized_value.dataset;
          datasets[ds] = (datasets[ds] || 0) + 1;
        });
        collisionGroups.push({
          occurrence_key: key,
          accepted_row_count: rows.length,
          distinct_observation_count: new Set(rows.map((r) => r.observation_id)).size,
          source_dataset_distribution: datasets,
        });
      }
    });
    collisionGroups.sort((a, b) => (a.occurrence_key < b.occurrence_key ? -1 : 1));

    return {
      perDisposition, postReason, preReason,
      acceptedRows, distinctKeys, collisions, collisionGroups,
      orderedResults: orderResults(res),
      orderedPreFailures: pre.slice().sort((a, b) => a.input_ordinal - b.input_ordinal),
    };
  }

  /** Public-safe inspection projection; excludes raw_value entirely; adds occurrence_key. */
  function projectEventForInspection(result) {
    const out = {
      result_id: result.result_id,
      observation_id: result.observation_id,
      disposition: result.disposition,
      reason_code: result.reason_code,
      schema_version: result.schema_version,
    };
    if (result.normalized_value) {
      let key = "";
      try { key = computeOccurrenceKey(result.normalized_value); } catch (ex) { key = "(invalid)"; }
      out.occurrence_key = key;
      NORMALIZED_FIELDS.forEach((f) => { out[f] = result.normalized_value[f]; });
    }
    return out; // note: raw_value is never included
  }

  function fixtureAgeDays(generatedAtUtc, nowMs) {
    const t = Date.parse(generatedAtUtc);
    if (Number.isNaN(t)) return null;
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    return Math.floor((now - t) / 86400000);
  }

  /** Timezone readiness display state. Absent/non-boolean => UNKNOWN, never READY. */
  function timezoneStatus(enigma) {
    const v = enigma ? enigma.timezone_ready : undefined;
    if (typeof v !== "boolean") return { text: "UNKNOWN — NOT REPORTED", cls: "warn" };
    if (v) return { text: "READY" + (enigma.timezone_ready_source ? " (" + enigma.timezone_ready_source + ")" : ""), cls: "ok" };
    return { text: "NOT READY", cls: "danger" };
  }

  // ------------------------------------------------------------- DOM-safe helpers
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.setAttribute("class", className);
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function stat(label, value) {
    const wrap = el("div", "stat");
    wrap.appendChild(el("div", "label", label));
    wrap.appendChild(el("div", "value", value));
    return wrap;
  }
  function badge(text, cls) { return el("span", "badge" + (cls ? " " + cls : ""), text); }
  function shortHash(h) { return typeof h === "string" && h.length >= 16 ? h.slice(0, 8) + "…" + h.slice(-4) : String(h); }

  // -------------------------------------------------------------------- rendering
  function renderError(root, message) {
    root.textContent = "";
    const box = el("div", "notice danger");
    box.setAttribute("role", "alert");
    box.appendChild(el("strong", null, "Enigma shadow bundle unavailable. "));
    box.appendChild(document.createTextNode(String(message)));
    root.appendChild(box);
  }

  function renderLabels(root) {
    const bar = el("div", "enigma-shadow-labels");
    ["V2 SHADOW", "INTERNAL DIAGNOSTIC", "NOT PRODUCTION AUTHORITY",
      "V1 REMAINS AUTHORITATIVE", "MOCK FIXTURE — NON-OPERATIONAL"].forEach((t, i) => {
      bar.appendChild(badge(t, i === 4 ? "violet" : (i >= 2 ? "warn" : "danger")));
    });
    root.appendChild(bar);
  }

  function renderHeader(root, bundle) {
    const e = bundle.enigma;
    const sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Status header"));
    const grid = el("div", "grid");
    grid.appendChild(stat("Artifact kind", "Enigma event-lane shadow bundle"));
    grid.appendChild(stat("Schema", e.event_lane_schema_id + " v" + e.event_lane_schema_version));
    grid.appendChild(stat("Bundle schema", bundle.bundle_schema_id + " v" + bundle.bundle_schema_version));
    grid.appendChild(stat("Run identity (full)", e.run_id));
    grid.appendChild(stat("Run (short)", shortHash(e.run_id)));
    grid.appendChild(stat("Input artifact sha256 (full)", e.input_artifact_sha256));
    grid.appendChild(stat("Generated (UTC)", e.generated_at_utc));

    const tz = timezoneStatus(e);
    const tzStat = stat("Timezone readiness", tz.text);
    tzStat.querySelector(".value").setAttribute("class", "value " + tz.cls);
    grid.appendChild(tzStat);

    grid.appendChild(stat("Bundle validation", "VALIDATED"));

    const age = fixtureAgeDays(e.generated_at_utc);
    if (age !== null && age > STALE_FIXTURE_DAYS) {
      const warn = el("div", "notice warn");
      warn.setAttribute("role", "status");
      warn.textContent = "Fixture age " + age + " days exceeds " + STALE_FIXTURE_DAYS +
        " day threshold (stale MOCK fixture — not operational pipeline staleness).";
      sec.appendChild(grid);
      sec.appendChild(warn);
    } else {
      sec.appendChild(grid);
    }
    root.appendChild(sec);
  }

  function renderSummary(root, bundle, m) {
    const c = bundle.enigma.counts;
    const sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Processing summary"));
    const grid = el("div", "grid");
    grid.appendChild(stat("Observations", c.observations));
    grid.appendChild(stat("Processing results", c.processing_results));
    grid.appendChild(stat("Accepted rows (not unique events)", c.accepted));
    grid.appendChild(stat("Accepted distinct occurrence keys", c.accepted_distinct_occurrence_keys));
    grid.appendChild(stat("Occurrence collisions", m.collisions));
    grid.appendChild(stat("Rejected", m.perDisposition.REJECTED));
    grid.appendChild(stat("Blocked", m.perDisposition.BLOCKED));
    grid.appendChild(stat("Review required", m.perDisposition.REVIEW_REQUIRED));
    grid.appendChild(stat("Pre-observation failures", c.pre_observation_failures));
    grid.appendChild(stat("Terminal outcomes", c.terminal_outcomes));
    grid.appendChild(stat("Silent loss", c.silent_loss));
    sec.appendChild(grid);
    root.appendChild(sec);
  }

  function renderCountTable(title, mapping) {
    const sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, title));
    const wrap = el("div", "table-wrap");
    const table = el("table");
    const thead = el("thead");
    const trh = el("tr");
    trh.appendChild(el("th", null, "Code"));
    trh.appendChild(el("th", null, "Count"));
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = el("tbody");
    Object.keys(mapping).forEach((k) => {
      const tr = el("tr");
      tr.appendChild(el("td", null, k));
      tr.appendChild(el("td", null, mapping[k]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    sec.appendChild(wrap);
    return sec;
  }

  function renderReasons(root, m) {
    root.appendChild(renderCountTable("Disposition counts", m.perDisposition));
    root.appendChild(renderCountTable("Post-observation reason codes", m.postReason));
    root.appendChild(renderCountTable("Pre-observation reason codes (separate namespace)", m.preReason));
  }

  function renderInspection(root, m) {
    const sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Event inspection (public-safe fields; raw_value never shown)"));
    m.orderedResults.forEach((r) => {
      const proj = projectEventForInspection(r);
      const det = el("details");
      const sum = el("summary", null,
        proj.disposition + " · " + (proj.occurrence_key || "(no normalized value)") +
        " · " + (proj.title || ""));
      det.appendChild(sum);
      const body = el("div");
      const wrap = el("div", "table-wrap");
      const table = el("table");
      const tbody = el("tbody");
      Object.keys(proj).forEach((k) => {
        const tr = el("tr");
        tr.appendChild(el("th", null, k));
        const td = el("td");
        const v = proj[k];
        td.textContent = Array.isArray(v) ? v.join(", ") : (v === null ? "—" : String(v));
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      body.appendChild(wrap);
      det.appendChild(body);
      sec.appendChild(det);
    });
    root.appendChild(sec);
  }

  function renderCollisions(root, m) {
    const sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Duplicate / collision diagnostics"));
    sec.appendChild(badge("RESOLUTION DEFERRED TO SHADOW-1", "violet"));
    if (!m.collisionGroups.length) {
      sec.appendChild(el("p", "empty", "No accepted occurrence-key collisions in this bundle."));
      root.appendChild(sec);
      return;
    }
    m.collisionGroups.forEach((g) => {
      const grid = el("div", "grid");
      grid.appendChild(stat("Occurrence key", g.occurrence_key));
      grid.appendChild(stat("Accepted row count", g.accepted_row_count));
      grid.appendChild(stat("Distinct observations", g.distinct_observation_count));
      const dist = Object.keys(g.source_dataset_distribution)
        .map((d) => d + ": " + g.source_dataset_distribution[d]).join("  ·  ");
      grid.appendChild(stat("Source-dataset distribution", dist));
      sec.appendChild(grid);
    });
    root.appendChild(sec);
  }

  function renderReadiness(root) {
    const gates = [
      ["CORE-1.1 accepted", "ok"],
      ["CORE-2.1 accepted", "ok"],
      ["Timezone readiness (producer-authoritative)", "warn"],
      ["Lane projections", "DEFERRED"],
      ["Duplicate policy", "DEFERRED"],
      ["Multi-day expansion", "DEFERRED"],
      ["review_supplemental normalization", "DEFERRED"],
      ["Incoming schema-version gate", "DEFERRED"],
      ["SHADOW-1 authority", "NON-AUTHORITATIVE"],
      ["Production deployment", "BLOCKED"],
    ];
    const sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "Readiness gates"));
    const grid = el("div", "grid");
    gates.forEach(([label, state]) => {
      const cls = state === "ok" ? "ok" : state === "BLOCKED" ? "danger" : "warn";
      const s = stat(label, state === "ok" ? "ACCEPTED" : state);
      s.querySelector(".value").setAttribute("class", "value " + cls);
      grid.appendChild(s);
    });
    sec.appendChild(grid);
    root.appendChild(sec);
  }

  function renderComparisonPlaceholder(root) {
    const sec = el("section", "enigma-shadow-block");
    sec.appendChild(el("h3", null, "V1 / V2 comparison"));
    sec.appendChild(badge("NOT IMPLEMENTED", "warn"));
    const grid = el("div", "grid");
    ["V1 occurrence count", "V2 accepted distinct occurrences", "Overlap", "V1-only",
      "V2-only", "Field agreement", "Reason/disposition differences"].forEach((label) => {
      grid.appendChild(stat(label, "—"));
    });
    sec.appendChild(grid);
    sec.appendChild(el("p", "empty", "Comparison is defined for SHADOW-1 and is not computed here."));
    root.appendChild(sec);
  }

  function render(root, bundle) {
    const m = deriveMetrics(bundle);
    root.textContent = "";
    renderLabels(root);
    renderHeader(root, bundle);
    renderSummary(root, bundle, m);
    renderReasons(root, m);
    renderInspection(root, m);
    renderCollisions(root, m);
    renderReadiness(root);
    renderComparisonPlaceholder(root);
  }

  async function boot() {
    const root = document.getElementById(MOUNT_ID);
    if (!root) return; // not on the GodView page; do nothing
    try {
      const url = FIXTURE_URL + "?v=" + Date.now();
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) { renderError(root, "HTTP " + response.status); return; }
      let bundle;
      try { bundle = await response.json(); }
      catch (ex) { renderError(root, "fixture is not valid JSON"); return; }
      const verdict = validateBundle(bundle);
      if (!verdict.ok) { renderError(root, "fixture failed validation (fail-closed): " + verdict.errors[0]); return; }
      render(root, bundle);
    } catch (ex) {
      renderError(root, "fixture could not be loaded");
    }
  }

  // Expose the pure layer for manual/console verification and tests (read-only).
  const PURE_API = {
    VERSION, validateBundle, deriveMetrics, computeOccurrenceKey,
    projectEventForInspection, fixtureAgeDays, timezoneStatus, render, renderError,
  };
  if (typeof window !== "undefined") {
    window.EnigmaShadowStatus = PURE_API;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PURE_API; // Node import for tests; DOM code stays guarded off.
  }

  if (typeof document !== "undefined") {
    if (document.readyState !== "loading") boot();
    else document.addEventListener("DOMContentLoaded", boot);
  }
})();
