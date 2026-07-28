from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
SCRIPT = (ROOT / "accessibility-v01.js").read_text(encoding="utf-8")
STYLES = (ROOT / "accessibility-v01.css").read_text(encoding="utf-8")
DESKTOP_TEST = (ROOT / "tests" / "desktop-release-gates.mjs").read_text(encoding="utf-8")
DESKTOP_WORKFLOW = (ROOT / ".github" / "workflows" / "desktop-release-gates.yml").read_text(encoding="utf-8")


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
    assert 'class="boroughs" id="boroughs" role="group" aria-label="Filter by borough"' in INDEX
    assert 'id="sortSelect" aria-label="Sort events"' in INDEX
    assert "aria-pressed" in SCRIPT
    assert "aria-current" in SCRIPT


def test_markers_and_popups_support_keyboard_and_focus():
    assert "marker.setAttribute('role', 'button')" in SCRIPT
    assert "marker.setAttribute('aria-haspopup', 'dialog')" in SCRIPT
    assert "event.key === ' '" in SCRIPT
    assert "content.setAttribute('role', 'dialog')" in SCRIPT
    assert "focusSafely(content)" in SCRIPT
    assert "logicalPopupRestoreTarget" in SCRIPT
    assert "lastInvokerWasInDesk" in SCRIPT
    assert "return byId('deskBtn')" in SCRIPT
    assert "event.key !== 'Escape'" in SCRIPT


def test_nested_event_card_links_are_separated():
    assert "event-item-wrap" in SCRIPT
    assert "wrapper.appendChild(link)" in SCRIPT
    assert "Get directions for" in SCRIPT
    assert ".event-item-wrap" in STYLES
    assert "min-height: 44px" in STYLES
    assert "min-width: 44px" in STYLES


def test_reduced_motion_list_activation_survives_marker_rebuild():
    assert "installReducedMotionListActivationFallback" in SCRIPT
    assert "reducedMotionRetryTimer" in SCRIPT
    assert "retryingEventId" in SCRIPT
    assert "markerNearestMapCenter" in SCRIPT
    assert "marker.click()" in SCRIPT
    assert "chooseStackedEvent" in SCRIPT
    assert "if (document.querySelector('.leaflet-popup')) return" in SCRIPT


def test_popup_keeps_engagement_controls_visible():
    for selector in (
        "body.public-map-page.nycif-popup-open .brand-header-row",
        "body.public-map-page.nycif-popup-open .date-chips",
        "body.public-map-page.nycif-popup-open .map-controls",
        "body.public-map-page.nycif-popup-open .desk-btn",
    ):
        assert selector in STYLES
    assert "z-index: 2700 !important" in STYLES
    assert "body.public-map-page.nycif-popup-open .layers-panel" in STYLES
    assert "body.public-map-page.nycif-popup-open .desk-drawer" in STYLES


def test_popup_close_icon_is_compact_with_accessible_touch_target():
    selector = "body.public-map-page .nycif-event-popup .leaflet-popup-close-button"
    assert selector in STYLES
    assert "width: 44px !important" in STYLES
    assert "height: 44px !important" in STYLES
    assert f"{selector}::before" in STYLES
    assert "width: 24px" in STYLES
    assert "height: 24px" in STYLES
    assert 'content: "\\00d7"' in STYLES


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


def test_desktop_browser_gate_covers_required_release_path():
    for evidence in (
        "#layersBtn",
        "#deskBtn",
        "button.event-item",
        "leaflet-popup-content[role=\"dialog\"]",
        "page.keyboard.press('Escape')",
        "page.keyboard.press('Space')",
        "AxeBuilder",
        "seriousOrCritical",
        "INIT_BUDGET_MS",
        "reducedMotion",
    ):
        assert evidence in DESKTOP_TEST
    assert "playwright" in DESKTOP_WORKFLOW
    assert "desktop-release-gates.mjs" in DESKTOP_WORKFLOW
    assert "actions/upload-artifact@v4" in DESKTOP_WORKFLOW


def run_contract_tests():
    tests = [
        value
        for name, value in sorted(globals().items())
        if name.startswith("test_") and callable(value)
    ]
    for test in tests:
        test()
    print(f"{len(tests)} accessibility contract tests passed")


if __name__ == "__main__":
    run_contract_tests()
