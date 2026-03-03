# ミニアイ作業指示書: Phase 16.4 デプロイ & 検証

**発行者:** 愛 (Sunpu Strategist)  
**発行日:** 2026-02-26 15:53 JST  
**優先度:** 🔴 高（本番反映待ち）

---

## 1. PHP構文チェック

```bash
cd /home/yamaki/projects/ikimon-platform/upload_package/public_html
php -l bingo.php
```

> 他のファイルは既にlint済み。`bingo.php` だけ再チェックが必要（進捗ファイルパス修正後）。

## 2. 本番デプロイ（SCPパッチ）

`bingo.php` のみ差分デプロイ。他5ファイルは愛が既にデプロイ済み。

```bash
scp -P 8022 -i ~/.ssh/production.pem \
  /home/yamaki/projects/ikimon-platform/upload_package/public_html/bingo.php \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/public_html/bingo.php
```

## 3. 疎通確認

```bash
curl -s -o /dev/null -w "%{http_code}" https://ikimon.life/bingo.php
curl -s -o /dev/null -w "%{http_code}" https://ikimon.life/create_event.php
curl -s -o /dev/null -w "%{http_code}" https://ikimon.life/event_detail.php
```

期待値: `302`（ログインリダイレクト）or `200`。`500` なら愛に報告。

## 4. jj スナップショット

```bash
cd /home/yamaki/projects/ikimon-platform
jj describe -m "Phase 16.4: BINGO Template Generation & Photo Enhancement"
jj git push
```

---

## 今回の変更サマリ

| ファイル | 変更内容 |
|:---|:---|
| `api/generate_bingo_template.php` **[NEW]** | Gemini Flash APIで9種自動生成 |
| `api/save_event.php` | `bingo_template_id` 追加 |
| `create_event.php` | BINGO生成トグルUI |
| `edit_event.php` | BINGO生成トグルUI（既存凍結） |
| `bingo.php` | モック→実データ＋写真表示 |
| `event_detail.php` | BINGOボタン追加 |
