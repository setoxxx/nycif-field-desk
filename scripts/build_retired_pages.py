#!/usr/bin/env python3
"""Build the Field Desk retirement-only GitHub Pages artifact.

This intentionally publishes no Field Desk application, admin, preview, test,
feed, or operator surface. Source remains in Git; the Pages artifact contains
only the canonical redirect and cache-retirement service worker.
"""

from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/nycif-field-desk-pages')

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

for name in ('index.html', 'service-worker.js'):
    source = ROOT / name
    if not source.is_file() or source.stat().st_size == 0:
        raise SystemExit(f'missing required retirement surface: {name}')
    shutil.copy2(source, OUT / name)

(OUT / '.nojekyll').touch()

allowed = {'index.html', 'service-worker.js', '.nojekyll'}
actual = {p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file()}
if actual != allowed:
    raise SystemExit(f'unexpected Pages artifact files: {sorted(actual - allowed)}')

for forbidden in (
    'admin',
    'approved-export-preview.html',
    'desk.html',
    'live-alerts.html',
    'live-qa-standalone.html',
    'mobile.html',
    'nightlife-preview.html',
    'preview-major-feed-review.html',
    'prototype-major-events-review.html',
    'public.html',
    'special-overlays-test.html',
    'web.html',
):
    if (OUT / forbidden).exists():
        raise SystemExit(f'legacy route leaked into Pages artifact: {forbidden}')

print('FIELD_DESK_RETIREMENT_ONLY_PAGES_ARTIFACT_PASS')
print('\n'.join(sorted(actual)))
