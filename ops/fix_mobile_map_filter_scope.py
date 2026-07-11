from pathlib import Path

path = Path(__file__).resolve().parents[1] / "platform_v2/src/ui/mapExplorer.ts"
source = path.read_text(encoding="utf-8")

replacements = [
    (
        "map shell handle",
        """  var root = document.getElementById('map-explorer');
  if (!root) return;
  var statusEl = document.getElementById('me-map-status');""",
        """  var root = document.getElementById('map-explorer');
  if (!root) return;
  var mapShellEl = root.closest('.me-section') || root.parentElement;
  var statusEl = document.getElementById('me-map-status');""",
    ),
    (
        "filter close scope",
        """    filterDrawerEl.removeAttribute('open');
    root.classList.remove('me-filter-open');""",
        """    filterDrawerEl.removeAttribute('open');
    if (mapShellEl) mapShellEl.classList.remove('me-filter-open');""",
    ),
    (
        "filter toggle scope",
        """      var open = filterDrawerEl.hasAttribute('open');
      root.classList.toggle('me-filter-open', open);""",
        """      var open = filterDrawerEl.hasAttribute('open');
      if (mapShellEl) mapShellEl.classList.toggle('me-filter-open', open);""",
    ),
]

for label, old, new in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
print("mobile map filter scope correction applied")
