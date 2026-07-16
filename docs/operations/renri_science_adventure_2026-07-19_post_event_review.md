# 連理の木の下で サイエンスアドベンチャー — Post-event Review

対象: 2026-07-19（日）11:10–13:00の参加者体験と、13:00–13:40の運営振り返り

状態: 未実施template

## 1. 結果

| 項目 | 記入 |
|---|---|
| 当日判定 | GO / GO WITH FALLBACK / NO-GO |
| 実際の参加者向け開始・終了 | |
| 参加組数 | |
| 観察件数 | |
| 見つかった種類数 | |
| 投稿成功 / 失敗 / 未同期 | |
| live最終更新 | |
| recap状態 | |
| fallback発動 | なし / 1 / 2 / 3 |
| production操作 | なし / あり（承認・evidence locator必須） |

参加組数は家族・グループ単位、主催者除外で記録する。名前不明の観察を無理に種類数へ含めない。

## 2. Funnel

個人情報を含まない集計値だけを転記する。

| Stage | Count | Drop-off | Note |
|---|---:|---:|---|
| QR open | | | |
| join loaded | | | |
| check-in started | | | |
| check-in succeeded | | | |
| registration started | | | |
| registration succeeded | | | |
| rally opened | | | |
| photo selected | | | |
| observation submit started | | | |
| observation succeeded | | | |
| live viewed | | | |
| recap viewed | | | |
| offline queued | | | |
| retry succeeded | | | |

## 3. Success metrics

| Metric | Target | Actual | Result / Evidence |
|---|---:|---:|---|
| QR→参加中央値 | 30秒以内 | | |
| 観察開始まで | 3画面以内 | | |
| QR→最初の保存 | 2分以内 | | |
| Round 1 | 5人中4人以上 | | |
| Round 2 | 3人中3人 | | |
| 同時check-in | 20 test sessions | | |
| 10分相当投稿 | 40 test observations | | |
| 重複・欠損 | 0 | | |
| cleanup残存 | 0 | | |

人間テストをイベント参加者の挙動から事後推定しない。実施していなければ未実施と記録する。

## 4. Incident timeline

| JST | 影響 | 検知 | 判断 | 対応 | 復帰 | Owner |
|---|---|---|---|---|---|---|
| | | | | | | |

個人名、メール、token、座標、画像名、自由記述を記載しない。必要なsecurity evidenceはアクセス制限された保存先のlocatorだけを残す。

## 5. 写真・データ完全性

| 確認 | Result | Evidence / Owner |
|---|---|---|
| 保存成功数と表示数が一致 | 未確認 | |
| 孤児upload / DB rowなし | 未確認 | |
| 未同期家族へのfollow-up owner | 未確認 | |
| exact location非公開 | 未確認 | |
| credential非露出 | 未確認 | |
| staging fixture cleanup残存0 | 未確認 | |
| 本番参加者データをテストcleanupしていない | 未確認 | |

## 6. 参加者と運営の観察

### 迷わずできたこと

- （記入）

### 止まった箇所

- （記入）

### 介助が必要だった箇所

- （記入）

### 写真を失わないために効いたもの

- （記入）

### Fallbackの有効性

- （記入）

## 7. 判定とfollow-up

| Severity | Finding | Root cause | Immediate containment | Owner | Due | Evidence |
|---|---|---|---|---|---|---|
| | | | | | | |

P0/P1は原因、再現条件、止血、恒久修正、検証を分離する。イベント直後に参加者データを推測で編集・削除しない。

## 8. Closeout

- [ ] 13:00参加者終了と13:00–13:40運営時間を正しく記録した
- [ ] evidence indexを対象SHAへ同期した
- [ ] fallbackとincidentを時刻順に記録した
- [ ] 未同期写真のownerと安全なfollow-up方法を確定した
- [ ] staging fixture cleanupゼロを確認した
- [ ] production操作の有無と承認境界を明記した
- [ ] 個人情報を含まない要約だけを共有した

Review owner: 未割当

Close date: 未定
