# v2 de-PHP recovery plan (post parity hotfix)

背景
- 直近の見た目崩れを止血するため、/v2 主要ページは runtime で legacy HTML を mirror している。
- これは一時措置で、脱PHPとしては不完全。

最終目標
- /v2 public 導線で PHP HTML 取得を完全撤廃し、Node(v2)テンプレートで同等デザインを再現。
- 旧 .php は互換リダイレクトのみ保持。

スコープ
1) / (top)
2) /about
3) /learn
4) /faq
5) /for-business

実装方針
- runtime mirror (`fetchLegacyMirroredPage`) を段階的に削除。
- legacy の構造/CSSを v2 UI テンプレートへ移植。
- 文言・DOM構造の差分を自動比較で管理（text similarity >= 0.995 目標）。

タスク
- T1: public-shell-legacy.ts を新規作成（header/footer/hero/section primitives）
- T2: / を Node描画へ差し戻し（mirror撤去）
- T3: /about を Node描画へ差し戻し
- T4: /learn を Node描画へ差し戻し
- T5: /faq を Node描画へ差し戻し
- T6: /for-business を Node描画へ差し戻し
- T7: fetchLegacyMirroredPage の参照ゼロ化、未使用コード削除
- T8: staging QA + parity report 更新

受け入れ基準
- /v2 上記5ページが 200
- 主要文言一致、視覚一致（スクショ比較で重大差分なし）
- /v2 内リンク崩れなし（bad=0, double_v2=0）
- `fetchLegacyMirroredPage` が public 導線で未使用

補足
- 互換性確保のため、`.php -> v2 path` redirect map は継続利用。