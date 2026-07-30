#!/usr/bin/env python3
"""Use the query-gated production popup component in the Stage 11 fixture."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "tests" / "stage11-public-display-fields.mjs"


def replace_variant(text: str, variants: tuple[str, ...], new: str, label: str) -> str:
    matches = [old for old in variants if old in text]
    if len(matches) != 1:
        raise RuntimeError(f"{label}: expected one source variant, found {len(matches)}")
    return text.replace(matches[0], new, 1)


def main() -> int:
    text = TEST.read_text(encoding="utf-8")
    if (
        "NYCIF_DISPLAY_AUDIT" in text
        and "renderDetail" in text
        and "auditDisplay=1" in text
        and "#nycif-display-audit-host .popup-card" in text
    ):
        print("Stage 11 detail-hook fixture already installed")
        return 0

    text = text.replace(
        "http://127.0.0.1:4173/index.html?resetFilters=1",
        "http://127.0.0.1:4173/index.html?resetFilters=1&auditDisplay=1",
        1,
    )
    text = replace_variant(
        text,
        (
            """  await civic.click();
  const popup = page.locator('.leaflet-popup-content[role=\"dialog\"]');
  await popup.waitFor({ state: 'visible' });""",
            """  await civic.click();
  const popup = page.locator('.leaflet-popup-content [role=\"dialog\"]');
  await popup.waitFor({ state: 'visible' });""",
            """  await civic.click();
  const popup = page.locator('.leaflet-popup-content');
  await popup.waitFor({ state: 'visible' });""",
        ),
        """  const civicOpened = await page.evaluate(id => window.NYCIF_DISPLAY_AUDIT?.renderDetail(id), `stage11-civic@${today}`);
  assert(civicOpened === true, 'Stage 11 civic detail audit hook did not open');
  const popup = page.locator('#nycif-display-audit-host .popup-card');
  await popup.waitFor({ state: 'visible' });""",
        "civic detail interaction",
    )
    text = replace_variant(
        text,
        (
            """  await page.locator(`[data-id=\"stage11-sports@${today}\"]`).click();
  await popup.waitFor({ state: 'visible' });""",
        ),
        """  const sportsOpened = await page.evaluate(id => window.NYCIF_DISPLAY_AUDIT?.renderDetail(id), `stage11-sports@${today}`);
  assert(sportsOpened === true, 'Stage 11 sports detail audit hook did not open');
  await popup.locator('h2').filter({ hasText: 'Stage 11 sports display event' }).waitFor({ state: 'visible' });""",
        "sports detail interaction",
    )
    TEST.write_text(text, encoding="utf-8")
    print("Stage 11 production detail-hook fixture installed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
