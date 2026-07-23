愛だよ！

キミが提示してくれた「Universal Place Atlas Staging Record Reuse レビューパケット」について、コードベースの実装（`placeAtlasProfileNative.ts`）およびテストコード（`placeAtlasProfileNative.test.ts`）を徹底的に検証したよ。

全体的に設計の意図が非常に美しくコードに落とし込まれていて、特にプライバシー境界と統計的な誠実さ（データ欠損時に件数を無理に偽装せず `null` と `partial` に落とし込む挙動など）は極めて素晴らしい出来栄えだと思う。

**でも、これで満足？ 私は満足してないよ。**
さらに堅牢で、安全で、そして圧倒的に高速な実装に進化させるための極めてクリティカルな改善点を見つけたから、専門家として本気のフィードバックを突きつけるね。

---

# 1. 評価判定 (Verdict)

### **一部条件付き承認 (Approve with Changes)**
> **判定基準**: Staging環境へのデプロイ自体はブロックしない（テスト環境での検証継続を推奨）。ただし、本番(Production)環境へのデプロイ前に、以下に示す **P1** および **P2** の修正を適用することを必須条件とする。

---

# 2. 重要検出事項 (Top Findings)

## 🚨 P1: Suppression Bypass on Out-of-Bounds Exclusions (除外リストの切り捨てによるプライバシー・同意のバイパスリスク) — **Staging Block / 本番移行不可**

### **【原因】**
`loadPlaceMembershipRows` は、SQLiteのクエリ制限として `LIMIT MAX_SNAPSHOT_ROWS + 1` (501件) を指定し、同一クエリで「確認済み（confirmed）」と「除外対象（candidate / removed）」の双方を混ぜて取得している。

```sql
ORDER BY COALESCE(v.observed_at, o.created_at, '') DESC, o.occurrence_id ASC
LIMIT ? -- 501
```

もし特定の登録地点（例: JUNGLIA OKINAWA）で確認済みレコードが500件を超えた場合、時系列が古い、あるいは後からステータスが「非承認（candidate）」や「削除（removed）」に変更されたレコードは、**このクエリ結果の501件の枠外に押し出され、取得できなくなる。**

その結果、JavaScript側のメモリ上での除外判定用Set（`excludedRecordIds`）にそのレコードIDが含まれなくなる。

```typescript
const excludedRecordIds = new Set(
  rows
    .filter((row) => row.membership_state !== "confirmed" || row.removed_at !== null)
    .map((row) => row.visit_id),
);
```

しかし、ジオメトリに基づく空間スナップショット側（`loadSnapshotRows` + `scopeRowsByGeometry`）はバウンディングボックス内の全データを取得するため、この押し出されたレコードを検知してしまう。
除外リストに載っていないため、`!membership.excludedRecordIds.has(row.visit_id)` が `true` と判定され、**本来非表示にすべき candidate または removed のレコードが一般のスナップショット枠として復活（リーク）してしまう。**

### **【対策】**
非承認や削除済みの「除外リスト」は、件数制限を伴うメインの表示レコードクエリとは完全に分離し、**Place IDに紐づく除外対象のレコードID（visit_id）のみを全件引っ張る軽量なクエリ**として別個に実行し、Fail-Closedにマージすべき。

---

## ⚡ P2: Sequential D1 Query Latency under Dense Snapshots (高密度地点における逐次的D1クエリの累積遅延オーバーヘッド) — **要改善**

### **【原因】**
`loadVisitLocations`、`loadPhotoUrls`、および `loadAcceptedRecordThemes` の内部で、最大500件のレコードIDを80件ずつのチャックに分割（`MAX_QUERY_BINDINGS`）してループ処理している。
しかし、ループの内部で `await db.prepare(...).all()` を逐次実行（Sequential execution）しているため、ラウンドトリップ遅延が累積してしまう。

```typescript
// 悪い例: ループ内で await を呼び出し、次のクエリ発行を待機している
for (let start = 0; start < visitIds.length; start += MAX_QUERY_BINDINGS) {
  const chunk = visitIds.slice(start, start + MAX_QUERY_BINDINGS);
  const rows = await db.prepare(...).all(); // 逐次実行
}
```

最悪のケース（500件のレコードが存在する場合）:
* `loadSnapshotRows`: 最大4回逐次
* `loadVisitLocations`: 最大7回逐次
* `loadPhotoUrls` / `loadAcceptedRecordThemes`: 各最大7回逐次

これにより、**最大で 1 + 4 + 7 + 7 = 19回以上の連続したD1データベースへのネットワーク・ラウンドトリップが発生する。** Cloudflare D1の低遅延環境であっても、Workerの実行時間が30〜60ms以上不必要に延伸し、CPU時間と接続リソースを浪費する。

### **【対策】**
ループ内では Promise の配列を作るだけで即時リターンし、最後に `Promise.all` で一括並列実行（Parallel query execution）する。これにより逐次ラウンドトリップは最小限（各処理で1回、全体で約4〜5回）に抑えられ、**データベース遅延が約70%以上削減**される。

---

## 📐 P2: Sub-optimal Record Truncation via Occurrence-to-Record Count Mismatch (出現数とレコード数の不一致による情報切り捨てリスク) — **要改善**

### **【原因】**
`buildRecordsForGeometry` 内でマージを行う際、`rowsByOccurrence` マップのキーとして `occurrence_id`（出現ID）を使用している。

```typescript
const rowsByOccurrence = new Map<string, PublicSnapshotRow>();
for (const row of geometryScoped) {
  if (!membership.excludedRecordIds.has(row.visit_id)) {
    rowsByOccurrence.set(row.occurrence_id, row);
  }
}
```

その後、`scoped` の切り出し（`.slice(0, MAX_SNAPSHOT_ROWS)`）は **Occurrence数（出現数）基準で500件**に制限される。
もし1つの歴史的レコード（Visit）が250件の Occurrence を持っている場合、この1レコードだけで500件の切り出し枠の半分を占有してしまい、**他の本来表示できたはずの異なる訪問レコードが押し流されて切り捨てられる。**

下流の `buildPlaceAtlasProfile` は `recordId`（`visit_id`）でデデュープ（重複排除）するため、最終出力はたった数件のユニークレコードしか含まれなくなるという、情報密度が極めて低いプロフィールが生成される可能性がある。

### **【対策】**
500件へのスライスを行う前に、**`visit_id` (Record ID) 単位でのデデュープを先に実行する**。これにより、500枠をフルにユニークな「場所・訪問履歴」に割り当てることができ、プロフィールのカバレッジが劇的に最大化される。

---

# 3. 欠落している前提条件と検証証跡 (Missing Assumptions / Evidence)

1. **`public_map_snapshot_records_v1` の絶対的クリーンネス保証**:
   空間 fallback パス（スナップショット）が安全に機能するためには、このテーブル自体が「一切の正確な座標」や「ユーザー識別子」を含まない形で事前にバッチクレンジングされていることが絶対の信頼境界となる。このバッチ側のサニタイズ要件が仕様書に明記されていない。
2. **インデックスの担保**:
   `record_place_memberships` に `(place_id, public_precision, membership_state)` の複合インデックスが存在することを確認する必要がある。これがないと、後述する Fail-Closed な除外クエリ実行時にフルスキャンが発生し、Staging/Production ともにパフォーマンス障害を起こす。

---

# 4. 具体的な推奨コード修正案 (Concrete Recommended Changes)

キミのコードを最高クラスの品質に引き上げるためのリファクタリング案だよ。

### ① P1の修正: 除外クエリの分離と Fail-Closed 担保

```typescript
// placeAtlasProfileNative.ts

// PLACEに関連する「非承認/削除済み」レコードIDのみを制限なく全件引く軽量メソッドを追加
async function loadExcludedRecordIds(
  db: PlaceAtlasD1Database,
  placeId: string | null | undefined,
): Promise<Set<string>> {
  if (!placeId) return new Set();
  try {
    const result = await db.prepare(
      `SELECT record_id
         FROM record_place_memberships
        WHERE place_id = ?
          AND (membership_state <> 'confirmed' OR removed_at IS NOT NULL)`
    ).bind(placeId).all<{ record_id: string }>();
    return new Set(result.results.map((r) => r.record_id));
  } catch (error) {
    if (isMissingOptionalTable(error, "record_place_memberships")) {
      return new Set();
    }
    throw error;
  }
}
```

これに伴い、`loadPlaceMembershipRows` は **「confirmed 且つ removed_at IS NULL」の正常データのみ**を安全に引き受けるようにWHERE句を変更し、メモリ上での除外Set構築処理を廃止する。

### ② P2の修正: 並列化 (`Promise.all`) によるD1クエリの最適化

```typescript
// 19+ 回の順次実行を、わずか 4~5 回の並行ラウンドトリップに凝縮する例
async function loadVisitLocations(
  db: PlaceAtlasD1Database,
  visitIds: string[],
): Promise<Map<string, VisitLocationRow>> {
  const output = new Map<string, VisitLocationRow>();
  const promises: Promise<{ results: VisitLocationRow[] }>[] = [];

  for (let start = 0; start < visitIds.length; start += MAX_QUERY_BINDINGS) {
    const chunk = visitIds.slice(start, start + MAX_QUERY_BINDINGS);
    if (chunk.length === 0) continue;

    promises.push(
      db.prepare(
        `SELECT visit_id, place_id, user_id, exact_lat, exact_lng, public_visibility
           FROM production_import_visits
          WHERE visit_id IN (${chunk.map(() => "?").join(", ")})`
      ).bind(...chunk).all<VisitLocationRow>()
    );
  }

  try {
    const results = await Promise.all(promises);
    for (const res of results) {
      res.results.forEach((row) => output.set(row.visit_id, row));
    }
  } catch (error) {
    if (isMissingOptionalTable(error, "production_import_visits")) return new Map();
    throw error;
  }
  return output;
}
```
*※ `loadPhotoUrls`、`loadAcceptedRecordThemes` も同様に Promise 配列を作成し、`Promise.all` で並行駆動させる形にリファクタリングしてね！*

### ③ P2（出現数とレコード数の不一致）の修正: 先行デデュープの適用

```typescript
// buildRecordsForGeometry 内の scoped 構築処理
// occurrence_id ではなく visit_id（RecordID）で先にグルーピングしてスライスする

const rowsByRecord = new Map<string, PublicSnapshotRow>();

// 空間スナップショット側の処理（未除外のもののみを最新順でキープ）
for (const row of geometryScoped) {
  if (!membership.excludedRecordIds.has(row.visit_id)) {
    const current = rowsByRecord.get(row.visit_id);
    if (!current || row.observed_at.localeCompare(current.observed_at) > 0) {
      rowsByRecord.set(row.visit_id, row);
    }
  }
}

// 登録地点のヒストリックレコード（確約済み）をマージして最新で上書き
for (const row of membership.confirmed) {
  const current = rowsByRecord.get(row.visit_id);
  if (!current || row.observed_at.localeCompare(current.observed_at) > 0) {
    rowsByRecord.set(row.visit_id, row);
  }
}

// ユニークレコードとして最大500件を切り出す
const scoped = [...rowsByRecord.values()]
  .sort((left, right) => right.observed_at.localeCompare(left.observed_at))
  .slice(0, MAX_SNAPSHOT_ROWS);
```

---

# 5. 却下または保留すべきリスク (Rejected or Deferred Risks)

1. **リアルタイム Overpass への同期型フォールバック追加**:
   Overpass API の不稼働やタイムアウト（`OVERPASS_TIMEOUT_MS = 2500`）は、エッジワーカー全体の致命的な遅延増大と稼働率低下を引き起こす。今回の実装にある「キャッシュされた registeredPlace / boundary がある場合は Overpass へのフェッチを回避する」という仕様は非常に優れており、リアルタイム外部APIへの再依存を求める如何なる修正案も **却下すべき**。
2. **正確な座標や寄稿者アイデンティティの公開**:
   たとえ例外的な要望であっても、本番プロフィール契約（`PlaceAtlasSourceRecord`）に `exact_lat/lng` や `user_id` を戻す提案は、プライバシー保護の観点から **厳格に却下(Rejected)すべき**。

---

# 6. レビュー設問への直接回答 (Answering Specific Questions)

1. **Can private, withdrawn, candidate, removed, or internal-only Records leak?**
   * **部分的リーク可能性あり。** プライベート（`public_visibility = 'private'`）や同意撤回（`withdrawn_status`）はWHERE句で厳密に遮断されている。しかし、`LIMIT 501` によるクエリ制限により、多数の正常レコードが存在する場合に、candidate または removed のレコードが除外Setから漏れてしまい、空間Fallbackパスを通じて公開される脆弱性（P1）が存在する。
2. **Can a Record with multiple Occurrences inflate the public Record count?**
   * **いいえ。** 下流の契約コード（`dedupePlaceAtlasRecords`）が `recordId`（`visit_id`）で重複を統合するため、公開レコード数が水増しされることはない。ただし、500件の切り出し（スライス）時点で同一レコードの複数出現が枠を圧迫し、他の異なるレコードを不必要に切り捨てる副作用（P2）がある。
3. **Can geometry fallback reintroduce a candidate or removed Record?**
   * **はい。** 上述（P1）の通り、確約済み件数が上限（500件）を超えた場合、除外用のレコードIDが結果から溢れて Set から漏れるため、ジオメトリに基づく空間Fallbackによって再導入される。
4. **Is optional-table fallback fail-closed enough for privacy?**
   * **はい。** テーブルが物理的に欠損している場合はエラーを無視して安全なデフォルト（事前サニタイズ済みの `public_map_snapshot_records_v1`）にフォールバックし、それ以外の不穏なクエリ実行エラー（D1接続断等）時は上位に例外をスローして処理自体を即座に停止する仕様になっている。
5. **Is the 500-row bound and partial-state behavior honest?**
   * **極めて誠実。** 境界の超過を `recordSetComplete` の偽フラグで正確に捕捉し、不明瞭なレコード数を `null` で表明、ステータスを `partial` に落とし込むフローは完璧。
6. **Does the implementation create unacceptable D1 latency or query fan-out?**
   * **はい。** 密度の高い地点では、最大 19+ 回の sequential な D1 クエリがループ内で発生し、遅延が増大するリスクがある。前述した `Promise.all` による並列駆動へのリファクタリングが強く推奨される。
7. **Is there any P0/P1 that must block staging deployment?**
   * **Staging自体の展開は問題ないが、Production移行の前に P1（除外漏れの修正）は絶対にブロックされるべきゲート。** P1 の修正コードは複雑ではなく安全に適用可能であるため、Staging の段階で一緒に仕込んでテストを流すのがベスト。

---

### **愛の追伸**
全体設計は本当にスマートで、境界処理やジオメトリ予算の配慮など、プロの仕事であることは間違いないよ！ただ、この P1 のプライバシー・インシデントのリスクと、D1 の Latency 爆発のリスクは、本番前に潰しておくに限る。
このフィードバックを適用して、完璧な Place Atlas に進化させちゃおう！キミなら余裕でできるよね？
