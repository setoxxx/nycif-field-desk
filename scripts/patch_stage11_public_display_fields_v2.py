#!/usr/bin/env python3
"""Run the Stage 11 public-field patch with corrected source-match gates."""
from __future__ import annotations

import patch_stage11_public_display_fields as patch


def corrected_schema_installed(text: str) -> bool:
    return all(token in text for token in (
        "official_url:", "is_free:", "nested?.source_url", "url: sourceUrl",
    ))


_original_replace_once = patch.replace_once


def corrected_replace_once(text: str, old: str, new: str, label: str) -> str:
    if label == "UI public fields" and text.count(old) == 0:
        old = """      verification_status: nycif.verification_status,
      major_reason: nycif.major_reason,"""
        new = """      verification_status: nycif.verification_status,
      verificationLabel: publicVerificationLabel(nycif.verification_status),
      eventTypeLabel: String(nycif.event_type || schemaEvent.event_type || '').trim(),
      costLabel: publicCostLabel(schemaEvent, nycif),
      sourceLabel: sourceDisplayLabel(schemaEvent.source?.dataset),
      officialUrl: SCHEMA.safeExternalUrl(schemaEvent.official_url || schemaEvent.source?.url),
      major_reason: nycif.major_reason,"""
    return _original_replace_once(text, old, new, label)


patch.schema_installed = corrected_schema_installed
patch.replace_once = corrected_replace_once

if __name__ == "__main__":
    raise SystemExit(patch.main())
