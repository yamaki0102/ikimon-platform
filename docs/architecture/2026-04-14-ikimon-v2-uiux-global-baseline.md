# ikimon v2 UI/UX Global Baseline (Japan + Global)

更新日: 2026-04-14

## 1) 現在の基準（as-is）

現状の v2 UI/UX 判断基準は主に以下:

1. 既存 legacy(PHP) の視覚/構成パリティ
2. docs/architecture/ikimon_v2_design_language_2026-04-13.md
   - place-first
   - mentor-first
   - protagonist-first
   - quiet precision

これは「ikimonらしさ」を守るには有効だが、
日本/世界の最先端UIUX理論を明示的に評価軸へ統合した状態ではない。

## 2) 追加採用する外部スタンダード（to-be）

A. Human-Centered Design
- ISO 9241-210（人間中心設計プロセス）

B. Usability Heuristics
- Nielsen 10 heuristics
- システム状態の可視化
- 一貫性と標準
- エラー予防
- 認識ベース（想起依存を減らす）

C. Accessibility
- WCAG 2.2 AA（コントラスト、キーボード操作、フォーカス可視）
- 日本語UIの可読性（行間、文字サイズ、情報密度）

D. Cognitive / Behavioral UX
- Hick-Hyman law（選択肢過多を抑える）
- Fitts’s law（主要CTAタップ容易性）
- Progressive disclosure（段階的開示）

E. Design System Ops
- トークン運用（色/余白/角丸/影/タイポ）
- コンポーネントの責務分離（top専用heroと下層header-intro分離）

## 3) ikimon向け適用ルール

R1. トップだけに「強いヒーロー体験」を許可。
R2. 下層ページは情報目的を先に示す（H1+要約+次行動）。
R3. 1画面1主目的（primary CTAは1つ）。
R4. lane責務を混ぜない（observer / specialist / business）。
R5. 主要導線は3クリック以内で到達。
R6. 主要UIはWCAG 2.2 AA準拠を必須化。

## 4) ページ別チェック項目（運用）

Top
- 3秒で価値理解できる
- primary CTAが明確
- 余計な運用情報が前半に出ない

About / Learn / FAQ / For-business
- トップと視覚トーンは統一しつつ、同一ページには見えない
- 先頭で「このページの目的」を即提示
- 見出し階層(H1/H2)が意味的に正しい

## 5) KPI（デザイン改善の判定）

- First action rate（トップ初回行動率）
- Task completion率（record, learn導線）
- 誤遷移率（意図しないトップ戻り等）
- 主要操作のTTFC（Time to First Click）
- a11y監査の重大違反件数

## 6) 実装優先順

P1. 下層ページの「トップ化」防止ルールを固定（完了）
P2. デザイントークン棚卸し（色/余白/タイポ）
P3. WCAG 2.2 AAの自動/手動監査導入
P4. KPI観測（簡易イベント計測）
P5. 主要画面の継続的AB改善

## 7) 判定原則

- legacyに似ているだけでは合格にしない
- 先進理論に合うだけでも合格にしない
- 「ikimonの文脈」+「世界標準UX」の両方を満たすことを合格条件にする
