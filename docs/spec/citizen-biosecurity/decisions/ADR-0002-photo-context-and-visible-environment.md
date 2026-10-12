# ADR-0002: 写真だけで残せる入力と、見える環境の任意候補

Date: 2026-10-12 JST

## Context

Ownerは写真から環境情報を補い、入力を減らし、子どもにも使いやすいイラストと自然な日本語にすることを求めた。初期版では日時が必須で、現在時刻が初期値だった。共有 `observations.observed_at` はNOT NULLであり、画面の必須属性を消すだけでは不明な日時を正確に保存できない。

## Decision

写真の端末内情報を再エンコード前に読み、撮影時刻の元表記・時差・精度・出所と採用したGPSを小さいcontextとして保持する。本人の訂正、不採用、複数写真の不一致を区別する。ファイル更新日時、現在日時、画像の見た目による場所・日時推測は補完値にしない。元画像の位置情報は保存画像から除き、外したGPSは別の隠れた項目にも保存しない。

時点がISO instantとして確定できる場合は、既存どおり共通private observationへ保存する。不明・日付だけ・時差不明の場合は、共通private draftの `observed_at` をNULLのままfinalizedにして媒体の実保存を確定し、biosecurity contextをsavedにする。架空の日付や日付ではないsentinelを共有observationsへ入れず、共有テーブルを再構築しない。本人・受信者の読取りは共通draftとcontextの契約を理解する。保存時刻は保持期限にだけ使い、撮影時刻として表示・exportしない。

保存後の明示操作に限り、既存Workers AI bindingで `@cf/cloudflare/clef-flash` を1回使う。最初の保存済み・metadata除去済み写真1枚と固定5項目だけを渡す。メモ、日時、座標、ファイル名、認証情報、任意promptは渡さない。種名、風、流れの動き、放流、過去の天気、画面外の場所は推測しない。許された選択肢・確率・usage・modelの契約を厳密に検査し、十分な根拠がない場合は不明にする。

既存の `environmentRecord.ts` の項目と本人訂正優先のmergeを再利用する。写真候補は未確認の出所を保ち、本人がunknownにした項目も上書きしない。記録・写真ID/hash・model・質問版に紐づく試行を1行だけ保持する。モデル名・質問版・写真番号・derived/userの区別は候補の共有版にも残す。写真を共有しない環境のみの同意へ生画像hashは持ち出さない。

本人が環境を共有項目として選ぶと、その時点の版をsnapshotとして保存する。版が変わっていたら再確認を求め、保存済み共有要求の正確な再試行は同じ共有を返す。後日の本人訂正で過去の同意内容を上書きしない。撤回時に環境snapshotを消し、記録削除ではprivate note、写真情報、環境、試行と媒体を既存のleaseで消す。

## Capacity and failure

初期設定は共通60,000入力token/日、1回8,000tokenを送信前に原子的予約、guest3回/日、IP5回/日。実行は1記録1回、8秒以内、無制限の再試行・premium fallback・新規queueはない。呼出し失敗や未確定の予約は消費済みのまま残す。表示・再試行で同じ写真を再送せず、写真保存・receiptはAIの成功に依存しない。

公式の2026-10-12確認値は、CLEF-flash入力100万tokenあたりUSD0.038、画像1枚最大1,024token、出力token課金なし。Workers AI無料枠10,000neurons/日は既存利用と共有するため、このfeatureの上限だけで請求0円とはいわない。新規provider、契約、secret、DNS、IAMは追加しない。

Sources: [CLEF-flash model](https://developers.cloudflare.com/workers-ai/models/clef-flash/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [immutable official schema](https://github.com/cloudflare/cloudflare-docs/blob/0d35c2c74e04988223b37747aada4c32d8714a15/src/content/workers-ai-models/clef-flash.json).

## Release and recovery

追加DB変更はOBS0077だけを登録済みexact-file laneで適用する。source/SQLiteのCHECK・default検証と、実D1の型・nullability・FK readbackを分ける。新しい形式の記録が存在した後は、その読取りと削除を知らない857cff6へ単純に戻さない。補助を停止する場合もprivate draft/cleanupを維持し、互換性を保った前進修正で復旧する。

本文は決定とsource contractであり、main merge、本番公開、モデルの実応答、実メール到着の証明を代替しない。これらは管理正本の実release evidenceに個別に記録する。
