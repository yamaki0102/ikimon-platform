# Documentation Instructions

このディレクトリ以下ではroot `AGENTS.md`に加えて次を守る。

1. 最初に`docs/START_HERE.md`と`PROJECT.json`を読む。
2. 実装可能な振る舞いはexact source、machine-checkable contract/types/schema/testsを正本にする。これらに表現できない採用済みの製品意味だけを`SPEC.md`へ置く。
3. 決定理由はADRへ置き、過去ADRの内容を無言で書き換えない。
4. 実装順、migration、verification、rollbackは`PLAN.md`へ置く。
5. 横断方針、project-to-canonical locator、deploy/release routingは`yamaki0102/all-projects-management`内の登録済みversioned authorityから読む。mutableなWork objective/status/claim/blocker/checkpoint/Evidence/next_action/resumeの単一正本はNOCOSIL Work / Current State / Evidence / Resume。PR/review/merge状態はfresh GitHub read-back、稼働中deploy/runtime状態は登録provider/runtimeのfresh read-backで確認する。このrepoにmutable状態を二重記録しない。
6. MarkdownとJSONへ同じ事実を手作業で二重登録しない。JSONはID・pointer・state、Markdownは機械検証できない製品意味・判断理由に絞る。Word-styleの説明文書を実装authorityやDoDにしない。ユーザー向け日本語copyは依頼の変更対象外なら原文維持し、明示された翻訳・copy修正は依頼どおり反映する。
7. 他社・顧客の固有情報、個人情報、契約、secretを混在させない。
8. ローカル絶対パスや端末名を恒久的な正本参照として書かない。
9. 旧文書を置き換える場合は`superseded`、新正本path、日付を明示し、今回のdoc-only作業では削除しない。
10. 仕様変更を伴うcode PRでは、必要なSPEC、ADR、PLAN、testsを同じPRで更新する。
