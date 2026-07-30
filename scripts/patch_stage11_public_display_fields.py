#!/usr/bin/env python3
"""Install the narrowly scoped Stage 11 reader-facing field repair.

The patch preserves only public, whitelisted metadata and adds presentation for
fields already available in the feed. Every source replacement is fail-closed.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app-schema-v1-major-all-v01.js"
SCHEMA = ROOT / "event-feed-schema-v1.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one source match, found {count}")
    return text.replace(old, new, 1)


def schema_installed(text: str) -> bool:
    return all(token in text for token in (
        "official_url:", "is_free:", "source_url:", "url: sourceUrl",
    ))


def app_installed(text: str) -> bool:
    return all(token in text for token in (
        "function sourceDisplayLabel", "eventTypeLabel:", "verificationLabel:",
        "addSourceRow();", "item-when", "✓ Verified",
    ))


def patch_schema(text: str) -> str:
    if schema_installed(text):
        return text
    text = replace_once(
        text,
        """  function resolveSourceFields(row) {
    const nested = row.source && typeof row.source === 'object' ? row.source : null;
    return {
      dataset: nested?.dataset ?? row.source_dataset ?? null,
      sourceEventId: nested?.source_event_id ?? row.source_event_id ?? null
    };
  }""",
        """  function resolveSourceFields(row) {
    const nested = row.source && typeof row.source === 'object' ? row.source : null;
    return {
      dataset: nested?.dataset ?? row.source_dataset ?? null,
      sourceEventId: nested?.source_event_id ?? row.source_event_id ?? null,
      sourceUrl: nested?.url ?? nested?.source_url ?? row.official_url ?? row.source_url ?? row.url ?? null
    };
  }""",
        "source URL resolution",
    )
    text = replace_once(
        text,
        """  function buildLegacySourceObject(dataset, sourceEventId) {
    return {
      dataset: dataset == null ? null : String(dataset),
      source_event_id: sourceEventId == null ? null : String(sourceEventId)
    };
  }""",
        """  function buildLegacySourceObject(dataset, sourceEventId, sourceUrl) {
    return {
      dataset: dataset == null ? null : String(dataset),
      source_event_id: sourceEventId == null ? null : String(sourceEventId),
      url: sourceUrl == null || sourceUrl === '' ? null : String(sourceUrl)
    };
  }""",
        "legacy source object",
    )
    text = replace_once(
        text,
        """    const { dataset, sourceEventId } = resolveSourceFields(row);""",
        """    const { dataset, sourceEventId, sourceUrl } = resolveSourceFields(row);""",
        "legacy source destructure",
    )
    text = replace_once(
        text,
        """      significance: row.significance ?? null,
      source: buildLegacySourceObject(dataset, sourceEventId),
      nycif: buildLegacyNycifBlock(row, dataLayer, day, coords)""",
        """      significance: row.significance ?? null,
      cost: row.cost ?? row.price ?? row.admission ?? null,
      is_free: row.is_free ?? row.free ?? null,
      official_url: row.official_url ?? row.source_url ?? row.url ?? sourceUrl ?? null,
      source: buildLegacySourceObject(dataset, sourceEventId, sourceUrl),
      nycif: buildLegacyNycifBlock(row, dataLayer, day, coords)""",
        "legacy public fields",
    )
    text = replace_once(
        text,
        """      significance: row.significance ?? null,
      source: {
        dataset: row.source.dataset == null ? null : String(row.source.dataset),
        source_event_id: row.source.source_event_id == null ? null : String(row.source.source_event_id)
      },
      nycif""",
        """      significance: row.significance ?? null,
      cost: row.cost ?? row.price ?? row.admission ?? nycif.cost ?? null,
      is_free: row.is_free ?? row.free ?? nycif.is_free ?? null,
      official_url: row.official_url ?? row.source_url ?? row.url ?? row.source.url ?? row.source.source_url ?? null,
      source: {
        dataset: row.source.dataset == null ? null : String(row.source.dataset),
        source_event_id: row.source.source_event_id == null ? null : String(row.source.source_event_id),
        url: row.source.url == null && row.source.source_url == null
          ? null
          : String(row.source.url ?? row.source.source_url)
      },
      nycif""",
        "schema public fields",
    )
    if not schema_installed(text):
        raise RuntimeError("schema public field repair did not install")
    return text


def patch_app(text: str) -> str:
    if app_installed(text):
        return text
    text = replace_once(
        text,
        """  function toUiEvent(schemaEvent) {""",
        """  function sourceDisplayLabel(value) {
    const dataset = String(value || '').trim();
    const known = {
      'nyc-citywide-events-calendar-api': 'NYC Citywide Events Calendar',
      'nyc-parks-bigapps-events': 'NYC Parks',
      'tvpp-9vvx': 'NYC Permitted Events',
      'nyc-permitted-events': 'NYC Permitted Events'
    };
    if (known[dataset]) return known[dataset];
    return dataset
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase())
      .trim();
  }

  function publicCostLabel(schemaEvent, nycif) {
    const free = schemaEvent.is_free ?? nycif.is_free;
    if (free === true || norm(free) === 'true' || norm(free) === 'yes' || norm(free) === 'free') {
      return 'Free';
    }
    const raw = schemaEvent.cost ?? schemaEvent.price ?? schemaEvent.admission ?? nycif.cost;
    return raw == null || String(raw).trim() === '' ? '' : String(raw).trim();
  }

  function publicVerificationLabel(value) {
    const key = norm(value);
    if (!key) return '';
    if (key === 'verified') return 'Verified';
    if (key === 'official source') return 'Official source';
    if (key === 'pending' || key === 'needs review') return 'Pending verification';
    return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function toUiEvent(schemaEvent) {""",
        "public field helpers",
    )
    text = replace_once(
        text,
        """       verification_status: nycif.verification_status,
       major_reason: nycif.major_reason,""",
        """       verification_status: nycif.verification_status,
       verificationLabel: publicVerificationLabel(nycif.verification_status),
       eventTypeLabel: String(nycif.event_type || schemaEvent.event_type || '').trim(),
       costLabel: publicCostLabel(schemaEvent, nycif),
       sourceLabel: sourceDisplayLabel(schemaEvent.source?.dataset),
       officialUrl: SCHEMA.safeExternalUrl(schemaEvent.official_url || schemaEvent.source?.url),
       major_reason: nycif.major_reason,""",
        "UI public fields",
    )
    text = replace_once(
        text,
        """    addRow('Date', formatDateSpan(e));
    addRow('Time', formatTimeRange(e));
    addRow('Borough', e.borough);
    addRow('Location', e.location);
    root.appendChild(dl);""",
        """    addRow('Date', formatDateSpan(e));
    addRow('Time', formatTimeRange(e));
    addRow('Type', e.eventTypeLabel);
    addRow('Borough', e.borough);
    addRow('Location', e.location);
    addRow('Cost', e.costLabel);
    addRow('Verification', e.verificationLabel);
    const addSourceRow = () => {
      if (!e.sourceLabel) return;
      const wrap = document.createElement('div');
      appendText(wrap, 'dt', 'Source');
      const dd = document.createElement('dd');
      if (!appendSafeLink(dd, e.officialUrl, e.sourceLabel)) {
        dd.textContent = e.sourceLabel;
      }
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    };
    addSourceRow();
    root.appendChild(dl);""",
        "popup public fields",
    )
    text = replace_once(
        text,
        """    if (e.isMajor && !e.medal) {
      appendText(tags, 'span', '⭐ Featured', 'item-tag featured');
    }
    if (!e.mapReady) {""",
        """    if (e.isMajor && !e.medal) {
      appendText(tags, 'span', '⭐ Featured', 'item-tag featured');
    }
    if (e.verificationLabel === 'Verified' || e.verificationLabel === 'Official source') {
      appendText(tags, 'span', '✓ Verified', 'item-tag verified');
    }
    if (e.costLabel === 'Free') {
      appendText(tags, 'span', 'Free', 'item-tag free');
    }
    if (!e.mapReady) {""",
        "list verification tags",
    )
    text = replace_once(
        text,
        """    appendText(button, 'strong', e.title);
    appendText(button, 'span', formatDateSpan(e));
    appendText(button, 'small', [e.borough, e.location].filter(Boolean).join(' • '));""",
        """    appendText(button, 'strong', e.title);
    appendText(button, 'span', `${formatDateSpan(e)} · ${formatTimeRange(e)}`, 'item-when');
    appendText(button, 'small', [e.borough, e.location].filter(Boolean).join(' • '));""",
        "list date and time",
    )
    if not app_installed(text):
        raise RuntimeError("app public field repair did not install")
    return text


def main() -> int:
    schema = SCHEMA.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    patched_schema = patch_schema(schema)
    patched_app = patch_app(app)
    SCHEMA.write_text(patched_schema, encoding="utf-8")
    APP.write_text(patched_app, encoding="utf-8")
    print("Stage 11 public display fields installed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
