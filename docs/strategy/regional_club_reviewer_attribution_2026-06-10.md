# Regional Club Reviewer Attribution

更新日: 2026-06-10

目的:

- ピッチで提示された `観察 -> 根拠ある同定 -> 地域データ -> クラブ運営` を、実装前に設計判断へ落とす。
- reviewer 供給をボランティア依存から、地域クラブ運営費へ戻せる work unit として扱う。
- `specialist` 個人 role、`fieldManagers`、`observation events` に無理に混ぜて、あとから対価設計できない状態を避ける。

正本:

- `docs/strategy/north_star_charter_2026.md`
- `docs/strategy/v3.8/ikimon_life_strategy_2026Q1.md` section 16.2.1

---

## 1. Existing Model

| Existing table / service | 使えること | 足りないこと |
|---|---|---|
| `programs` / `memberships` | club / school / campaign 風の参加単位を薄く表現できる | 同定作業の credit / payment attribution がない |
| `specialist_authorities` | 個人の分類群 authority と根拠を持てる | 組織として何件処理したかは出ない |
| `specialistReview` | occurrence への approve / reject / note を記録できる | start / submit / time spent / evidence refs / club credit が弱い |
| `identificationConsensus` | 合意形成に使える | club 単位の throughput 集計がない |
| `field_managers` | field の owner / steward / exact viewer 権限を管理できる | 経済循環や同定 credit の単位ではない |
| `observation_events` | 観察会と参加導線を表現できる | review work attribution とは責務が違う |

結論:

- `field_managers` へ club を吸収しない。これは field access / stewardship の権限であり、review credit ではない。
- `specialist_authorities` へ組織 credit を混ぜない。これは個人の能力・権限であり、club 運営費の集計単位ではない。
- v0 は `programs(program_type='regional_club')` を club の器として使い、review attribution は別 ledger で持つのが一番小さい。

---

## 2. Recommended v0 Design

推奨:

1. club entity は新規巨大設計にせず、既存 `programs` を使う。
2. `programs.program_type = 'regional_club'` を club / organization の最小単位にする。
3. `memberships.membership_role` で `organizer`, `reviewer`, `mentor`, `participant` を表現する。
4. review 作業の credit は、専用の thin ledger を後続 migration で足す。

想定 ledger:

```sql
CREATE TABLE review_attributions (
    review_attribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL,
    identification_id UUID,
    actor_user_id TEXT NOT NULL,
    program_id UUID REFERENCES programs(program_id) ON DELETE SET NULL,
    attribution_kind TEXT NOT NULL,
    decision TEXT NOT NULL,
    evidence_ref_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

`attribution_kind`:

- `individual_review`
- `club_review`
- `mentor_supervised_review`
- `monitoring_contract_review`

最低限 source payload に残すもの:

- 根拠資料の種類と参照先
- confidence / uncertainty
- 差し戻し理由
- reviewer が club credit に入れるか
- monitoring 契約や event との関連があればその id

---

## 3. Why Not These Options

`field_managers` へ入れる:

- 不採用。field の閲覧・管理権限と review work credit が混ざる。
- 自然共生サイトの owner / steward と、はままつネイチャークラブの同定作業者は重なることがあっても同じ概念ではない。

`specialist_authorities` へ club_id を足す:

- 不採用。authority は個人の分類群スコープ。
- 組織 credit を authority へ混ぜると、退会、監修、共同作業、mentor supervised review が扱いづらい。

`observation_events` だけで処理する:

- 不採用。観察会は参加と記録の場。
- 後日レビュー、複数クラブ、企業 monitoring review、難例差し戻しが event だけでは集計できない。

---

## 4. Metrics Contract

P1 で見えるべき集計:

- club の根拠付き同定件数/月
- reviewer 1人あたり処理件数/月
- median minutes per review
- evidence_ref_count distribution
- approve / reject / needs_more_evidence rate
- club review credit by monitoring contract
- mentor supervised review count

KPI へ接続する event metadata:

- `place_id`
- `program_id`
- `visit_type = club_review | monitoring_review`
- `actor_lens = specialist | organizer`
- `source_surface = review`

---

## 5. Implementation Gate

実装に入ってよい条件:

1. `programs` を club entity として使うか、新しい `organizations` を作るかを決める。
2. review attribution ledger の対象を `occurrence`, `identification`, `specialist_review source_payload` のどこに結びつけるか決める。
3. club credit を支払い・協賛・運営費に使う場合の表示名、監査ログ、取消しルールを決める。
4. 子ども・学生が関わる review は mentor supervised とし、強い public claim へ直結させない。

最初の実装は UI ではなく ledger と集計から始める。クラブモデルの価値は「参加画面」ではなく、根拠付き同定が地域データと運営費へ戻ることにある。

