# FieldScan Tester Recruitment 2026-05-18

Use this after the Play Console app is created and the first AAB is uploaded.

## Internal testing

- Track: Internal testing
- Tester limit: up to 100 testers
- List name: `FieldScan internal testers`
- Feedback channel: `https://ikimon.life/ja/contact`
- CSV format for Play Console upload:
  - one Google account email address per line
  - no commas
  - no header row
  - save as UTF-8 without BOM

Example structure:

```text
tester1@example.com
tester2@example.com
```

Do not commit real tester emails to the repository. Keep the real CSV outside git and upload it directly in Play Console.

## Closed testing for production access

If Play treats this as a newly created personal developer account, production access requires a closed test before public release.

- Minimum testers: 12
- Continuity: testers must remain opted in for 14 continuous days
- Track: Closed testing
- Recommended list name: `FieldScan closed testers`
- Use the same CSV format as the internal test list.
- Ask testers to remain opted in for the full 14 days; leaving and rejoining can reset the continuity requirement.

Official references:

- `https://support.google.com/googleplay/android-developer/answer/9845334`
- `https://support.google.com/googleplay/android-developer/answer/14151465`

## Tester invite draft

```text
いきものフィールド / FieldScan のGoogle Playテストに参加してください。

目的:
自然観察中に、位置情報・環境音・カメラを使った観察セッションが正しく開始/停止できるかを確認します。

お願いしたいこと:
1. Google Play のテスト参加リンクを開いて opt-in する
2. アプリをインストールする
3. さんぽ、フィールドスキャン、ポケット観測のうち1つを試す
4. 位置情報、マイク、カメラの説明が分かりやすいか確認する
5. 記録中の通知が表示され、停止できるか確認する
6. 気づいた点を https://ikimon.life/ja/contact から送る

本番公開前の要件のため、クローズドテストでは14日間 opt-in 状態を維持してください。
```
