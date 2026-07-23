# Universal Place Atlas 過去Record再利用 Wレビュー採否

## 対象

- Repository: `yamaki0102/ikimon-platform`
- 対象SHA: `02d77f558c39452dd69b676578b3cc36758cae2a`
- Claude: `claude-opus-4-8`
  - wrapper初回rawはツール呼出し要求のみで実質レビューではないため不採用
  - 再試行raw: `claude-review-r2.md`
- Gemini: `gemini-3.5-flash`
  - raw: `gemini-review.md`
- 判定: stagingを止める未解消P0/P1は0

## 採用

1. 旧importの同定状態を一律confirmedにしない。
   `quality_grade = ai_judgement`だけを`ai_candidate`、`verified`または
   `research_grade`だけをconfirmed、それ以外を
   `awaiting_identification`へ分離した。
2. rights撤回後に古いpublic snapshotからRecordが再混入しないよう、
   membership経路とgeometry-only経路の双方へlive rights gateを追加した。
3. rights/source visitテーブル欠損時、geometry経路は0件へfail-closedする。
4. query-planとRecord/visitカーディナリティをstaging実DBで確認した。

## 解消済み・条件付き指摘の判定

- Recordとvisitの1:1:
  `record_place_memberships.record_id`は
  `production_import_visits.visit_id`をRecord IDとして参照する契約であり、
  Occurrenceは同じvisitへ多対一。stagingではmembership 85件中
  source visit欠損0件、1,332 Occurrence中visit欠損0件だった。
- 5,000件除外上限:
  実装は`MAX_EXCLUDED_MEMBERSHIP_RECORDS + 1`、すなわち5,001件を読み、
  超過時はgeometry全体を抑止して`partial`にする。オフバイワンはない。
- media:
  profileのimport経路は初期`photo_url = NULL`。共有resolverは
  `processing_state = uploaded`、public derivative検証済み、
  metadata有り、SVG除外、EXIF scrub済み、public-ready、画像MIMEを
  すべて満たす`asset_ledger`行だけを返す。
- public precision:
  所属判定は内部位置で行うが、公開Record契約は正確座標とuser IDを持たず、
  membership経路は`public_precision = place`を必須にする。
  geometry-only経路も公開APIへ座標を投影しない。
- partial:
  snapshot、membership、exclusion、mergeのいずれかが不完全なら
  `publication.status = partial`かつ`summary.recordCount = null`。
  overflowテストで固定済み。
- D1性能:
  Place、visit PK、rights PK、Occurrence visit indexが利用された。
  canaryのEXPLAIN計測はmembership 0.330ms、exclusion 0.288ms。

## 採用しない指摘

- `public_visibility = public`から`public_summary` rights envelopeを作ることを
  無同意の新規外部利用とする解釈は採用しない。
  Place Atlasは既存の公開Recordを同じIKIMON公開面でRecord概要として
  再整理する機能であり、公開範囲をexternal export、research、enterprise、
  dataset、mediaへ拡張しない。migrationは既存の明示rightsを上書きせず、
  根拠と「export同意を推定していない」ことをprovenanceへ残す。
  production反映は別途、中央の明示承認ゲートで停止する。
- Occurrence単位rightsをread pathへ追加する提案は採用しない。
  現行正本は`observation_data_rights.visit_id PRIMARY KEY`の
  Record/visit単位契約であり、ad hocなOccurrence権利を推測しない。

## 保留

- 5,000件近傍の実Placeはstagingに存在しないため、同規模データでのp95は
  未計測。上限超過時は開示せずpartialへ倒れるため、stagingの
  privacy blockerにはしない。production運用監視で継続する。
- 実iOS端末は利用不可。WebKit QAと手動実機チェックリストで代替し、
  `READY_100`は名乗らない。
