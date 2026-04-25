# ikimon.life 短尺動画 + AI同定 + Field Note 統合アーキテクチャ

更新日: 2026-04-17

## 結論

今日の段階での主案はこれ。

1. 動画は `新しいSNSフィード` ではなく `Field Note の証拠メディア` として入れる
2. 初期は `短尺限定` にする
3. 圧縮は `端末側を第一優先`、ただし `WebCodecs 利用可否で段階フォールバック` にする
4. 配信と保存は `managed video` を使い、ikimon 側は `asset ledger + 同定ロジック + privacy/publish rule` を持つ
5. AI は `動画を丸ごと1発で種名断定` ではなく、`代表フレーム + 音声 + 場所季節文脈` を束ねて `証拠に見合う粒度` で返す

この形が、`モバイル屋外で壊れにくい / 将来の容量問題に耐える / ikimon の不確実性スタンスを壊さない` の3つを最も両立する。

---

## なぜ動画を入れるべきか

動画は写真より次を拾いやすい。

- 行動
- 動き方
- サイズ感
- 体の角度変化
- 生息環境の連続文脈
- 鳥や虫なら鳴き声

つまり `同定精度` だけでなく、`あとで見返した時に場所の記憶が立ち上がる強さ` が高い。  
ikimon の主役が Field Note なら、動画は相性が良い。

ただし長尺をそのまま受けると、容量・配信・審査・AIコスト・オフライン再送が一気に破綻する。  
だから `短尺 evidence` として始める。

---

## 仕様の主案

### 1. 投稿制約

初期仕様は次で固定する。

- 1観察あたり `動画 1本 + 写真 0-4枚`
- 動画長: `6-15秒`
- 推奨: `8-12秒`
- 画面向き: 縦横どちらでも受ける
- 表示用標準: `720p / 24fps / H.264/AAC / MP4`
- 端末側圧縮後の目標サイズ: `3-8MB`
- アップロード許容上限: `20MB`

長尺自由投稿はやらない。  
ikimon に必要なのは `観察証拠` であって、動画SNSではない。

### 2. Field Note での扱い

動画は observation の `evidence` にぶら下げる。

- notes 一覧: ポスター画像 + 再生バッジ + 秒数
- observation detail: 写真と動画の mixed carousel
- note 本文: `何が映っているか / どこを見るべきか / 音は入っているか` を短文で残せる
- profile / map popup / review queue: まずポスターだけ見せる

`動画単独の別タイムライン` は作らない。  
Field Note first の原則を守る。

---

## 圧縮アーキテクチャ

### 主案

端末側圧縮は次の優先順位で行う。

1. `capture` で端末カメラを開く
2. `WebCodecs + Worker` が使える端末では client-side transcode
3. 使えない端末では録画ファイルをそのまま受けるが、長さとサイズで強く制限
4. サーバー側では `再エンコードの最小化` と `poster/keyframe/audio抽出` だけ行う

### 圧縮プロファイル

- codec: `H.264 + AAC`
- container: `MP4`
- fps: `24`
- 最大辺: `1280`
- 標準ターゲット: `720p`
- video bitrate: `1.2-2.0 Mbps`
- audio bitrate: `64-96 kbps`

このプロファイルなら、短尺観察動画として十分で、互換性も高い。

### なぜ ffmpeg.wasm を主役にしないか

`ffmpeg.wasm` は fallback には使えるが、主役にしない。

理由:

- モバイルで重い
- バッテリーと発熱コストが大きい
- codec を wasm 側で持つため初回負荷が重い
- WebCodecs が使える端末では二重に無駄

したがって、`WebCodecs がある端末は WebCodecs`、それ以外は `短尺制限 + managed upload` の方が実運用で強い。

---

## 保存と配信の主案

### 推奨

ユーザー向け動画配信は `managed video` を使う。現時点の主推奨は `Cloudflare Stream`。

理由:

- direct upload を切れる
- signed URL を標準で持てる
- ポスター・サムネイル・再生配信をまとめられる
- caption を API で持てる
- VPS で ffmpeg/HLS/権限制御を自前運用しなくてよい

### ikimon 側が持つべきもの

ikimon の DB / canonical には次を持つ。

- `asset_id`
- `provider` と `provider_asset_uid`
- `media_type`
- `asset_role`
- `duration_ms`
- `bytes`
- `width_px`, `height_px`
- `sha256`
- `poster_path`
- `caption_status`
- `moderation_status`
- `publish_visibility`
- `source_payload`

### やってはいけないこと

既存の `PUBLIC_DIR/uploads` / `persistent/uploads` の流儀に、生動画をそのまま主保存先として載せること。  
現行でも asset path は drift しており、動画でそこを拡大すると後で回収不能になる。

---

## AI同定アーキテクチャ

### 原則

AI の役割は `確定` ではなく `候補提示 + 属止め理由 + 次の撮り方`。

### パイプライン

1. 動画受信
2. poster 生成
3. `6-12枚` の代表フレーム抽出
4. 音声抽出
5. 音声が有効そうなら `BirdNET / Perch`
6. 代表フレームを既存の visual assessment lane に流す
7. 場所・季節・managed context・note を加えて fusion
8. `recommended_taxon / why_not_more_specific / next_step` を返す

### 返すべき出力

- `この動画だけで安全に言える粒度`
- `見えた特徴`
- `見えなかった特徴`
- `音が効いたかどうか`
- `この場所 / 季節での補助ヒント`
- `次に何を撮ると進むか`

### やらない方がいいこと

- 動画全体を LLM に丸投げして species 断定を primary にする
- 1本の動画から public strong claim を直接出す
- rare / invasive / out-of-range を AI 単独で確定する

---

## データモデル

### 現行 PHP canonical の最小拡張

`evidence.media_type` に少なくとも次を追加する。

- `video`
- `poster`
- `video_frame`
- `audio_extract`

`metadata` には次を入れる。

- `provider`
- `provider_uid`
- `frame_count_sampled`
- `has_audio`
- `orientation`
- `transcode_profile`
- `caption_status`
- `moderation_status`

### v2 への寄せ先

長期の正本は、すでにある `asset_blobs / evidence_assets` に寄せる。

初期 role 例:

- `observation_video`
- `observation_video_poster`
- `observation_video_frame`
- `observation_video_audio`
- `observation_video_caption`

つまり、動画導入は `現行 PHP の延命改修` で終わらせず、`v2 asset ledger へ素直につながる形` にしておく。

---

## UI 導線

### 投稿画面

`post.php` に次を足す。

- `写真で残す`
- `短い動画で残す`
- `写真 + 動画`

録画前に次を明示する。

- `8-12秒推奨`
- `生き物の特徴が分かる動き`
- `鳴き声が入るなら有利`
- `暗所や長回しは非推奨`

### Observation Detail

既存の photo carousel を mixed media carousel にする。

- poster 表示
- 再生
- keyframe strip
- AIの「ここを見た」 explanation

### Field Note

動画は `その日のページを厚くする証拠` として入れる。

- note card に秒数
- `この動画で分かったこと`
- `次に取りたい角度`
- `この記録は future AI にどう効くか`

---

## コスト判断

### 推奨判断

`最安` だけなら object storage 直置きの方が安く見える。  
だが `アップロードの壊れやすさ / 配信 / signed URL / poster / caption / transcode / 運用工数` まで入れると、初期は managed video の方が総コストで勝ちやすい。

### 参考計算

Cloudflare Stream は `ファイルサイズ` ではなく `保存分数 / 配信分数` 課金。  
短尺クリップ 10,000 本を `12秒` で保存すると、保存量は約 `2,000分`。  
概算では `保存 $10/月`。  
これが合計 `6,000分` 再生されても、配信は概算 `+$6/月`。

一方 R2 は保存自体はかなり安い。  
ただし動画配信基盤を自分で持つ必要があり、ikimon の現段階では `安いが重い`。

---

## 実装順

### Phase 1

- 動画 1本投稿
- poster 生成
- notes / detail / profile で表示
- 端末側圧縮
- signed playback

### Phase 2

- keyframe 抽出
- 音声抽出
- video AI assessment
- caption 自動生成

### Phase 3

- moderator lane
- school / guardian safe rules
- asset retention policy
- contribution feedback

---

## 採用条件

- Field Note first を壊さない
- 端末圧縮後に屋外回線でも現実的に送れる
- AI が `断定` より `証拠に見合う粒度` を返せる
- asset path を repo filesystem 前提にしない
- v2 asset ledger に素直に接続できる

## 不採用条件

- 長尺自由投稿が前提になる
- 動画専用 feed を別に生やしたくなる
- 生ファイルを既存 uploads 直保存で回そうとする
- AI が species certainty machine に戻る

## 計測指標

- 投稿完了率
- 動画投稿の平均アップロード時間
- 失敗率
- 再送率
- AI assessment 完了率
- `属止めでも納得できた` 率
- observation detail 再訪率
- note 再読率
- 1投稿あたり保存コスト
- 1投稿あたり AI 処理コスト

---

## 最後に

ikimon に動画を入れるべきかの答えは `Yes`。  
ただし `動画を主役にする` のでなく、`Field Note の証拠密度を上げる短尺メディア` として入れるべき。

それが、今の ikimon の思想・実装資産・容量制約・将来の v2 asset ledger の全部に一番きれいにつながる。
