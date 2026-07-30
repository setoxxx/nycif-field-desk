#!/usr/bin/env python3
"""Preserve public classification fields through the frontend schema projection."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "event-feed-schema-v1.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def main() -> int:
    text = SCHEMA.read_text(encoding="utf-8")
    if "event_role: row.event_role ?? row.nycif?.event_role" in text and "event_role: row.event_role ?? nycif.event_role" in text:
        print("Stage 11 public classification fields already preserved")
        return 0

    text = replace_once(
        text,
        """      significance: row.significance ?? null,
      cost: row.cost ?? row.price ?? row.admission ?? null,""",
        """      significance: row.significance ?? null,
      event_role: row.event_role ?? row.nycif?.event_role ?? 'public_event',
      parent_event_id: row.parent_event_id ?? row.nycif?.parent_event_id ?? null,
      interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      cost: row.cost ?? row.price ?? row.admission ?? null,""",
        "legacy classification fields",
    )
    text = replace_once(
        text,
        """      significance: row.significance ?? null,
      cost: row.cost ?? row.price ?? row.admission ?? nycif.cost ?? null,""",
        """      significance: row.significance ?? null,
      event_role: row.event_role ?? nycif.event_role ?? 'public_event',
      parent_event_id: row.parent_event_id ?? nycif.parent_event_id ?? null,
      interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      cost: row.cost ?? row.price ?? row.admission ?? nycif.cost ?? null,""",
        "schema classification fields",
    )
    SCHEMA.write_text(text, encoding="utf-8")
    print("Stage 11 public classification fields preserved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
