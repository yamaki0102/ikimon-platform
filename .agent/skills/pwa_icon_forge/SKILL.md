---
name: "PWA Icon Forge"
description: "マスター画像1枚から PWA アイコン一式を一括生成する汎用スキル。デフリンジ処理、maskable 対応、OGP 生成を含む。"
---

# PWA Icon Forge 🔨

マスター画像1枚から、PWA に必要な全アイコンを一括生成するスキル。
どのプロジェクトでも使える。

## いつ使う？

- ユーザーが「PWAアイコンを整備して」「ロゴを全部統一して」と言った時
- 新規サイト立ち上げ時に PWA 対応が必要な時
- ロゴを差し替えた後、全サイズを再生成したい時
- アイコンがギザギザ・白フリンジ・円形切り抜きで崩れている時

## 前提条件

- Python 3 + Pillow (`pip install Pillow`)
- numpy (`pip install numpy`) — デフリンジ使用時のみ
- 512x512 以上の正方形 PNG マスター画像

## 生成されるファイル一覧

| ファイル名 | サイズ | 用途 |
|:---|:---|:---|
| `icon-192.png` | 192×192 | PWA manifest (purpose: any) |
| `icon-512.png` | 512×512 | PWA manifest (purpose: any) |
| `icon-192-maskable.png` | 192×192 | PWA manifest (purpose: maskable) |
| `icon-512-maskable.png` | 512×512 | PWA manifest (purpose: maskable) |
| `apple-touch-icon.png` | 180×180 | iOS ホーム画面 |
| `favicon-32.png` | 32×32 | ブラウザタブ |
| `ogp_default.png` | 1200×630 | SNS シェア (OGP) |

## 使い方

### 1. スクリプトの配置

このスキルの `scripts/generate_icons.py` をプロジェクトの `tools/` にコピーする。
既にプロジェクトに存在する場合はそちらを使用。

```powershell
copy .agent\skills\pwa_icon_forge\scripts\generate_icons.py upload_package\tools\
```

### 2. 実行

```bash
# 基本
python tools/generate_icons.py <マスター画像> --outdir <出力先> --bg "<背景色hex>"

# デフリンジ付き（白背景から透過に変換した画像向け）
python tools/generate_icons.py logo.png --outdir public/img --bg "#1a1a2e" --defringe
```

### 3. manifest.json の更新

スクリプト実行後に表示されるスニペットを `manifest.json` の `icons` セクションにコピペ。

**重要**: `purpose: "any maskable"` は使わない。 `"any"` と `"maskable"` は別エントリにする。

```json
"icons": [
  { "src": "icon-192.png",          "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "icon-512.png",          "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

### 4. HTML meta タグ

```html
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
```

## 技術メモ

### Maskable Icons とは
Android 等が円形・スクラバル等にマスクするためのアイコン。
ロゴを 80% サイズに縮小し、周囲に背景色のセーフゾーンを確保する。
`purpose: "any maskable"` と合体指定するとOS側で意図しないクリッピングが発生するため、**必ず分離する**。

### デフリンジとは
白い背景上でレンダリングされた画像を透過 PNG に変換すると、
半透明エッジピクセルに白色が残る（フリンジ）。
ダーク背景で表示すると白い輪郭として目立つ。
`--defringe` はコンポジット逆算でこのフリンジを除去する。

### OGP サイズ
- Facebook/LINE 推奨: 1200×630
- Twitter 推奨: 1200×628（実質同じ）
- 正方形が必要な場合は別途 1024×1024 も生成可能（スクリプト要改修）

## トラブルシューティング

| 症状 | 原因 | 対策 |
|:---|:---|:---|
| PWA アイコンがギザギザ | manifest で宣言したサイズと実ファイルが不一致 | このスクリプトで再生成 |
| ホーム画面で丸く切られる | `purpose: "any maskable"` の合体指定 | any と maskable を分離 |
| ダーク背景で白い縁が見える | 白背景フリンジ | `--defringe` オプション |
| iOS でアイコン背景が黒い | 透過 PNG を iOS が黒で埋めている | 意図通りなら OK。嫌なら `--bg` でテーマ色指定 |
