# ikimon Asset Path Mapping

更新日: 2026-04-12  
この文書は、`public_html/uploads` と `persistent/uploads` の drift を、切替前に固定するための mapping 表。  
目的は 3 つ。

1. `相対パス`
2. `コード上の保存先`
3. `production の実体`

を分けて把握すること。

---

## 1. 結論

いまの asset は、原則として `UI / JSON / canonical` では **相対パス** を持ち、  
実ファイルの物理実体は production では主に `persistent/uploads` 側にある。

つまり正しい理解はこう。

- アプリが持つのは `uploads/...` 形式の相対パス
- ローカル repo のコードは `PUBLIC_DIR . '/uploads/...'` に保存しようとする
- production / staging の保護対象実体は `persistent/uploads/...`

この3層を混ぜない。

---

## 2. Asset mapping table

| Asset 種別 | 主な書き込みコード | JSON / UI に残る相対パス | コード上の保存先 | production 実体 | 備考 |
|---|---|---|---|---|---|
| observation photo | `api/post_observation.php`, `api/add_observation_photo.php`, `api/v2/quick_post.php` | `uploads/photos/{obs-or-month}/...` | `PUBLIC_DIR/uploads/photos/...` | 主に `/var/www/ikimon.life/persistent/uploads/photos/...` | canonical evidence でも同じ相対パスを参照 |
| avatar | `api/upload_avatar.php` | `uploads/avatars/{filename}` | `PUBLIC_DIR/uploads/avatars/...` | 主に `/var/www/ikimon.life/persistent/uploads/avatars/...` | user と observation の denormalized avatar に反映 |
| audio evidence | `api/v2/analyze_audio.php` | `uploads/audio/{Y-m}/{file}` | `PUBLIC_DIR/uploads/audio/{Y-m}` | 主に `/var/www/ikimon.life/persistent/uploads/audio/{Y-m}` | BirdNET bridge の検出音声 |
| archived audio | `api/v2/analyze_audio.php`, `api/v2/sound_archive_upload.php` | `uploads/audio/archive/{Y-m}/{file}` | `PUBLIC_DIR/uploads/audio/archive/{Y-m}` | 主に `/var/www/ikimon.life/persistent/uploads/audio/archive/{Y-m}` | `sound_archive` レコードと対応 |
| voice guide audio | `api/v2/voice_guide.php` | `/uploads/audio/voice/{Y-m}/{file}` | `PUBLIC_DIR/uploads/audio/voice/{Y-m}` | 主に `/var/www/ikimon.life/persistent/uploads/audio/voice/{Y-m}` | leading slash つきで返る箇所あり |
| sound archive image | `api/v2/sound_archive_upload.php` | `uploads/images/archive/{Y-m}/{file}` | `PUBLIC_DIR/uploads/images/archive/{Y-m}` | `persistent/uploads` 配下へ寄せる想定だが現状 docs 未固定 | audio 系と同時に扱う画像 |
| scan draft image | `api/v2/scan_detection.php`, `api/v2/scan_draft_save.php` | `data/uploads/scan/{Y-m}/...` 系 | `ROOT_DIR/data/uploads/scan/...` | `data/uploads/scan/...` | `uploads/` ではなく `data/` 側 |
| scan frame | `api/v2/save_scan_frame.php` | `scan_frames/{Y-m}/{session}/{file}` | `DATA_DIR/scan_frames/...` | `data/scan_frames/...` | `data/uploads/scan` と別系統 |

---

## 3. 実測メモ

2026-04-12 時点の確認:

- local repo の `public_html/uploads` 直下には `photos/` しか見えていない
- `avatars/` と `audio/` は local repo 上では恒久配置されていない
- docs では staging / production とも `uploads` は `persistent/uploads` 側で保護対象
- staging runbook でも `production uploads を staging persistent/uploads に rsync` と明記されている

意味:

- local repo の `public_html/uploads` を本番実体と思わない
- `avatars/audio` は runtime / server state を前提にする

---

## 4. canonical / cutover への効き方

### 4.1 何を canonical に持つか

canonical が持つべきもの:

- `legacy relative path`
- `media hash`
- `bytes / width / height / duration`
- `asset type`

canonical が今すぐ持たなくてよいもの:

- server 固有の絶対パス
- repo 上の一時配置

### 4.2 rollback で必要なこと

- v2 公開後もしばらくは legacy 相対パス互換を維持する
- `uploads/...` と `/uploads/...` の揺れは切替前に吸収する
- `voice_guide` の leading slash は migration 時に正規化対象

---

## 5. いまの hotspot

### 5.1 `public_html/uploads` と `persistent/uploads`

- コードは `PUBLIC_DIR/uploads/...` に書く
- 運用 docs は `persistent/uploads/...` を保護対象として扱う

意味:

- web root 下に見える path と、保護すべき実体 path が別の可能性を常に疑う

### 5.2 `uploads/audio` と `sound_archive`

- audio file は file system
- metadata は `data/sound_archive*.json`

意味:

- 切替では file と JSON の両方を揃えて初めて 1 レコードになる

### 5.3 `scan`

- `data/uploads/scan` と `data/scan_frames` が別系統

意味:

- `scan = 1系統` とみなすと importer で取りこぼす

---

## 6. 次にやること

1. `voice_guide` の leading slash 有無を正規化ルールに落とす
2. `uploads/images/archive` を inventory と contract table に追加する
3. divergence CLI に `photo/audio relative path parity` を拡張する

この mapping 表を asset drift の正本として使う。
