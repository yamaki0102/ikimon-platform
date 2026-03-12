# ikimon.life 習慣化戦略 2026-03-07

## 結論

`ikimon.life` が世界中の強いアプリと戦うには、`生物観察アプリ` の枠で戦ってはいけない。

戦うべき市場は次の4つの重なりだ。

1. 毎日の散歩・軽運動
2. 身近な自然への気づき
3. 自己効力感が積み上がる学習
4. 地域に役立つ市民科学

つまり目指すべきプロダクトは、`図鑑アプリ` でも `投稿SNS` でもなく、`自然に出る習慣をつくるOS` である。

そのために必要なのは、表面的なゲーミフィケーションではない。  
`戻る理由` を毎日作り、`外に出る理由` を今この瞬間に作り、`続けた意味` を週単位で回収できる構造だ。

## まず押さえるべき現実

### 1. Duolingo は「学習」ではなく「再訪設計」で勝っている

- `streak`
- `daily quests`
- `friend streaks`
- `league`
- `週末救済`
- 行動直後の強いフィードバック

重要なのは、1回の学習価値だけでなく、`明日も戻る理由を複数持っている` こと。

### 2. しかし Duolingo だけを真似ると本筋を見失う

自然観察は語学学習と違い、毎日同じ条件で机に向かえない。

- 天気が違う
- 季節が違う
- 体力が違う
- 外出可否が違う
- 観察対象の出現確率が違う

だから `毎日必ず同じ量をこなす圧力` は相性が悪い。  
必要なのは `柔らかい連続性` と `現地文脈に紐づく動機` だ。

### 3. 世界の強いアプリは、継続を1つの仕組みで支えていない

調査した主要アプリ群を分解すると、勝っている理由はだいたい次の6層に整理できる。

1. `Cue` 今やる理由
2. `Action` すぐ終わる最小行動
3. `Reward` 直後の手応え
4. `Progress` 積み上がりの可視化
5. `Social` 一人で終わらない関係性
6. `Recovery` 途切れても戻れる救済

`ikimon.life` は現状、`Progress` の素材はあるが、`Cue` `Action` `Recovery` が弱い。

## 世界アプリから抽出した勝ち筋

## 1. Duolingo から学ぶべきこと

- 習慣は `1回の重い成果` より `毎日戻る低摩擦ループ` で作られる
- `友達との連続記録` は、ランキングより健全に継続率を押し上げやすい
- 週末救済や緩衝機能は、離脱防止に効く
- 毎回の完了演出は小さくても強い

`ikimon.life` への翻訳:

- 毎日の最小行動を `投稿` だけにしない
- 個人 streak ではなく `自然に気づいた連続日数` に再定義する
- 失敗時に罰するのではなく `戻りやすくする`

## 2. Strava から学ぶべきこと

- `個人目標 + チャレンジ + クラブ` の3層で継続を作る
- 投稿それ自体より `先に身体が動く` 設計をしている
- 週単位・月単位の積み上がりが明快

`ikimon.life` への翻訳:

- `歩く` を主行動として正面から扱う
- 個人目標と地域チャレンジを分ける
- `今週の自然時間` `今週の探索距離` `今週の新発見` を固定表示する

## 3. Apple Fitness から学ぶべきこと

- 継続の敵は怠惰だけでなく `罪悪感` である
- 目標調整やリング一時停止のような柔軟性が離脱を防ぐ

`ikimon.life` への翻訳:

- 毎日の最低目標を固定しない
- 雨天・多忙・体調不良の日は `ライトモード` に切り替えられるべき
- `今日は1件投稿できなかった` ではなく `1分だけ自然に意識を向けた` でも継続扱いにする

## 4. iNaturalist / City Nature Challenge から学ぶべきこと

- 観察は一人で閉じるより `地域参加` にすると強い
- イベント期間の局所的熱量がコミュニティを育てる
- 個人の記録が都市・地域の成果につながると意味が増す

`ikimon.life` への翻訳:

- `地元チーム戦`
- `今週の公園ビオブリッツ`
- `浜松の春の初認チャレンジ`

のような `地域単位の短期熱量` を作る。

## 5. Merlin / eBird から学ぶべきこと

- 継続は `役に立つ現場価値` がある時に強い
- その場所・その季節・その時間で「今見つかりやすいもの」が分かると外に出る理由になる
- Life List は強い蓄積欲求を生む

`ikimon.life` への翻訳:

- `今日この近くで会えそうないきもの`
- `今週まだ見ていない春の3種`
- `この公園で次に狙える種`

という `現地文脈のターゲティング` が必要。

## 6. Finch から学ぶべきこと

- 継続アプリは、厳しさより `自己受容` の設計が強い
- ジャーニー、育成、振り返りが「自分を裏切った感」を減らす

`ikimon.life` への翻訳:

- 連続記録を脅しに使わない
- `今日の自然メモ`
- `気分の回復`
- `散歩できた自分の記録`

も価値として扱う。

## ikimon.life の現在地

コードベースを見る限り、土台はすでにある。

### すでにある強い資産

- `upload_package/libs/StreakTracker.php`
- `upload_package/libs/QuestManager.php`
- `upload_package/libs/WellnessCalculator.php`
- `upload_package/public_html/ikimon_walk.php`
- `upload_package/public_html/wellness.php`
- `upload_package/public_html/sw.js`
- `upload_package/public_html/manifest.json`
- `upload_package/libs/Notification.php`
- `upload_package/public_html/assets/js/analytics.js`

つまり `習慣化の部品` はある。

### しかし根本問題は「一つの継続ループになっていない」こと

確認できた主な断絶は次の通り。

1. `streak` が実質 `投稿 streak` に偏っている  
   `upload_package/public_html/api/post_observation.php` で投稿成功時に `StreakTracker::recordActivity($userId)` を呼んでいる。

2. `歩いた日` `識別した日` `振り返った日` が継続として十分に統合されていない

3. `さんぽ` `投稿` `wellness` が別画面・別文脈で、ユーザーには一つの旅として見えない

4. アナリティクスが主に `投稿ファネル` に寄っており、`D1/D7/D30` や `継続行動の多様性` を見れていない  
   `upload_package/public_html/api/save_analytics.php` の event whitelist も投稿系中心。

5. `今日これをやると意味がある` という現地文脈の提示が弱い

6. `復帰設計` がまだ薄い  
   途切れた人を責めずに戻す導線が必要。

## 提案: ikimon Habit OS

`ikimon.life` を次の4レイヤーで再構成する。

## Layer A. Minimum Daily Loop

毎日やる最小行動を `投稿` から解放する。

### 新しい最低行動の定義

その日の `habit complete` は次のいずれか1つで成立させる。

1. 1件観察を投稿した
2. 10分以上の自然散歩を完了した
3. 1件の同定・レビューに貢献した
4. その日の自然メモを残した

重要なのは、`ゼロの日` を減らすこと。

### ねらい

- 投稿圧を下げる
- 雨の日や忙しい日でも戻れる
- 真面目ユーザーほど燃え尽きる問題を防ぐ

## Layer B. Contextual Trigger Engine

世界と戦うには、通知ではなく `文脈トリガー` が必要。

### 出すべきトリガー

1. `今から30分だけ歩けるなら、この近くで春の草花3種を狙えます`
2. `昨日の場所では未記録のチョウが出やすい時間です`
3. `今週まだ自然120分まであと18分`
4. `近くの公園で今週の地域チャレンジ開催中`

### 条件に使う信号

- 位置
- 時刻
- 曜日
- 季節
- 天気
- 過去の観察傾向
- Life List の穴
- 継続状態

## Layer C. Reward Without Betrayal

報酬は増やすが、本筋を壊す報酬は入れない。

### 入れるべき報酬

1. `今日の発見`
2. `新しい季節の初認`
3. `ライフリスト到達`
4. `今週の自然時間達成`
5. `地元への貢献`
6. `友達と続いた日数`

### 入れてはいけない報酬

1. 無意味なコイン乱発
2. 投稿数だけを過剰に煽るランキング
3. データ品質を落とす高速連投インセンティブ

## Layer D. Social and Local Identity

自然観察の継続は、グローバル全体戦より `小さな共同体` の方が強い。

### 実装すべき社会設計

1. `友達 streak`
2. `家族チーム`
3. `学校 / 地域 / 企業チーム`
4. `公園単位の週次チャレンジ`
5. `市区町村 seasonal event`

ここで勝つ鍵は、`世界一の巨大SNS` を作ることではない。  
`半径5kmの意味` をプロダクト化することだ。

## プロダクトの中核機能案

## 1. Today Card をホームの最上段に置く

`index.php` と `dashboard.php` の最上部に、毎日1枚だけ出る主カードを置く。

表示要素:

- 今日の最低目標
- 近くで狙える対象
- 今週の自然時間
- 現在 streak
- 1タップ開始導線

このカードが毎日の起点になる。

## 2. Streak 2.0 を導入する

`投稿連続日数` ではなく `自然との接続連続日数` に変更する。

### ルール案

- `Full`: 投稿 or 散歩+観察 or 同定貢献
- `Light`: 1分自然メモ or ミニチェックイン
- `Rest`: 計画休息

### 表示

- `🔥 12日連続`
- `🌿 今日は Light day でも継続可能`
- `☔ 雨天モード: 近所の鳥の声チェックでOK`

## 3. Walk → Observation → Reflection を1本化する

今の `ikimon_walk` `post.php` `wellness.php` を一続きの流れにする。

理想の流れ:

1. `歩き始める`
2. 気になったら即投稿
3. 終了時に自動サマリー
4. `今日の発見` と `次回のおすすめ` を返す

今はこの3つが別物に見える。  
ここを一つに束ねるだけで体験密度が大きく変わる。

## 4. Local Targets を作る

`Merlin / eBird` 的な現場価値を導入する。

### 例

- 今日この場所で会いやすい3種
- 今月まだ記録していない春の草花
- キミのライフリストで次に埋まりやすい穴
- この公園の未確認カテゴリ

これは `投稿しろ` より圧倒的に強い外出理由になる。

## 5. Gentle Recovery を入れる

途切れた時のUXを設計する。

### 必須要件

- 連続が切れても復帰しやすい
- 罪悪感を煽らない
- `昨日で終わった人` ではなく `今日から再開できる人` として扱う

### 復帰導線の例

- `3日空いたけど、季節はまだ続いている`
- `今日は5分だけで再開できます`
- `前回の場所の続きから再開`

## 6. 地域イベントを日常化する

`City Nature Challenge` 的な短期熱量を、日常アプリの中に持ち込む。

### 機能例

- 今週の公園チャレンジ
- 市町村対抗の春の初認戦
- 学校クラス別 BioBlitz
- 会社チームの昼休み自然散歩

単発イベントで終わらせず、`日常 habit を増幅する特別期間` として設計する。

## 7. Mastery Path を用意する

上級者は `投稿数` だけでは残らない。  
上級者には `深さの成長線` が必要。

### 軸

- 新種発見
- 同定精度
- 地域貢献
- 季節観察の継続
- 特定分類群の習熟
- 調査品質

`見る目が育っている感覚` を出す。

## 実装計画

## Phase 0. 計測再設計

期間: 1週間

### やること

1. `analytics` に habit 系イベントを追加
2. `meaningful_activity_day` を定義
3. D1 / D7 / D30 を追える集計を追加
4. `first observation -> second day return` を計測
5. `walk only`, `post only`, `id only`, `mixed` の行動タイプを切る

### 新イベント例

- `today_card_open`
- `habit_goal_set`
- `walk_start`
- `walk_end`
- `micro_checkin_complete`
- `daily_prompt_open`
- `daily_prompt_accept`
- `streak_state_view`
- `streak_recovery_used`
- `challenge_join`
- `challenge_complete`
- `friend_nudge_sent`

### KPI

- Activation7: 7日以内に2日以上 meaningful activity
- Habit7: 7日以内に3回以上 meaningful activity
- D7 return
- D30 return
- 投稿率だけでなく `自然接続率`

## Phase 1. Habit Core

期間: 2週間

### 実装対象

1. `libs/HabitEngine.php`
2. `libs/DailyPromptEngine.php`
3. `api/get_today_loop.php`
4. `api/log_micro_activity.php`
5. `api/set_habit_goal.php`
6. `data/habits/{userId}.json`
7. `data/habit_logs/YYYY-MM/{userId}.json`

### 画面変更

1. `index.php`
2. `dashboard.php`
3. `profile.php`

### 完成条件

- 今日カードが出る
- Light / Full / Rest の3状態が機能する
- 投稿以外でも streak が成立する

## Phase 2. Walk Fusion

期間: 2週間

### 実装対象

1. `ikimon_walk.php` と `wellness.php` の役割整理
2. 歩行終了時の recap 生成
3. `walk -> post` のショート導線
4. 週自然時間と walk streak の統合表示

### 完成条件

- ユーザーが `歩く` と `観察する` を同じ旅として認識できる
- セッション終了時に次回行動が提示される

## Phase 3. Local Targets

期間: 2〜3週間

### 実装対象

1. `api/get_local_targets.php`
2. `libs/LocalTargetEngine.php`
3. 位置・季節・ライフリスト差分に基づく候補生成
4. ホームとマップでの提示

### MVPロジック

- 過去30日の近隣記録
- 自分の未記録 taxa
- 季節に合う group
- 近距離 hotspot

### 完成条件

- `今日何を探すべきか` が毎日変わる
- 投稿要求より先に探索理由が立つ

## Phase 4. Recovery and Social

期間: 2週間

### 実装対象

1. Streak 回復導線
2. 友達 streak
3. 小チーム challenge
4. 地域イベント join UI

### 完成条件

- 一人で続けられない人に関係性の支えが入る
- 途切れた人の再開率を測れる

## Phase 5. Mastery and Local Moat

期間: 3週間

### 実装対象

1. 分類群別 mastery
2. 季節アーク
3. 地域貢献指標
4. フィールドごとの継続ストーリー

### 完成条件

- 初心者は気軽に続き
- 上級者は深く残る

## アーキテクチャ提案

## 新規クラス

- `HabitEngine`
- `DailyPromptEngine`
- `LocalTargetEngine`
- `RecoveryManager`
- `ChallengeManager`
- `RetentionAnalyticsService`

## 既存クラスの役割変更

- `StreakTracker`
  - 投稿起点の streak から、複数 activity 起点へ拡張

- `QuestManager`
  - `今日の3クエスト` を固定抽選ではなく、ユーザー状態と地域文脈に応じた `adaptive quests` に進化

- `WellnessCalculator`
  - 後追いサマリーだけでなく、`今週あと何分` を返すリアルタイムガイド役も兼ねる

- `Notification`
  - 汎用通知から `contextual nudge` に進化

## データモデルの考え方

### `habit profile`

- daily minimum mode
- preferred time
- preferred activity
- recovery preference
- notification consent

### `habit log`

- date
- activity types
- intensity
- streak impact
- location context
- challenge context

### `local targets cache`

- lat/lng mesh
- season
- likely taxa
- confidence
- freshness

## 絶対にやってはいけないこと

1. `投稿数ランキング` を habit の中心に置く
2. streak を厳罰化する
3. AI同定を主役にして観察体験を薄める
4. 通知を大量送信して疲弊させる
5. 新規ユーザーに最初から高負荷を要求する
6. 歩行習慣と観察習慣を別体験のまま放置する

## 勝ち筋の定義

世界で勝てる状態とは、`一番正確な同定DB` になることではない。  
次の状態を作ることだ。

- ユーザーが朝 `今日はちょっと外を見よう` と思える
- 5分の散歩が `生きものとの接続` に変わる
- その記録が `自分の成長` と `地域の価値` の両方になる
- 1週間後に `続いている` と実感できる

これができれば、`自然観察の小市場` ではなく、`日常の注意と回復の市場` に入れる。

## 直近で着手すべき3つ

1. `Today Card + 新habit定義` を最優先で作る
2. `投稿以外でも成立する streak` に変える
3. `local targets` で外出理由を生成する

この3つだけで、`習慣化のOS` の核が立つ。

## Sources

- Duolingo: [How Duolingo uses animations to keep you learning](https://blog.duolingo.com/how-duolingo-uses-animations/)  
- Duolingo: [Product Highlights 2024](https://blog.duolingo.com/duolingo-product-highlights-2024/)  
- Duolingo: [Duolingo streaks are a habit-building tool](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)  
- Duolingo: [Friend Streaks](https://blog.duolingo.com/friend-streak-feature/)  
- Strava: [Group Challenges on Strava](https://support.strava.com/hc/en-us/articles/36763688074011-Group-Challenges-on-Strava)  
- Apple: [Customize Activity goals on iPhone](https://support.apple.com/guide/iphone/customize-activity-goals-iph9a08e004e/ios)  
- iNaturalist: [About iNaturalist](https://www.inaturalist.org/about)  
- City Nature Challenge: [Official Site](https://www.citynaturechallenge.org/)  
- Merlin Bird ID: [Official Site](https://merlin.allaboutbirds.org/)  
- eBird: [Official Site](https://ebird.org/home)  
- Finch: [Official Site](https://finchcare.com/)  
- Habit formation research: [Lally et al. 2010 PDF](https://www.researchgate.net/profile/Phillippa-Lally/publication/51541847_How_are_habits_formed_Modelling_habit_formation_in_the_real_world/links/5441737d0cf2a76a3cc7d719/How-are-habits-formed-Modelling-habit-formation-in-the-real-world.pdf)  
- Nature exposure research: [White et al. 2019](https://www.nature.com/articles/s41598-019-44097-3)

## 次の進化

1. この計画をそのまま実装着手できるよう、`Phase 1 の詳細仕様書` と `API / JSON schema` に落とし込む
2. 先に `Today Card` の画面モックを `.pen` か HTML で作り、習慣ループが視覚的に成立しているか検証する
3. 既存コードに対して `HabitEngine` 導入のための差分設計を作り、どの既存クラスをどう整理するかまで具体化する
