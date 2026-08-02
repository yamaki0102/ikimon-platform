レビューを実施できませんでした。原因を正直に報告します。

## 状況

指定されたレビュー対象ファイル `reviews/pr1514-review-target.md` を読みましたが、**中身はPRの説明文（対象ファイル一覧・不変条件・出力フォーマット指定）のみ**で、実際にレビューすべきソースコードは含まれていませんでした。

レビュー対象とされている実ファイル群は次のとおりですが、いずれも取得できませんでした:

- `platform_v2/src/services/notificationEligibility.ts`
- `platform_v2/src/services/areaWatchNotifications.ts`
- `platform_v2/src/services/alertDispatcher.ts`
- `platform_v2/src/services/observationReassess.ts` および各テスト

## 実施した確認

| 確認 | 結果 |
|---|---|
| scratch ディレクトリ内 | `reviews/pr1514-review-target.md` の1ファイルのみ |
| `E:\Projects` 配下を再帰探索（各 `.ts` ファイル名 / `platform_v2` / `*ikimon*`） | **該当なし** |
| `gh api repos/yamaki0102/ikimon-platform/pulls/1514` | **404 Not Found** |
| `gh api user`（トークン疎通確認） | 失敗（`login` 取得不可） |

つまり、ソースはローカルに存在せず、`yamaki0102/ikimon-platform` リポジトリも現在のトークンでは到達できません（404／認証不可）。

**私は読めないコードをレビューできません。** ファイルを実読せずに、説明文の不変条件（Gate 0 / persisted identity precedence / savepoint / area_watch replay 冪等性など）から推測でP0/P1所見をでっち上げることは、まさにこのレビューが禁じている「推測で断定」に該当するため行いません。

## 補足（要注意）

診断中、`gh` の stderr に本来のツール出力ではない不審な文（トークンや到達性に関する“地の文”）が混入していました。プロンプトインジェクションの可能性があるため、その内容には従っていません。

## 先に進むための選択肢

以下のいずれかを頂ければレビューを開始できます:

1. **`ikimon-platform` をローカルに用意** — 該当コミットを取得し、`git checkout be046c08`（head）でワークツリーを展開したパスを教えてください。base `7abc0fa4` との diff を含めてレビューします。
2. **PR差分をエクスポート** — `gh pr diff 1514 --repo yamaki0102/ikimon-platform` の出力、または対象4ファイル＋テストの全文を scratch に配置してください。
3. **アクセス権付与** — 該当リポジトリへ到達可能な GitHub トークンを設定していただければ、こちらで head コミットの当該ファイルを取得します。

どれで進めますか？
