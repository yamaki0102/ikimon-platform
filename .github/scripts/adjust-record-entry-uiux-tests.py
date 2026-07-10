from pathlib import Path

path = Path("platform_v2/src/ui/siteShell.test.ts")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        '  assert.equal(html.match(/data-global-record-trigger="(?:photo|video|gallery)"/g)?.length, 3);',
        '  assert.equal(html.match(/data-global-record-trigger="(?:photo|video|gallery)"/g)?.length, 5);',
        "global record trigger count",
    ),
    (
        '  assert.match(html, /class="btn btn-solid site-record-link" href="\\/ja\\/record">記録する<\\/a>/);',
        '  assert.match(html, /class="btn btn-solid site-record-link" href="\\/ja\\/record\\?start=photo" data-global-record-trigger="photo" data-record-target="\\/ja\\/record\\?start=photo" data-kpi-action="header_record_photo">記録する<\\/a>/);',
        "minimal chrome record launcher",
    ),
    (
        '  assert.doesNotMatch(html, /navigator\\.geolocation\\.getCurrentPosition/);',
        '  assert.match(html, /navigator\\.geolocation\\.getCurrentPosition/);',
        "quick record geolocation expectation",
    ),
    (
        '  assert.match(html, /地点を確認してから記録します。記録画面で場所を選べます。/);',
        '  assert.match(html, /撮影地点を確認しています/);\n  assert.match(html, /位置情報を取得できなかったため、写真を保持して記録画面へ移動します。/);',
        "quick record location fallback copy",
    ),
]

for old, new, label in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new)

path.write_text(text, encoding="utf-8")
