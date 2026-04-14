# v2 UI/UX Global Baseline Pass 04 (staging, keyboard flow quick-check)

日時: 2026-04-14
対象: /v2, /v2/learn, /v2/faq

## 実施
- ソース順タブ導線の静的検証を実施
- 先頭フォーカス要素が skip-link になっているか確認
- skip-link の遷移先 `#main-content` の存在を確認

## 結果
- 3ページすべてで first focusable = `a.skip-link[href="#main-content"]`
- 以降の順序は headerナビ -> 言語切替 -> record CTA の順で一貫
- `main#main-content` は全ページで存在

## 補足
- ブラウザ実機のTab操作（可視フォーカス移動）確認は、ブラウザ実行環境準備後に追加実施する
- 現時点は HTML構造/順序/対象ID の整合はOK
