# FieldScan Macro-Sensor-Post Strategy

Updated: 2026-04-04

## Core Thesis

`ikimon.life` における FieldScan の主目的は、移動中に種名を当てることではない。

FieldScan 全体は `マクロ情報取得` のための層であり、連続的に次のような観測文脈を取るための仕組みとして定義する。

- どこを通ったか
- どんな habitat に入ったか
- 人工度や disturbance がどう変わったか
- 生きもの反応が強い区間がどこか
- 後で止まって観察・投稿すべき場所がどこか

`Drive Mode` はその一形態であって、本質ではない。歩きでも自転車でも車でも、FieldScan の責務は `マクロな観測文脈を連続取得すること` にある。

## 3-Layer Model

### 1. FieldScan = Macro

FieldScan は広い範囲を連続的に見る層。

- 広域
- 粗い解像度
- 連続時系列
- 観測文脈の取得
- 変化点とホットスポット候補の抽出

ここで求めるもの:

- `context_timeline`
- `scene_segments`
- `route`
- `movement`
- `habitat / disturbance / water / canopy`
- `hotspot likelihood`

ここで求めないもの:

- species-level の高精度同定
- 1件1件の確定記録
- 投稿そのもの

### 2. いきものセンサー = Middle

いきものセンサーはマクロとミクロの中間層。

- 今この周辺に生きもの感があるか
- 反応が増えたか
- 止まる価値があるか
- Quest を発火すべきか

出すべきもの:

- `signal strength`
- `curiosity score`
- `stop recommendation`
- `reason tags`
  - 例: 林縁, 水辺, 人工度低下, 反応上昇

ここでも species 名は主目的ではない。必要なら補助情報に留める。

### 3. Observation / Post = Micro

投稿はミクロ観測の層。

- 止まる
- 狙って撮る / 録る
- 対象を確認する
- 証拠として残す
- species / 個体 / 状況を丁寧に記録する

ここで初めて、種レベル同定や証拠性が主役になる。

## Quest as Connector

Quest は `FieldScan Macro` と `Observation Post` をつなぐ行動変換層として扱う。

流れ:

1. FieldScan が広域の文脈を取る
2. いきものセンサーが局所反応を拾う
3. Quest が「ここで何をするべきか」を定義する
4. ユーザーが止まって Observation / Post に入る

Quest の役割:

- 止まる理由を与える
- 観察行動を具体化する
- マクロな発見をミクロな記録へ変換する

例:

- 「この先の林縁で 1 分静止して音を録る」
- 「水辺区間で昆虫クエストを開始する」
- 「反応上昇地点で写真投稿を 1 件残す」

## Product Interpretation

`ikimon.life` を最大化するなら、FieldScan は単なる AI 同定アプリではなく `観測OS` の一部として考えるべき。

役割分担:

- FieldScan: 連続探索
- いきものセンサー: 反応検知
- Quest: 行動変換
- Post: 証拠記録

この構造により、`種名データベース` ではなく `観測行動そのものを支援するプロダクト` になる。

## Current Implementation Status

2026-04-04 時点で、FieldScan 実装は次の土台まで進んでいる。

- Perch runtime 修理済み
- diagnostics 保存 / 送信あり
- `vehicle` は音声 OFF
- 視覚フレームは Service に届く
- Gemini 視覚推論は動作確認済み
- 環境推定は動作確認済み
- `scene_transitions` を保存
- `sensor_*`, `route_*`, `build_version_*` を保存
- 起動前の runtime 診断カードあり

保存される代表項目:

- `movement_mode`
- `audio_enabled`
- `vision_interval_ms`
- `env_interval_ms`
- `environment_*`
- `scene_transitions`
- `sensor_steps_since_start`
- `sensor_pressure_hpa`
- `sensor_is_stationary`
- `route_distance_m`
- `route_elevation_change_m`
- `vision_attempts / vision_successes`
- `environment_attempts / environment_successes`

## Strategic Correction

これまでズレやすかった点:

- `Drive Mode = 種同定モード` と見なしてしまう
- `FieldScan = species detection app` と見なしてしまう

修正後の定義:

- `FieldScan = Macro Context Acquisition`
- `Drive Mode = Macro の profile のひとつ`
- `いきものセンサー = Macro と Micro をつなぐ middle layer`
- `Observation/Post = Micro Evidence Capture`

## What FieldScan Should Output

FieldScan が最終的に返すべき成果物は、種一覧ではなく次のような `観測文脈レポート`。

例:

- 00:00-03:20 市街地・人工度高・観測優先度低
- 03:20-07:40 農地・開放地・昆虫 / 鳥類向き
- 07:40-10:10 林縁・水辺近接・停止推奨

加えて局所シグナルとして:

- 生きもの反応: 高
- 停止推奨: あり
- 理由: 林縁 + 水辺 + 反応上昇

この出力が Quest に変換され、そこで初めてユーザー行動に落ちる。

## Near-Term Plan

### Immediate

- `scene_transitions` を `context_timeline` として再定義する
- `vehicle` だけでなく `walk / bicycle` でも Macro として一貫させる
- species 名より `signal strength / stop価値` を重視する

### Mid-Term

- `scene_transitions` を圧縮して `scene_segments` にする
- Quest seed を自動生成する
- `ikimon sensor` の出力を `reason tags` ベースにする

### Long-Term

- `Drive -> Sensor -> Quest -> Post` を `ikimon.life` の中核 UX として統合する
- Macro 文脈と Micro 投稿を時系列 / 地図上で結びつける
- 「何がいたか」だけでなく「なぜそこにいた可能性が高いか」まで扱う

## Design Principle

FieldScan の成功条件は、

`移動しながら正確に種名を当てること`

ではなく、

`観測価値の高い場所・区間・瞬間を見つけ、次の観察行動につなげること`

である。

これを外すと、FieldScan は中途半端な種判定アプリで終わる。
これを守ると、FieldScan は `ikimon.life` における探索OSになる。
