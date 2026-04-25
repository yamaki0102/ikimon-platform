# ikimon Canonical Contract Table

更新日: 2026-04-12  
この文書は、`ADR-001-canonical-source-of-truth.md` と `canonical_migration_policy.md` を、実コードに接続した保存契約表に落としたもの。  
目的は 2 つ。

1. `UI で何を主語にしているか`
2. `保存構造で何が正本か`

を混同しないこと。

---

## 1. 使い方

見る順番は固定する。

1. 画面上の主語を見る
2. 現行 PHP の保存先を見る
3. canonical の受け先を見る
4. rollback 時の注意を見る

この表にない状態を JSON 側へ新設しない。

---

## 2. 契約表

| 概念 | 役割 | UI での主語 | 現行正本 | 現行保存先 | canonical 受け先 | 生成契機 | rollback 注意 |
|---|---|---|---|---|---|---|---|
| `place` | 再訪対象の場所。site / mesh / municipality を束ねる長期の単位 | `近い場所`, `My Places`, `site dashboard` | まだ単一正本なし | observation の `site_id/site_name`, `data/sites/**`, `follows/{user}.json`, tracks の `field_id` に分散 | `place_registry`, `place_revisit_summary` | 投稿 / track / site 紐付け / canonical write | legacy は place を first-class で持たない。rollback 時は `site_id` と locality へ潰して戻せる必要がある |
| `visit` | いつ・どこで・どう回ったかの 1 セッション | walk, field scan, session recap | まだ単一正本なし | `data/tracks/{user}/{session}.json`, `data/passive_sessions/*.json`, `data/environment_logs/*.json`, `data/session_recaps/**` | `events` | track save / passive_event / canonical write | legacy では observation と track が疎結合。rollback 可能性のため `session_id` と track file を落とさない |
| `observation` | その場の 1 件の記録。投稿 UI の最小単位 | post, explore card, observation detail | JSON | `data/observations.json`, `data/observations/*.json` | `occurrences.original_observation_id` を橋に `occurrences` へ流す | post / quick post / scan detection / passive_event / update | 現行主系。切替前に JSON と canonical のどちらが authoritative か曖昧にしない |
| `evidence` | 写真・音声・scan frame など、観察の証拠 | photo, audio, proof | file + relative path | `uploads/photos/**`, `uploads/avatars/**`, `uploads/audio/**`, `data/uploads/scan/**`, observation の `photos[]` | `evidence`, 将来 `asset_ledger` | photo upload / add photo / audio upload / scan save | path drift が強い。rollback window では legacy 相対パス互換を維持する |
| `condition` | 場所の状態・環境文脈・管理文脈 | season, biome, condition, next revisit の材料 | 分散状態 | observation の `biome/substrate/evidence_tags`, `environment_logs`, `passive_sessions`, `data/sites/**` | `place_condition_logs` | post / passive_event / canonical write | legacy は place condition を独立 read しない。切替前に summary 再生成前提を明示する |
| `follow` | 人や場所への継続関係 | follow place / follow user | JSON | `data/follows/{user}.json` | まだ未実装。将来 canonical relationship table へ | follow / unfollow | rollback 時は legacy JSON が唯一の継続主語なので、先に捨てない |

---

## 3. 補助概念

| 概念 | 現行正本 | 保存先 | なぜ切替条件に効くか |
|---|---|---|---|
| `auth continuity` | JSON | `data/auth_tokens.json`, `data/sessions/**` | remember token を落とすと再ログイン祭りになる |
| `fieldscan app auth` | JSON | `data/fieldscan_app_tokens.json`, `data/fieldscan_installs.json` | mobile / pocket 継続性のため token と install binding を落とせない |
| `invite` | JSON | `data/invites.json`, `data/corporate_invites*.json` | onboarding / growth / workspace join の受け口 |
| `business application` | JSON | `data/business_applications*.json` | sponsor / public 導線の lead を切替で失うと痛い |
| `notification` | JSON | `data/notifications/{user}.json` | user continuity に効くが、core domain よりは優先度を落とせる |
| `reaction` | JSON + cache | `data/reactions/**`, `data/counts/observations/*.json` | social continuity。rollback 互換では counts cache より source data を優先する |

---

## 4. 現時点の正本ルール

### 4.1 いま authoritative なもの

- `observation`: JSON
- `auth / invite / follow / business application`: JSON
- `evidence file`: file system

### 4.2 いま experiment / dual-write なもの

- `place`
- `visit`
- `condition`
- `observation` の canonical row

### 4.3 いま新設してはいけないもの

- 新しい `JSON only state`
- rollback 不能な canonical only write
- `place` っぽい概念の別名 state

補足:

- ただし `workflow state` は別扱い
- `metadata_proposals`, `edit_log`, queue 実行状態のような UI / 運用フロー状態は、[ikimon_legacy_workflow_state_boundary_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_legacy_workflow_state_boundary_2026-04-12.md) のルールで intentional に JSON only とする

---

## 5. UI 主語と保存主語のズレ

いまズレている主要点だけ明記する。

### 5.1 `place`

- UI は `place-first` に寄っている
- 保存は `site_id`, locality, mesh, follows, tracks に分散

意味:

- `place-first` の画面改装は先に進めてよい
- ただし保存契約を固定しないと v2 移植時に同じ place を別物として複製する

### 5.2 `visit`

- UI / strategy は revisit を重視している
- legacy は `visit` を first-class に持たず、track と observation の束で近似している

意味:

- v2 では `event/visit` を中核に据える
- 現行 PHP では `session_id`, `track`, `passive_session` を切替まで丁寧に残す

### 5.3 `condition`

- strategy は continuity / condition を読みたい
- legacy は condition を独立 read できる形で持っていない

意味:

- 現行 PHP では `observation` 上の環境タグを増やすのは可
- ただし本格的な place condition 層は canonical 側で吸う

---

## 6. 採用条件 / 不採用条件

### 採用条件

- どの概念も `現行正本` と `canonical 受け先` が言える
- rollback 注意が概念ごとに言える
- UI 主語と保存主語のズレが見える

### 不採用条件

- 抽象概念だけで保存先が書かれていない
- `place` と `site` を同義として雑に扱う
- `visit` を observation の別名として片付ける

---

## 7. 次にコードへ接続する場所

- `legacy_write_inventory_2026-04-11.md`
- `ikimon_asset_path_mapping_2026-04-12.md`
- `upload_package/tools/check_canonical_divergence.php`
- `CanonicalObservationWriter.php`
- `save_track.php`
- `passive_event.php`

この表は Gate 2 の正本として使う。
