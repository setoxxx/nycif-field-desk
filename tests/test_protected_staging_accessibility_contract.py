from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
SCRIPT = (ROOT / "accessibility-v01.js").read_text(encoding="utf-8")
STYLES = (ROOT / "accessibility-v01.css").read_text(encoding="utf-8")


def test_map_has_region_semantics_and_text_alternative_path():
    assert 'id="map" class="map" role="region" tabindex="0"' in INDEX
    assert "Use the Event List button for an equivalent text list" in INDEX
    assert 'role="application"' not in INDEX
    assert 'class="a11y-skip-link"' in INDEX


def test_dynamic_statuses_are_polite_live_regions():
    for element_id in ("brandCount", "viewBanner", "indexStatus", "listMeta", "status"):
        marker = f'id="{element_id}"'
        start = INDEX.index(marker)
        fragment = INDEX[start : start + 180]
        assert 'role="status"' in fragment
        assert 'aria-live="polite"' in fragment


def test_filter_groups_and_sort_have_accessible_names():
    assert 'id="dateChips" class="date-chips" role="group"' in INDEX
    assert 'id="boroughs" role="group" aria-label="Filter by borough"' in INDEX
    assert 'id="sortSelect" aria-label="Sort events"' in INDEX
    assert "aria-pressed" in SCRIPT
    assert "aria-current" in SCRIPT


def test_markers_and_popups_support_keyboard_and_focus():
    assert "marker.setAttribute('role', 'button')" in SCRIPT
    assert "marker.setAttribute('aria-haspopup', 'dialog')" in SCRIPT
    assert "event.key === ' '" in SCRIPT
    assert "content.setAttribute('role', 'dialog')" in SCRIPT
    assert "focusSafely(content)" in SCRIPT
    assert "focusSafely(state.lastInvoker)" in SCRIPT
    assert "event.key !== 'Escape'" in SCRIPT


def test_nested_event_card_links_are_separated():
    assert "event-item-wrap" in SCRIPT
    assert "wrapper.appendChild(link)" in SCRIPT
    assert "Get directions for" in SCRIPT
    assert ".event-item-wrap" in STYLES
    assert "min-height: 44px" in STYLES
    assert "min-width: 44px" in STYLES


def test_visible_focus_and_reduced_motion_are_enforced():
    assert ":focus-visible" in STYLES
    assert "prefers-reduced-motion: reduce" in STYLES
    assert "prefers-reduced-motion: reduce" in SCRIPT
    assert "animate: false" in SCRIPT


def test_accessibility_assets_are_loaded_after_runtime():
    runtime_position = INDEX.index("app-schema-v1-major-all-v01.js")
    accessibility_position = INDEX.index("accessibility-v01.js")
    assert accessibility_position > runtime_position
    assert "accessibility-v01.css" in INDEX
