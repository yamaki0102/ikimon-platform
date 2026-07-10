# Ikimon Identification Workbench Wire Prompt 2026-07-02

目的: `同定まとめページ` を、Stitch や実装者に渡せる粒度の wire prompt として定義する。

対象は、既存の `/records?view=needs_id` 同定ワークベンチを置き換えるページではない。役割は、同定者や団体担当者が「どの記録から処理するか」「どこで根拠が足りないか」「自分たちの同定作業が進んでいるか」を短時間で判断するためのまとめ画面。

## 1. 採用する画面構造

採用案: **Operational Summary + Queue Launcher**

上からこの順に出す。

1. Compact Header
2. Scope Controls
3. Summary Metrics
4. Priority Queues
5. Selected Record Preview
6. Evidence Health
7. Recent Decisions
8. Team / Organization Status

第1ビューで理念や説明文を読ませない。ページの役割は「説明」ではなく「次に処理する記録を選ぶ」こと。

## 2. Stitch Prompt

```text
Create a responsive web app dashboard page for ikimon.life called "同定まとめ".

This is an operational summary page for biodiversity identification work. It is not a landing page and not a marketing hero. The page helps a skilled identifier, local survey team, or organization operator decide which observation records need attention next, then launch into the existing identification workbench.

Design tone:
- Quiet, practical, fieldwork-oriented, trustworthy.
- Dense but readable. Use clear hierarchy, not decorative cards.
- Avoid oversized hero sections, gradients, abstract orbs, bokeh, and marketing copy.
- Use real observation photo thumbnails as the primary visual asset. If a record has no photo, show a calm placeholder with an icon and short label.
- Cards may be used only for repeated observation items and metric tiles. Do not place cards inside cards.
- Border radius should be 8px or less.
- Use a balanced palette: off-white background, deep green for primary actions, slate text, sky blue for reference/evidence, amber for missing evidence, muted red only for unresolved conflict.
- Text must fit on 360px mobile width. Do not use viewport-scaled font sizes or negative letter spacing.

Page structure:
1. Compact header with the page title "同定まとめ", a short status line, and a primary action "同定を続ける".
2. Scope controls as segmented controls: "すべて", "自分の担当", "団体", "近く". Add compact filters for taxon group, area, and evidence status.
3. Summary metric row with five stable tiles: "確認待ち", "資料候補あり", "保留中", "追加写真が必要", "今日処理した". Each tile has a number, a short label, and a tiny trend/status note.
4. Priority queue section. Show three lanes:
   - "資料で確認できる記録": records with candidate references available.
   - "写真を見れば進めやすい記録": clear media and AI/name candidate.
   - "止まっている記録": hold, dispute, or missing evidence.
5. Each queue item includes one thumbnail, candidate name or "名前を確認中", rounded place, date, evidence chips, and a clear action "開く".
6. Selected record preview on desktop at the right side. On mobile, it becomes a full-width section under the selected queue item.
7. Preview shows larger media, current candidate, status, reference suggestions headed "この資料で確認", missing evidence notes, and a button "作業台で開く".
8. Evidence health section with small rows for "資料未登録", "重複候補", "canonical統合待ち", "Tier 3に足りない根拠".
9. Recent decisions section showing the last few identifications with proposed name, actor, reference title or "資料なし", and time.
10. Team status section for organization users: assigned members, unresolved holds, and today/this week counts.

Interaction rules:
- The summary page should not perform final identification writes in the MVP.
- Primary actions open the existing workbench or observation detail:
  - "同定を続ける" -> /records?view=needs_id
  - queue item "開く" -> /records?view=needs_id with selected record context when available
  - preview "作業台で開く" -> existing identify panel or observation detail #identify
- Filters update the queue contents without changing layout height dramatically.
- Empty states should give one next action, not a paragraph.

Accessibility:
- Body text minimum 14px, main labels 16px or more.
- Tap targets 56px or more for mobile primary actions.
- State must not rely on color alone; always include text labels.
- Keyboard focus must be visible.
- Public location text must remain rounded and never expose precise home/school locations.
```

## 3. ページの役割

| 役割 | 内容 |
|---|---|
| 状況把握 | 同定待ち、保留、資料候補あり、追加写真待ちを一画面で見る |
| 優先度決定 | 今日処理しやすい記録、止まっている記録、団体担当記録を分ける |
| 作業台への入口 | 実際の同定操作は既存の `/records?view=needs_id` パネルへ送る |
| 根拠管理 | 資料未紐づけ、重複資料、Tier 3不足を早く発見する |
| 団体運用 | 担当者、処理件数、保留理由を確認する |

禁止:

- 同定まとめページ上で、MVPから `この候補でよさそう` などの最終保存を直接実行する。
- 厚い理念説明や「社会貢献」コピーを置く。
- AI候補を `確定` と表示する。
- 精密位置や非公開メモを一覧で露出する。

## 4. Compact Header

| 要素 | 内容 |
|---|---|
| Title | `同定まとめ` |
| Status line | `確認待ちの記録と、根拠が足りない記録を整理します。` |
| Primary action | `同定を続ける` -> `/records?view=needs_id` |
| Secondary action | `資料ライブラリ` -> reference library route |

実装メモ:

- ヘッダーはページ内の操作面にする。ブランド hero にはしない。
- PC ではタイトル、スコープ、CTA を1行に収める。
- モバイルではタイトルとCTAを上下に分け、CTAは横幅いっぱいにする。

## 5. Scope Controls

| 表示 | 意味 |
|---|---|
| すべて | 公開範囲内の確認待ち |
| 自分の担当 | 自分が保留・担当・最近処理した記録に寄せる |
| 団体 | 所属団体の対象記録 |
| 近く | 丸め位置ベースで近い記録 |

追加フィルタ:

- 分類群: `鳥`, `昆虫`, `植物`, `哺乳類`, `水辺`, `その他`
- 状態: `資料候補あり`, `写真あり`, `保留中`, `追加写真が必要`, `確認中`
- 地域: 既存の丸め地域、調査地、または団体プロジェクト単位

## 6. Summary Metrics

5つだけに絞る。

| 表示 | 意味 | CTA |
|---|---|---|
| 確認待ち | 人の確認がまだ少ない対象 | `/records?view=needs_id` |
| 資料候補あり | 登録済み資料で確認しやすい対象 | queue filter |
| 保留中 | 同定者が保留した対象 | hold filter |
| 追加写真が必要 | 根拠不足で進みにくい対象 | evidence filter |
| 今日処理した | 自分または団体の同定作業量 | recent decisions |

設計:

- PC は横5列。幅が足りない場合は2列 + 3列へ折り返す。
- モバイルは2列、最後の `今日処理した` は横幅いっぱいでもよい。
- 数字は大きくするが、hero級にしない。業務画面として密度を保つ。

## 7. Priority Queues

3つの lane を出す。

### 資料で確認できる記録

対象:

- `reference-candidates` が返る。
- ユーザーが所有確認済み、または共有カタログとして使える資料がある。
- 候補名と資料の分類群が近い。

カード表示:

| 要素 | 表示 |
|---|---|
| Thumbnail | 観察写真または動画サムネイル |
| Name | 候補名、または `名前を確認中` |
| Place/date | 丸め場所 + 日付 |
| Evidence chips | `この資料で確認`, `AI候補あり`, `写真あり` |
| Action | `開く` |

### 写真を見れば進めやすい記録

対象:

- 写真・動画があり、候補名または分類群の手がかりがある。
- 既存の同定数が少ない。
- 保留・dispute が強くない。

表示ラベル:

- `写真あり`
- `候補名あり`
- `確認待ち`

### 止まっている記録

対象:

- workbench hold がある。
- dispute が開いている。
- evidence note が追加写真不足を示す。
- Tier 3 昇格に資料紐づけが足りない。

表示ラベル:

- `保留中`
- `確認中`
- `追加写真が必要`
- `資料未紐づけ`

禁止:

- `止まっている` をエラーや失敗として赤く見せすぎない。
- 記録者を責めるコピーにしない。

## 8. Selected Record Preview

PC:

- 右カラム固定ではなく、ページ内の preview pane として表示する。
- 左の queue をスクロールしても、preview は同じ高さで見える。

Mobile:

- 選択したカード直下に展開する。
- 長くなりすぎる場合は `作業台で開く` を先に出し、詳細は折りたたむ。

表示内容:

| 要素 | 内容 |
|---|---|
| Media | 大きめの写真/動画サムネイル |
| Candidate | 候補名、rank、確認状態 |
| Evidence | `この資料で確認` 候補を最大3件 |
| Missing | 足りない写真、角度、部位、時期 |
| Activity | 直近の同定、保留、dispute |
| Primary CTA | `作業台で開く` |

コピー例:

- `この資料で確認`
- `葉裏の写真があると進めやすい`
- `同じ場所の春の記録あり`
- `資料がまだ紐づいていません`

避けるコピー:

- `あなたなら分かるはず`
- `みんなのために協力`
- `正解を出す`
- `AI確定`

## 9. Evidence Health

目的: 団体向けに売れる品質管理面を見せる。

| 表示 | 意味 | 次アクション |
|---|---|---|
| 資料未登録 | 同定に使われているが catalog にない根拠 | `資料を登録` |
| 重複候補 | 同じ本・資料が複数登録されている | `canonicalへ統合` |
| Tier 3不足 | 昇格条件に資料や authority が不足 | `不足を見る` |
| 改訂メモあり | 誤同定・分類改訂・分布更新情報がある | `メモを見る` |

この section は管理者/団体ユーザーに重点を置く。一般ユーザーには簡略表示でよい。

## 10. Recent Decisions

直近の作業ログを、監査と安心のために出す。

| 要素 | 表示 |
|---|---|
| Proposed name | 同定名 |
| Actor | 表示可能な同定者名 |
| Reference | `この資料で確認: ...` または `資料なし` |
| Result | `支持`, `別候補`, `証拠不足`, `保留` |
| Time | 相対時刻または日付 |

注意:

- private note や内部メモを露出しない。
- actor 表示は既存の公開範囲に従う。
- `資料なし` は責める表示にしない。根拠の補完対象として扱う。

## 11. Team / Organization Status

団体向けの表示。

| 表示 | 内容 |
|---|---|
| 今日の処理 | 団体内の同定数、保留数 |
| 担当者 | 作業中または最近処理したメンバー |
| 未解決 | dispute、hold、追加写真待ち |
| 資料状況 | 登録済み資料、重複候補、review待ち |

MVPでは閲覧だけ。担当割当や承認フローは後続でよい。

## 12. Empty / Error States

| 状態 | 表示 |
|---|---|
| 確認待ちなし | `今は確認待ちの記録がありません` + `公開記録を見る` |
| 資料候補なし | `使える資料候補がまだありません` + `資料を登録` |
| ログインなし | `同定まとめを見るにはログインしてください` + `ログイン` |
| 団体なし | 団体 section を非表示。個人向け queue だけ出す |
| API失敗 | `読み込みに失敗しました` + `再読み込み` |

空状態で長い説明文を出さない。次に押すものを1つに絞る。

## 13. 実装対象ファイル候補

現行構造から見た候補。

| 役割 | 候補 |
|---|---|
| route | `platform_v2/src/routes/read.ts` |
| records read model | `platform_v2/src/services/readModels.ts` |
| visit/detail bundle | `platform_v2/src/services/observationVisitBundle.ts` |
| reference candidates | `platform_v2/src/services/referenceLibrary.ts` |
| holds | `platform_v2/src/services/identificationWorkbenchHolds.ts` |
| reference view helper | `platform_v2/src/services/identificationReferencesView.ts` |
| UI tests | `platform_v2/src/routes/observationDetailFriendlyCopy.test.ts` or new route test |
| staging smoke | `platform_v2/e2e/identification-workbench.staging.spec.ts` or new summary spec |

route 候補:

- MVP: `/records?view=identification_summary`
- Alternative: `/identify`

判断:

- 既存の records 導線に寄せるなら `/records?view=identification_summary`。
- 将来、団体向け作業台として独立させるなら `/identify`。
- MVPでは `/records?view=identification_summary` を推奨。既存 shell、言語、ログイン、record filters と合わせやすい。

## 14. Data Mapping

既存の土台に寄せる。

| UI | 既存データ/サービス |
|---|---|
| 確認待ち | observations with `identificationCount === 0` or AI candidate state |
| 資料候補あり | `/api/v1/observations/:id/reference-candidates` / `listReferenceCandidatesForIdentification` |
| 保留中 | `identification_workbench_holds` |
| Recent decisions | `identifications`, `identification_references` |
| 追加写真が必要 | dispute/evidence status, notes, or derived missing evidence |
| Tier 3不足 | tier promotion requirements / identification reference gate |
| 重複候補 | `knowledge_source_reference_metadata.catalog_status`, duplicate review |

未確認:

- 団体 membership / assignment の読み取り API がどこまであるか。
- summary 専用 query を作るか、既存 `/records` snapshot から派生させるか。
- `追加写真が必要` の統一ステータスが既に read model にあるか。

## 15. Responsive Rules

PC:

- 12カラム相当。
- Summary metrics は横並び。
- Priority queue は左 7、preview は右 5。
- Evidence health と recent decisions は下部2カラム。

Tablet:

- Metrics は2-3列。
- Preview は queue の下。

Mobile:

- Header -> controls -> metrics -> queue の順。
- 横スクロールに依存しない。
- Segmented controls は2列折り返し。
- Queue item は1列で、thumbnail は左、情報と action は右。
- `同定を続ける` と `作業台で開く` は高さ56px以上。

## 16. QA / 完了条件

- `/records?view=identification_summary` または採用 route でページが表示される。
- 第1ビューに `同定まとめ`、scope controls、summary metrics、`同定を続ける` が出る。
- `同定を続ける` が `/records?view=needs_id` へ遷移する。
- Queue item から既存 workbench または observation detail へ移動できる。
- `この資料で確認` 候補がある記録と、候補がない記録の両方で表示が崩れない。
- 360px幅で横スクロールが出ない。
- 主要タップ領域が56px以上。
- 状態が色だけに依存しない。
- 精密位置、非公開メモ、private note を露出しない。
- `npm --prefix platform_v2 run typecheck` が通る。
- route/UI test で `同定まとめ`, `確認待ち`, `資料候補あり`, `作業台で開く` を確認する。
- staging smoke では、fixture の資料候補あり記録が summary queue に出て workbench へ遷移できることを確認する。

## 17. P1以降

- 団体内の担当割当。
- 複数人での queue claim / release。
- 同定まとめからの CSV / report export。
- 分類群別の専門家 availability。
- `資料で確認できる記録` の根拠候補スコアリング。
- 週次の団体レポート。

