# ikimon v2 Release QA Matrix

更新日: 2026-04-13

## 1. 目的

release 前に必要なのは、`何となく触る` ことではない。  
`全ページを遷移込みで MECE に確認できる状態` を作ることだ。

この文書の役割は 3 つだけ。

1. `何を確認したら release してよいか` を固定する
2. `ページ単体確認` と `遷移確認` を分ける
3. `人手 QA` と `自動 smoke` を混ぜずに並べる

---

## 2. QA の切り方

release QA は次の 5 軸で切る。

1. `Surface`
2. `State`
3. `Transition`
4. `Failure mode`
5. `Environment`

この 5 軸を混ぜない。

---

## 3. Surface

### 3.1 Public surface

- `/`
- `/explore`
- `/about`
- `/for-business`
- `/for-business/apply`

### 3.2 Authenticated surface

- `/home`
- `/record`
- `/observations/:id`
- `/profile/:userId`
- `/profile`

### 3.3 System / ops surface

- `/healthz`
- `/readyz`
- `/ops/readiness`

---

## 4. State

各 surface は状態を分けて確認する。

### 4.1 Guest

- 未ログイン
- session cookie なし
- query userId なし

### 4.2 Demo

- sample fixture user あり
- sample fixture observation あり
- staging preview root から遷移

### 4.3 Authenticated

- session issue 済み
- `/profile`, `/home`, `/record` が cookie で開く

### 4.4 Data-rich

- photo あり
- identification あり
- revisit candidate あり

### 4.5 Empty / sparse

- 観察なし
- place なし
- identification なし

---

## 5. Transition

release 前に最小で通すべき遷移はこれ。

### T1. Demo core loop

- `/v2/`
- `Record`
- `Observation Detail`
- `Profile`
- `Explore`

### T2. Logged-in core loop

- `session issue`
- `/home`
- `/record`
- `submit observation`
- `/observations/:id`
- `/profile`

### T3. Capture loop

- `/record`
- `observation upsert`
- `photo upload`
- `detail open`

### T4. Revisit loop

- `/home`
- `my places / revisit entry`
- `/profile/:userId`
- `detail`
- `record again`

### T5. Public read loop

- `/`
- `/explore`
- `observation detail`

### T6. Ops loop

- `/healthz`
- `/readyz`
- `/ops/readiness`

---

## 6. Failure Mode

正常系だけで release しない。

### F1. Routing failure

- 404
- wrong prefix
- `/v2` 配下で絶対パスが壊れる

### F2. Auth failure

- session missing
- session expired
- logout 後アクセス

### F3. Write failure

- observation upsert fail
- photo upload fail
- track upload fail

### F4. Data failure

- missing observation
- missing profile
- empty list

### F5. Infra failure

- healthz / readyz fail
- readiness unhealthy
- uploads alias broken

---

## 7. Environment

### E1. Internal lane

- `http://127.0.0.1:3200`
- smoke / script 用

### E2. Staging edge

- `https://staging.162-43-44-131.sslip.io/v2/`
- nginx / TLS / basic auth / forwarded prefix を含む

### E3. Production edge rehearsal

- `https://ikimon.life/`
- live switch 中の public smoke

---

## 8. 自動確認

自動化の役割は `壊れていないことの下限保証`。

### A1. Internal smoke

- `smoke:v2-lane`
- `smoke:v2-read-lane`
- `smoke:v2-write-lane`

### A2. Cadence

- `run_v2_sample_cadence.sh`
- staging hourly

### A3. Shadow health

- `run_production_shadow_cycle.sh`
- `verify:production-shadow`
- `report:legacy-drift`

### A4. Cutover ops

- `snapshot_cutover_state.sh`
- `switch_public_nginx_to_v2.sh --dry-run`
- `rollback_public_nginx_to_legacy.sh`
- `run_day0_public_smoke.sh`

---

## 9. 人手確認

人手確認の役割は `画面として成立しているか` と `遷移が迷わないか`。

### H1. Demo root

- `/v2/` で demo 導線が見える
- `Record / Home / Observation Detail / Profile / Explore` が sample fixture 付きで踏める

### H2. Core pages

- `record`
- `home`
- `observation detail`
- `profile`
- `explore`

### H3. Key transitions

- `Record -> Detail`
- `Detail -> Profile`
- `Profile -> Home`
- `Home -> Explore`

### H4. UX red flags

- 404
- prefix mismatch
- CTA dead end
- cookie 依存で詰む
- mobile で壊れる

---

## 10. Release Gate

release 前に必要な最小条件はこれ。

1. `A1-A4` が green
2. `H1-H4` が pass
3. staging edge で `T1-T6` が通る
4. production rehearsal で `T2`, `T3`, `T6` が通る
5. rollback が数分で完了できる

1つでも落ちたら release しない。

---

## 11. 実行順

### Step 1. Staging internal

- `A1`
- `A2`

### Step 2. Staging edge

- `H1`
- `H2`
- `H3`
- `F1-F5` の取りこぼし確認

### Step 3. Rehearsal

- `A4`
- production edge で `T2`, `T3`, `T6`

### Step 4. Release decision

- 全 pass なら `live cutover approval`
- 1 fail でも `HOLD`

---

## 12. いまの位置づけ

2026-04-13 時点では、

- internal smoke はある
- staging edge preview はある
- production shadow は healthy
- rollback dry-run はある

まだ未完なのは、`この matrix に沿った人手確認結果を 1 枚に残すこと`。  
つまり、次にやるべき本筋は `MECE release audit の実行` であって、機能追加ではない。
