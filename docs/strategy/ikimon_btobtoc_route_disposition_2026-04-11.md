# ikimon.life BtoBtoC Route Disposition

更新日: 2026-04-11

目的:

- どのページを主導線に残すか
- どのページの露出を下げるか
- どのページを補助・保留に回すか

を固定する。

---

## 1. 処遇カテゴリ

- `Primary`: 主導線に残す
- `Secondary`: 主導線ではないが公開維持
- `Support`: 信頼補強や深掘り用
- `De-emphasize`: ナビやトップ露出を下げる
- `Internal`: 管理系・権限系。公開導線に出さない

---

## 2. Primary

| Route | File | Treatment | Reason |
|---|---|---|---|
| `/` | `index.php` | Primary | 公開入口 |
| `/post.php` | `post.php` | Primary | 初回成功体験 |
| `/explore.php` | `explore.php` | Primary | 興味拡張 |
| `/profile.php` | `profile.php` | Primary | 個人の積み上がり |
| `/wellness.php` | `wellness.php` | Primary | 習慣化ページ |
| `/for-business/` | `for-business/index.php` | Primary | sponsor page |
| `/corporate_dashboard.php` | `corporate_dashboard.php` | Primary | team workspace |
| `/site_dashboard.php?site=*` | `site_dashboard.php` | Primary | place workspace |

---

## 3. Secondary

| Route | File | Treatment | Reason |
|---|---|---|---|
| `/dashboard.php` | `dashboard.php` | Secondary | 既存会員向け個人統計。主導線からは下げる |
| `/events.php` | `events.php` | Secondary | コミュニティ接点 |
| `/event_detail.php` | `event_detail.php` | Secondary | 詳細閲覧 |
| `/my_organisms.php` | `my_organisms.php` | Secondary | 個人アーカイブ |
| `/create_event.php` | `create_event.php` | Secondary | 特定用途 |
| `/for-business/apply.php` | `for-business/apply.php` | Secondary | sponsor page から流入させる |

---

## 4. Support

| Route | File | Treatment | Reason |
|---|---|---|---|
| `/about.php` | `about.php` | Support | 信頼補強 |
| `/guides.php` | `guides.php` | Support | 深掘り導線 |
| `/guide/corporate-walking-program.php` | same | Support | 企業導入の証拠 |
| `/guide/walking-brain-science.php` | same | Support | 科学補強 |
| `/guide/nature-positive.php` | same | Support | 背景理解 |
| `/faq.php` | `faq.php` | Support | 不安低減 |
| `/guidelines.php` | `guidelines.php` | Support | ルール説明 |

---

## 5. De-emphasize

| Route | File | Treatment | Reason |
|---|---|---|---|
| `/map.php` | `map.php` | De-emphasize | 初回成功に効かない |
| `/biodiversity_map.php` | same | De-emphasize | 価値理解を散らす |
| `/compass.php` | `compass.php` | De-emphasize | 主要価値ではない |
| `/compare.php` | `compare.php` | De-emphasize | 深い機能 |
| `/methodology.php` | `methodology.php` | De-emphasize | 公開主導線に不要 |
| `/reference_layer.php` | `reference_layer.php` | De-emphasize | 補助知識 |
| `/for-researcher.php` | `for-researcher.php` | De-emphasize | 現行主戦場ではない |
| `/showcase.php` | `showcase.php` | De-emphasize | 旧B2B見せ方が強い |
| `/csr_showcase.php` | `csr_showcase.php` | De-emphasize | sponsor page に統合されるべき |
| `/dashboard_municipality.php` | same | De-emphasize | 現時点で主導線外 |
| `/dashboard_portfolio.php` | same | De-emphasize | 主導線外 |

---

## 6. Internal

| Route Group | Treatment | Reason |
|---|---|---|
| `/admin/*` | Internal | 権限前提 |
| `/api/*` | Internal | UI導線ではない |
| `corporate_settings.php` | Internal | 設定専用 |
| `corporate_members.php` | Internal | 運用補助 |
| `site_editor.php` | Internal | 管理機能 |

---

## 7. ナビ露出ルール

- Primary のみ主ナビ候補
- Secondary は主ナビ外、文脈内リンク
- Support は本文末 or footer
- De-emphasize は検索流入や直接リンクで生かすが、トップ導線から外す
- Internal は認証後の文脈のみ

---

## 8. Definition of Done

- どのページが主導線か曖昧でない
- `何でもできるサイト` の見え方を減らせる
- 深い機能を殺さず、露出だけ整理できる

