from pathlib import Path

shell_path = Path("platform_v2/src/ui/siteShell.ts")
test_path = Path("platform_v2/src/ui/siteShell.test.ts")
source = shell_path.read_text(encoding="utf-8")
tests = test_path.read_text(encoding="utf-8")


def replace_exact(text: str, old: str, new: str, *, expected: int = 1, label: str) -> str:
    actual = text.count(old)
    if actual != expected:
        raise SystemExit(f"{label}: expected {expected} matches, found {actual}")
    return text.replace(old, new)


source = replace_exact(
    source,
    "  let latestCaptureLocation = null;\n  let captureLocationRequest = null;",
    "  let latestCaptureLocation = null;\n  let latestCaptureLocationAt = 0;\n  let captureLocationRequest = null;",
    label="location cache timestamp state",
)

source = replace_exact(
    source,
    """  const requestCaptureLocation = () => {
    if (latestCaptureLocation) return Promise.resolve(latestCaptureLocation);
    if (captureLocationRequest) return captureLocationRequest;
    if (!(navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function')) {
      return Promise.resolve(null);
    }
    captureLocationRequest = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = Number(position && position.coords && position.coords.latitude);
          const longitude = Number(position && position.coords && position.coords.longitude);
          latestCaptureLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude, accuracy: Number(position.coords.accuracy) || null }
            : null;
          resolve(latestCaptureLocation);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    }).finally(() => {
      captureLocationRequest = null;
    });
    return captureLocationRequest;
  };""",
    """  const requestCaptureLocation = (forceFresh = false) => {
    if (captureLocationRequest) return captureLocationRequest;
    const cacheAgeMs = Date.now() - Number(latestCaptureLocationAt || 0);
    if (!forceFresh && latestCaptureLocation && cacheAgeMs >= 0 && cacheAgeMs <= 15000) {
      return Promise.resolve(latestCaptureLocation);
    }
    if (!(navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function')) {
      return Promise.resolve(null);
    }
    captureLocationRequest = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = Number(position && position.coords && position.coords.latitude);
          const longitude = Number(position && position.coords && position.coords.longitude);
          latestCaptureLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude, accuracy: Number(position.coords.accuracy) || null }
            : null;
          latestCaptureLocationAt = latestCaptureLocation ? Date.now() : 0;
          resolve(latestCaptureLocation);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: forceFresh ? 0 : 15000 },
      );
    }).finally(() => {
      captureLocationRequest = null;
    });
    return captureLocationRequest;
  };""",
    label="fresh location helper",
)

source = replace_exact(
    source,
    "      const resolvedLocation = metadata.location || await requestCaptureLocation();",
    "      const resolvedLocation = await requestCaptureLocation(true) || metadata.location;",
    label="force fresh location on submit",
)

source = replace_exact(
    source,
    "    if (kind === 'photo') void requestCaptureLocation();",
    """    if (kind === 'photo') {
      latestCaptureLocation = null;
      latestCaptureLocationAt = 0;
      void requestCaptureLocation(true);
    }""",
    label="reset location for each photo flow",
)

tests = replace_exact(
    tests,
    "  assert.match(html, /const resolvedLocation = metadata\\.location \\|\\| await requestCaptureLocation\\(\\);/);",
    """  assert.match(html, /const resolvedLocation = await requestCaptureLocation\\(true\\) \\|\\| metadata\\.location;/);
  assert.match(html, /let latestCaptureLocationAt = 0;/);
  assert.match(html, /maximumAge: forceFresh \\? 0 : 15000/);
  assert.match(html, /latestCaptureLocation = null;\\s+latestCaptureLocationAt = 0;\\s+void requestCaptureLocation\\(true\\);/);""",
    label="fresh location regression assertions",
)

shell_path.write_text(source, encoding="utf-8")
test_path.write_text(tests, encoding="utf-8")
