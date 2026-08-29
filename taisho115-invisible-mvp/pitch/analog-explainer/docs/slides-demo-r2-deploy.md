# Slides Demo R2 Deploy Runbook

Target URL:

- `https://aboost.nexchat.cloud/slides-demo/`

Source:

- `E:\Projects\Playground\taisho115-invisible-mvp\pitch\analog-explainer`

R2 target:

- bucket: `nexchat-taisho115-assets`
- key prefix: `game-test/taisho115/slides-demo/`

## Build And QA

For narration, use VOICEVOX and rebuild the demo manifest/audio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-demo-voicevox-deploy.ps1 -SkipDeploy -SkipPublicQa
```

For UI-only fixes where narration does not change, run:

```powershell
npm run qa
npm run check
$env:DECK_URL = "http://127.0.0.1:4186/?demo"
powershell -ExecutionPolicy Bypass -File E:\Projects\00_all_projects_management\scripts\run_playwright.ps1 -ScriptPath .\scripts\qa-demo-feedback.cjs
```

## R2 Upload Scope

Upload to `nexchat-taisho115-assets/game-test/taisho115/slides-demo/`.

Always upload:

- `dist/index.html`
- `dist/assets/index-*.js`
- `dist/assets/index-*.css`

When narration or slide count changes, also upload:

- `dist/assets/demo-narration/slide-manifest.json`
- `dist/assets/demo-narration/slides/slide-*.wav`

Use `Cache-Control: no-store` for `index.html`, manifest, and reused audio filenames. Hashed JS/CSS can use immutable cache.

## Live Smoke

After upload:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://aboost.nexchat.cloud/slides-demo/" -Headers @{ "Cache-Control" = "no-cache" }
$env:DECK_URL = "https://aboost.nexchat.cloud/slides-demo/"
powershell -ExecutionPolicy Bypass -File E:\Projects\00_all_projects_management\scripts\run_playwright.ps1 -ScriptPath .\scripts\qa-demo-feedback.cjs
```

The feedback QA covers desktop/mobile rendering, narration manifest alignment, rapid page navigation audio restarts, and early spoiler labels.
