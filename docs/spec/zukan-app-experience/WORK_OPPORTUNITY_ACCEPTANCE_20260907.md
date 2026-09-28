# WFC-Z7 求人発見から応募への受入記録

- Work: `WFC-Z7-20260907`
- 確認日: 2026-09-28 UTC
- 対象 source: `yamaki0102/ikimon-platform@23e1d7b`
- 判定: **NOT ACCEPTED — 実画面を確認できる実装・runtime evidence がない**
- 受入責任者: Noah（本記録は受入条件と未充足 evidence の固定であり、Noah の rendered acceptance を代行しない）

## この Work の三つの基準

- 主行動: 利用者が地域・場所・条件から現在応募できる仕事を見つけ、募集詳細を確認し、応募を所有する宛先へ安全に進む。
- 現在見えている問題: source contract はあるが、求人一覧・募集詳細・応募 handoff の現行 route と実画面をこの source で確認できない。
- 意図する改善: 実装後の同一候補をスマホ・タブレット・PC、keyboard/IME、失敗・再開状態まで通し、誤った応募完了を表示しないことを Noah が実レンダーで判定できる evidence にする。

対象は marketing prototype ではなく product surface である。参照 prototype、仕様文、保存項目の型、HTTP 200、または screenshot の枚数だけを live auth・永続化・配送・公開可用性の証明にしない。

## 今回確認できた source evidence

1. [`WORK_OPPORTUNITY_EXPERIENCE_V1.md`](./WORK_OPPORTUNITY_EXPERIENCE_V1.md) は `/jobs`、`/jobs/{publicOpeningId}`、`/jobs/organizations/{publicOrganizationId}` を **Proposed additions, not current routes** と明記している。
2. active Worker と共有 UI/service/routes を対象に `仕事を探す`、`この場所で働く`、`応募する`、`publicOpeningId`、`JobPosting`、`/jobs` を検索した。応募導線の route/renderer は見つからず、`/jobs/...` は Saved item の参照値を扱うテストだけで見つかった。参照値の受理はページまたは応募機能の存在証明ではない。
3. 同 contract は WFC-Z7 の前提を WFC-Z1 と NOCOSIL application/public-exchange sources としている。この前提の受入可能な実装 evidence は今回の許可範囲に存在しない。

以上から、匿名での求人発見 → 同一募集の詳細 → 実応募先 → 戻り/再開を実レンダーで実行できない。したがって done condition は未充足であり、合格へ読み替えない。

## Evidence の層別結果

| 層 | 結果 | 今回の evidence / 境界 |
|---|---|---|
| Source | **確認済み** | 設計 contract と active source の bounded search。求人 route/renderer/application handoff は確認できない。 |
| Local rendered | **未実施** | 起動可能な求人 surface/fixture が source にない。reference prototype を代用しない。 |
| Staging | **未確認** | この実行環境から `https://staging.zukan.earth/` への read-only 接続は proxy の HTTP 403 で成立しなかった。403 を product response と解釈しない。 |
| Production | **未確認** | この実行環境から `https://zukan.earth/` への read-only 接続は proxy の HTTP 403 で成立しなかった。production mutation、dummy 応募、owner impersonation は行っていない。 |
| Auth / persistence / delivery | **未確認** | 実候補、許可済み通常 session、応募を所有する NOCOSIL 側 endpoint/evidence がない。 |
| Noah rendered verdict | **未取得** | 実画面がないため、独立した rendered acceptance を要求できない。 |

## 必須 viewport と操作の受入表

各行は同一の権利安全な候補・同一 edition を使い、一覧 → 詳細 → 応募 handoff → 戻り/再開を確認する。現時点では全行 **BLOCKED / NOT RUN** であり、見た目の推測で PASS にしない。

| 幅 / 条件 | 発見と詳細 | 応募 action / handoff | keyboard・IME・recovery | 現在の結果 |
|---|---|---|---|---|
| 320px | タイトル、雇用主、場所、条件、状態が欠けず折り返す | 44px 以上、既存 bottom nav/safe area と重ならない | 日本語 IME 表示中に固定 action が入力欄・error を隠さない | **BLOCKED / NOT RUN** |
| 375px | compact row から同一募集へ進み Back で filter/scroll を保持 | primary action は一つで、宛先を明示 | Tab/Shift+Tab、IME composition、再送で重複応募しない | **BLOCKED / NOT RUN** |
| 768px | 一覧と詳細の順序が読み順と一致 | external handoff 後に応募済みを推測しない | focus visible、error summary から該当入力へ移動 | **BLOCKED / NOT RUN** |
| 1024px | 長い日本語、200% text、partial data で横 overflow しない | closed/expired は新規応募を無効化 | offline/timeout 後も既知の募集文脈と再試行を保持 | **BLOCKED / NOT RUN** |
| 1160px | mobile/tablet navigation 側の境界を確認 | action と navigation が競合しない | focus order と読み順が一致 | **BLOCKED / NOT RUN** |
| 1161px | desktop header への切替で内容・選択状態を失わない | compact action panel が本文を隠さない | 切替前後で keyboard 到達可能 | **BLOCKED / NOT RUN** |
| 1280px | 最大幅、情報階層、余白、長文を確認 | 詳細を読まずに誤応募させない | retry/return が同じ募集 edition を参照 | **BLOCKED / NOT RUN** |

全 viewport 共通で、位置情報拒否・map failure でも list discovery を残し、empty、load failure、partial、closed、expired、provider unknown を区別する。色だけで状態を伝えず、accessible name に対象募集を含める。応募同意をイベント参加、公開、広告再利用、AI provider 送信の同意と結合しない。

## 合格に必要な再確認 packet

次のすべてがそろった時だけ本判定を更新する。

1. WFC-Z1 で採用された正確な source SHA と、active Worker が消費する materialized artifact の対応。
2. 権利確認済みの staging fixture または実在する公開募集（production へ synthetic/dummy record を作らない）。募集 ID、public edition、expiry/withdrawal source を記録する。
3. 一覧/Place から詳細へ進み、同じ募集の allowlisted NOCOSIL guest/application 宛先へ渡り、認証が必要なら同一 target へ戻る実導線。
4. クリック/ブラウザ復帰だけでは `応募済み` にせず、保存・重複送信防止・失敗・retry・再開を所有側 evidence で判定する negative/behavior test。
5. 上表の全幅で取得した実レンダー、状態、URL/fixture provenance、console error、keyboard/IME/200% text/safe-area の検査結果。
6. Noah の明示的な verdict と、未確認の auth・persistence・delivery・public availability を分離した記録。

## 今回行っていないこと

deploy、merge、secret/credential 参照、DB/DNS mutation、外部送信、実応募、dummy production record 作成は行っていない。既存の blocked slice を別 Work 名へ付け替えず、次の依存は contract が指定する WFC-Z1 と NOCOSIL application/public-exchange source のままとする。
