import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./siteShell.ts", import.meta.url), "utf8");

test("mobile footer quick record saves a reviewed photo with one tap", () => {
  assert.doesNotMatch(source, /もう一度押すと記録/);
  assert.doesNotMatch(source, /記録するなら同じボタンをもう一度押してください/);
  assert.match(
    source,
    /if \(activeKind === 'photo' && selectedPhotoDraftFiles\(\)\.length > 0 && !activeStream\) \{[\s\S]*?if \(captureButton\) captureButton\.disabled = true;[\s\S]*?await directPostPhotoDraft\(\);/,
  );
});

test("reviewed photos make save the primary action and keep add-another secondary", () => {
  assert.match(source, /if \(files\.length > 0\) \{\s*setFooterActionMode\('submit'\);/);
  assert.match(source, /右で記録、左でもう1枚撮れます。/);
});
