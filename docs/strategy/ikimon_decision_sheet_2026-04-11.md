# ikimon.life 意思決定シート

更新日: 2026-04-11

参照正本:

- `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`

この文書は、当面の意思決定サマリーとして使う。

---

## 1. 最上位の正体

ikimon の最上位の正体は、`自然観察アプリ` でも `地域探求OS` でも終わらない。

**`Place Intelligence OS`**

と定義する。

意味:

- 出発点は `地元の人が、自分の場所を見続けること`
- そこから `地域`, `地球`, 将来的には `他の星` にまで拡張可能な
  `場所知性のインフラ` を目指す

ただし、最初の wedge は大きくしすぎない。

当面の実装主語:

- `地元の人が、いつもの場所を見守るための place-first product`

---

## 2. いちばん重要な主役

最初に最適化する相手は:

- `地元の人`

理由:

- 最も再訪しやすい
- 定点性がある
- place continuity を作れる
- traveler, student, sponsor の基盤になる

二次アクター:

- traveler
- student / teacher
- sponsor
- municipality

---

## 3. 探求授業の位置づけ

- `中心機能ではない`
- `主要ケースとして想定する`

設計ルール:

- inquiry 専用UIを product core にしない
- ただし `question / hypothesis / protocol / reflection` を後付けできるようにする
- school / inquiry は `place-first core` の上に乗る use case として扱う

---

## 4. 企業向けの位置づけ

- `必要十分`
- 主役にしない
- sponsor / place provider / regional partner として扱う

設計ルール:

- 企業向け copy が公開面を支配しない
- wellness-only で売らない
- `拠点`, `地域接点`, `自然共生活動`, `説明責任` を支える層として設計する

---

## 5. 同定の方針

`正しい種名が常に最上位` という設計は取らない。

代わりに、将来的に意味が残る粒度で積む。

### 記録レベル

1. `casual`
   - species 不明でも可
   - species group, native/exotic, unknown を許す

2. `place evidence`
   - photo / date / place / confidence がある
   - site change を読むのに使える

3. `application ready`
   - 自然共生サイト等の申請でポジティブに使えるレベル
   - 証拠と review trail がある

### 目標

- 初期は `application ready な positive list を将来作れるデータ基盤` を目指す
- casual data は捨てずに残し、後で再評価できるようにする

---

## 6. KPI の決定

地方創生の成果は 1 個では足りない。

### North Star

`月内に、地元ユーザーによる再訪記録が2回以上成立した active places 数`

理由:

- 地元主役
- place continuity
- long-term monitoring
- 地域OS

を同時に表す。

### Product KPI

- first visit completion rate
- 30日以内 revisit rate
- place follow rate

### Observatory KPI

- seasonality coverage
- effort completion
- confidence captured rate
- application-ready evidence count

### Regional KPI

- repeat visitor rate
- relationship population conversion
- local partner participation

### Sponsor KPI

- active sponsored places
- participation spread

---

## 7. いまの絶対ルール

1. 主語は `place`
2. 最初の主役は `地元の人`
3. traveler は広がりを作る補助センサー
4. 探求授業は core ではなく重要 use case
5. 企業は必要十分な sponsor
6. 同定は `将来意味が残るデータ` を優先
7. 目標は `active places` を増やすこと

---

## 8. 今後の文書ルール

次からの正本は 2 本だけにする。

- `docs/strategy/ikimon_decision_sheet_2026-04-11.md`
- `docs/strategy/ikimon_place_first_regional_os_execution_plan_2026-04-11.md`

それ以外は補助資料として扱う。
