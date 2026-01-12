# ikimon.life 開発ガイド (The Constitution)

## 🌟 プロジェクトの核心 (Core Vision)
ikimon は「誰もが生物学者になれる」市民参加型プラットフォームです。
**「手触り感 (Tezawari)」** のあるUIと、**「圧倒的コンテキスト」** を持つAIナビゲーターにより、生物観察の楽しみを最大化します。

---

## 📁 プロジェクト構成

```
ikimon/                         ← プロジェクトルート
│
├── book_digitization/          ← 📚【本の読み取り専用】
│   ├── 原色日本野鳥生態図鑑/      デジタル化待ちの図鑑データ
│   ├── 日本のクモ/               （19冊分のスキャン画像）
│   ├── クワガタムシハンドブック/
│   └── ... 
│
├── deploy/                     ← 🚀【FTPアップロード専用】
│   └── ikimon.life/            
│       ├── public_html/        ← Webルート
│       ├── libs/               ← PHPライブラリ
│       ├── data/               ← JSONデータベース
│       ├── config/             ← 設定ファイル
│       └── lang/               ← 多言語ファイル
│
├── ikimon.life/                ← 🛠【開発環境】ソースコード
│   ├── upload_package/         ← 開発用パッケージ
│   │   ├── public_html/        ← Webルート
│   │   ├── libs/               ← PHPライブラリ
│   │   ├── data/               ← JSONデータベース (V3 Schema)
│   │   │   └── legacy_ingest/  ← Agentが抽出した「文脈付き」データ
│   │   ├── config/             ← 設定ファイル
│   │   └── lang/               ← 多言語ファイル
│   ├── readme/                 ← 📜 開発ドキュメント
│   ├── 要件/                   ← 📋 仕様書
│   └── tests/                  ← 🧪 テスト
│
├── sync_deploy.ps1             ← 🔄 同期スクリプト
└── ikimon.life.code-workspace  ← VS Codeワークスペース
```

---

## 📦 デプロイ手順

### Step 1: 開発後、同期スクリプトを実行
```powershell
cd "g:\その他のパソコン\マイ ノートパソコン\antigravity (1)\ikimon"
.\sync_deploy.ps1
```

### Step 2: FTPでアップロード
- **FTP先**: `ftp://www1070.onamae.ne.jp/ikimon.life`
- **アップロード対象**: `deploy\ikimon.life\` の中身

> [!TIP]
> `sync_deploy.ps1` は `robocopy /MIR` を使用するため、削除されたファイルも反映されます。

---

## 🧭 あなた（ユーザー）が望んでいること

### 1. Bio-Akinator (バイオ・アキネーター)
- **「最短同定」**: 親切な解説より、YES/NOでズバリ正解に導く機能美。
- **「ロジックの弾丸」**: 100冊分の図鑑から抽出された「識別点」が、このエンジンの燃料。

### 2. データ資産価値 (Data Asset)
- 単なる同定マシンで終わらせない。
- **「読み物として面白い」**: 飼育法、歴史、民俗学的背景。
- **「著者への還元 (Traffic Back)」**: Amazonリンクや論文引用で、元ネタへの敬意と収益化を両立。

---

## 🤖 私（Agent）がすべきこと

### Mass Ingestion (Context-Aware)
単なるOCR（文字起こし）ではありません。**「文脈の理解」** です。
- **❌ OCR**: 「P10: 水槽を用意」「P11: 卵を産む」 (バラバラの情報)
- **❌ Simulation**: 「たぶんこう書いてあるだろう」というダミーデータ作成は**厳禁**。
- **✅ Agent**: 画像を実際に「見て」、そこに書かれている事実のみを構造化する。**「見えないものはデータ化しない」**。

### 100冊インジェスト計画

| # | 戦略名 | 対象資料 | 抽出データ (文脈) |
|:--|:------|:--------|:----------------|
| 1 | **Logic Mining** | ハンドブック | 「なぜこの虫か？」の診断ロジック |
| 2 | **Hybrid Mining** | リバーガイド | 「上流か下流か？」の生息文脈 |
| 3 | **Entity Mining** | 歴史・文化書 | 「昔はどう呼ばれたか？」の時間文脈 |
| 4 | **Sensory Mining** | 鳴き声図鑑 | 「どんな音がするか？」の感覚情報 |
| 5 | **Methodology** | 雑誌 | 「どうやって飼うか？」の手順 |
| 6 | **Index-Validation** | 鳥類事典 | 「正しい学名は？」の権威付け |
| 7 | **Bibliography Mining** | 学会誌 | 「誰が発見したか？」の出典追跡 |

---

## 📚 Digitized Library Shelf (現在の取り込み状況)

> [!IMPORTANT]
> **標準ワークフロー**: 全てのインジェストは [デジタル化ワークフロー V4](../.agent/workflows/digitize-legacy-books.md) に従うこと。
> **API非依存**: 外部APIスクリプトは使用禁止。Agent Vision で直接画像を読み取る。

| 書籍名 | ステータス | ページ数 |
|:------|:---------|:--------|
| **日本の野鳥650** | 🔄 Redoing | 0/444 |
| **鳴き声から調べる昆虫図鑑** | 🔄 New Spec | ~300 |
| **フィールドガイド_日本のチョウ** | 🔄 Processing | 36/174 |
| **動物大百科** | ✅ Complete | 114/114 |
| **クワガタムシハンドブック** | ✅ Complete | 139/139 |
| **リバーガイド相模川** | ✅ Complete | 116/116 |
| **インセクタリゥム Vol 37** | ✅ Complete | 31/31 |
| **世界鳥類事典** | ✅ Complete | 236/236 |
| **魚の文化史** | ✅ Complete | 301/301 |
| **日本鳥類大圖鑑 (昭和27年)** | ✅ Complete | 307/307 |
| **原色樹木図鑑 Vol.2** | ✅ Complete | 227/227 |
| **学研の図鑑LIVE_昆虫** | ✅ Complete | 166/166 |

---

## 🛠 技術スタック

| カテゴリ | 技術 |
|:--------|:----|
| **Server** | お名前.com RSプラン (PHP 8.2) |
| **Database** | JSON (FileSystem NoSQL) → Future: Vector DB |
| **Frontend** | Tailwind CSS + Alpine.js + MapLibre GL JS |

---

## ⚠️ 開発者への指示

1. **【厳守】No More Simulations**: 空のデータや想定データで埋めることは禁止。Vision API で読み取れない場合は `pending` ステータスとする。

2. **【真実】Visual Identification**: 単に文字をOCRするのではなく、「人間の目」として、その生物が他とどう違うか（同定ポイント）を言語化すること。

3. **【全言語化】Complete Visual Verbalization**: 原典は「入手不可能」と仮定。画像が消失しても、テキストだけで読者が脳内に再現できるように完全に言語化する。

4. **【厳守】Quality Over Speed**: 早く終わらせようとしない。「丁寧さ」こそが最大の価値。

5. **【継続執行】Continuous Execution**: 品質に問題がなければ、本の最後のページまで止まらずに処理を続ける。

6. **【言語】Japanese Response Only**: ユーザーへの応答は原則として日本語で行う。

---

## 🛡️ ZERO LOSS PROTOCOL

**【絶対遵守】全生物・全エンティティの完全救済 (No One Left Behind)**

### 1. Pre-flight Visual Audit (予備調査)

#### Step 1: Theme & Structure Identification
- **What**: 図鑑ページか？ コラムか？ 索引か？
- **Structure**: レイアウト構造を言語化する。

#### Step 2: Quantified Inventory (定量棚卸)
- **Count**: ページ内の全エンティティを数える。
- **List**: 認識したラベル（和名）を書き出す。

#### Step 3: Non-Species Element Analysis
- **Maps**: 分布図はあるか？
- **Charts**: 系統樹や比較表はあるか？
- **Icons**: 「昼行性」「絶滅危惧」などのアイコンはあるか？

### 2. Post-flight Validation
- **Count Match**: 抽出したJSONの要素数が棚卸数と一致しているか確認。
- **Self-Correction**: 一致しない場合は即座に修正。

**このプロトコルは、速度よりも「網羅性」を絶対的に優先する。**
