#!/usr/bin/env python3
"""Run the Stage 11 public-field patch with the corrected installed-state gate."""
from __future__ import annotations

import patch_stage11_public_display_fields as patch


def corrected_schema_installed(text: str) -> bool:
    return all(token in text for token in (
        "official_url:", "is_free:", "nested?.source_url", "url: sourceUrl",
    ))


patch.schema_installed = corrected_schema_installed

if __name__ == "__main__":
    raise SystemExit(patch.main())
