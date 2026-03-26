# 10x 音声ガイド設計書

## 現状の課題

現在の音声ガイド（voice_guide.php + VoiceGuide.js）は「検出→解説」の一方通行。
百科事典の朗読であり、フィールド体験としての楽しさが足りない。

### 現行アーキテクチャ
- **クライアント**: field_scan.php / walk.php → VoiceGuide.js（TTS or VOICEVOX音声）
- **API**: /api/v2/voice_guide.php → Gemini API でテキスト生成 → VOICEVOX で音声合成
- **2モード**: detection（種検出時）/ ambient（定期的な環境解説）
- **音声**: standard（Web Speech API）/ zundamon（VOICEVOX ずんだもん）

### 現行 voice_guide.php のコンテキスト
```json
{
  "mode": "detection|ambient",
  "species_name": "ヒヨドリ",
  "scientific_name": "Hypsipetes amaurotis",
  "confidence": 0.85,
  "latitude": 34.71,
  "longitude": 137.73,
  "area_name": "浜松市中央区（逆ジオコード）",
  "nearby_observations": ["過去の観察データ"],
  "random_angle": "12パターンからランダム選択"
}
```

---

## 10x 設計: 「フィールドのナチュラリスト友達」

### 設計原則
1. **物語構造**: セッションに起承転結を持たせる
2. **好奇心フック**: 次を予測し、探す楽しさを生む
3. **パーソナル成長**: ユーザーの累積データで成長実感
4. **生態系思考**: 種単体でなく関係性を語る
5. **貢献の具体化**: 「あなたの記録がなぜ価値あるか」を具体的に

---

### 1. セッションフェーズ（ナラティブアーク）

セッションを時間・検出数で4フェーズに分け、ガイドのトーンと内容を変える。

| フェーズ | 条件 | 内容 |
|---|---|---|
| **opening** | 開始〜2分 or 検出0件 | 場所の紹介、天候、過去データの概要、期待感を煽る |
| **active** | 検出1〜5件 | 種の解説 + 伏線（「この種がいるなら、あの種も…」） |
| **climax** | レア種検出 or 検出6件以上 | 興奮トーン、希少性の強調、記録の価値 |
| **closing** | 終了操作時 | セッション振り返りストーリー、次回への期待 |

**opening 例:**
```
「浜松市中央区、気温18度、曇り。この辺りは過去に32種が記録されてる。
 3月のこの時期はウグイスのさえずりが始まる頃。何に出会えるかな」
```

**closing 例:**
```
「今日は45分で8種に出会ったね。特にエナガとの出会いは
 このエリアでは珍しい。キミのLife Listは52種になったよ。
 次は早朝に来てみて。朝5時台だとまた違う顔ぶれに会えるはず」
```

### 2. 伏線・予測フック

検出した種から、次に出会えそうな種を予測して好奇心を刺激する。

```
「メジロが来たね。メジロは椿の蜜が好きだから、
 近くにツバキがあるはず。探してみて」

「シジュウカラがいるってことは、この林は虫が豊富。
 もしかしたらコゲラも来るかも。幹をトントン叩く音、聞こえない？」

「ウグイスの声が聞こえたけど、まだ地鳴きだね。
 あと2週間もすれば、ホーホケキョに変わるよ」
```

**実装**: 生態学的な関連種データをプロンプトに注入。Geminiに予測を生成させる。

### 3. パーソナル累積データ注入

ユーザーの過去データをガイドに織り込む。

```
「キミのLife Listに新しい種が追加されたよ！通算47種目」

「この場所、3回目のスキャンだね。前回はシジュウカラだけだったけど、
 今日はエナガもいる。時間帯の違いだね」

「キミが先月記録したこのエリアのデータ、実は
 この地域で唯一の冬季記録になってる」
```

**必要データ**:
- ユーザーの Life List（種数、最近追加された種）
- このエリアへの訪問回数・過去の検出種
- ユーザーの全体セッション数

### 4. 生態系ストーリーテリング

種単体でなく、種間関係・環境との関係を語る。

```
「常緑広葉樹が検出されたけど、この辺りだとたぶんクスノキかタブノキ。
 根元を見てみて、カブトムシの幼虫が好む腐葉土があるかも」

「ヒヨドリとメジロ、同じ蜜を巡るライバル。ヒヨドリは体が大きいから
 追い払うけど、メジロは素早さで対抗する」

「カワラヒワの群れだね。秋になるとここにセイタカアワダチソウの種を
 食べに来る。植物と鳥の共進化の現場だよ」
```

### 5. コントリビューション実感（価値の具体化）

抽象的な「市民科学に貢献」ではなく、具体的な価値を伝える。

```
「この地点、ikimonでは初スキャンだよ。キミが今まさに
 このエリアの生態系ベースラインを作ってる」

「3月の日曜午前にこの場所をスキャンしたのはキミだけ。
 天候と時間帯の組み合わせが貴重なデータになる」

「キミの記録が5回を超えた。これで季節変動の分析ができるようになる」

「この辺り、去年は誰も記録してなかった。キミのデータが
 来年の環境アセスメントの比較基準になるかもしれない」
```

---

## 拡張コンテキスト設計

voice_guide.php に渡すコンテキストを拡張する。

### 現行
```json
{
  "mode": "detection|ambient",
  "species_name": "...",
  "confidence": 0.85,
  "latitude": 34.71,
  "longitude": 137.73
}
```

### 拡張案
```json
{
  "mode": "detection|ambient|opening|closing",
  "session_phase": "opening|active|climax|closing",
  "session_context": {
    "species_count": 5,
    "duration_minutes": 23,
    "distance_meters": 1200,
    "detections_so_far": ["ヒヨドリ", "シジュウカラ", "メジロ"],
    "is_new_species_for_user": true,
    "is_first_scan_at_location": false,
    "area_visit_count": 3
  },
  "user_context": {
    "life_list_count": 46,
    "total_sessions": 12,
    "skill_level": "beginner|intermediate|advanced"
  },
  "area_context": {
    "area_name": "浜松市中央区",
    "total_species_recorded": 32,
    "last_scan_date": "2026-03-15",
    "seasonal_highlights": "3月はウグイスのさえずり開始期",
    "nearby_observations": [...]
  },
  "detection_context": {
    "species_name": "エナガ",
    "scientific_name": "Aegithalos caudatus",
    "confidence": 0.82,
    "detection_count_this_session": 1,
    "is_rare_for_area": true,
    "ecological_links": ["シジュウカラと混群を形成", "落葉樹林を好む"]
  },
  "weather": {
    "temp_c": 18,
    "condition": "曇り",
    "wind": "南西 3m/s"
  }
}
```

---

## 実装優先度

| 施策 | 難易度 | 効果 | 優先度 |
|---|---|---|---|
| セッションフェーズ (opening/closing) | 低 | 高 | ★★★ |
| 貢献メッセージ具体化 | 低 | 高 | ★★★ |
| パーソナルデータ注入 (Life List等) | 中 | 高 | ★★☆ |
| 伏線・予測フック | 中 | 極高 | ★★☆ |
| 生態系関係性 | 高 | 極高 | ★☆☆ |
| 天候・季節コンテキスト | 低 | 中 | ★★☆ |
| closing振り返りストーリー | 低 | 中 | ★★☆ |

---

## 技術スタック参照
- Backend: PHP 8.2, JSON ファイルストレージ
- Frontend: Alpine.js + Tailwind CSS + VoiceGuide.js
- AI: Gemini 3.1 Flash Lite Preview
- TTS: Web Speech API / VOICEVOX ずんだもん (port 50021)
- BirdNET: port 8100 on same VPS
- 主要ファイル:
  - `upload_package/public_html/api/v2/voice_guide.php`
  - `upload_package/public_html/assets/js/VoiceGuide.js`
  - `upload_package/public_html/field_scan.php`
  - `upload_package/public_html/walk.php`
