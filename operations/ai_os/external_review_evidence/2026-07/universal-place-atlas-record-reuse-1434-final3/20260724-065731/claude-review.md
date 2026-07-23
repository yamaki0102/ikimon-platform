以下、パケット記載の設計・不変条件・証跡に基づくレビューです（対象 SHA `efb0fef3`）。コードは開かずパケット本文を根拠に評価し、コード/スキーマ側で検証が必須の箇所は明示します。

## 1. 採用すべき点（保持すべき設計判断）

- 包含クエリの多重ゲート（`place_id`一致 / `public_precision='place'` / `public_visibility='public'` / `membership_state='confirmed'` / `removed_at IS NULL` / 取消権利行なし / 正の`public_summary|external_export`権利必須）は正しく fail-closed。
- 除外クエリで geometry フォールバックをライブの権利・visit と突き合わせる方式は、スナップショット再生成前の権利取消レースを（メンバーシップを持つ Record に限れば）閉じている。
- 権利/visit テーブル欠損時に「除外集合=不完全 ⇒ geometry 抑止」は正しい fail-closed。
- `quality_grade` を `research_grade|verified` のみ confirmed とし、`ai_judgement`・空グレードを全て `ai_candidate` に倒すのは妥当。
- `recordId` による二段デデュープで多重 Occurrence が公開 Record 数を膨らませない設計は正しい。

## 2. 重大な懸念

**核心は「Record ↔ visit の対応が本当に 1:1 か」**です。パケットの権利モデル全体が `observation_data_rights.visit_id TEXT PRIMARY KEY`＝「Record/visit スコープ」という前提に依存し、これを根拠に Occurrence 単位取消の懸念を却下しています。しかし読み取り経路は `production_import_visits` と `production_import_occurrences` の両方を消費しており、**1 Record が複数 visit の Occurrence を集約し得るか**がパケット内で証明されていません。もし複数 visit を跨ぐ Record が存在すると、包含/除外が結合する「source visit」1 行の権利しか見ず、別 visit の取消・権利欠如を検出できず**漏洩**します。visit_id が PK であること自体は「Record が単一 visit である」ことを保証しません。

その他、race が閉じるのは「メンバーシップ行を持つ Record」に限られる点、移行 0069 が旧 `public_visibility='public'` フラグから `public_summary` 同意を遡及生成している点が、主張ほど網羅的/無害ではありません。

## 3. P0 で変更すべき仕様（staging ブロック要因）

- **P0-1 Record↔visit カーディナリティの証明または per-visit 化**：`record_place_memberships`／`production_import_occurrences` のスキーマ上、1 Record = 1 visit_id が強制されている証跡（一意制約 or バックフィル不変条件）を提示すること。強制されていない場合、包含・除外・アセットの権利/取消判定を Record 内の**全 visit を網羅**する形（`NOT EXISTS(withdrawn) AND NOT EXISTS(rights欠如)` を Record 配下の全 visit に対して）へ変更するまで staging をブロック。証跡で 1:1 が確定すれば本項は解消。

（上記が唯一の無条件 P0 候補です。ここが 1:1 で確定していれば P0 は残りません。）

## 4. P1 以降に回すべき仕様

- **P1-1（race 主張の限定）**：除外クエリはメンバーシップ由来の Record しか列挙しないため、メンバーシップ行を持たない geometry-only 公開 Record では取消レースが依然開いている。「全公開 geometry Record がメンバーシップ行を持つ」ことを検証するか、geometry-only Record も visit 権利結合で読み取り時判定に含めること。「race を閉じた」の文言はこの限定を明記して修正。
- **P1-2（同意の遡及生成）**：移行 0069 は旧公開フラグを `public_summary` 権利へ遡及変換する。Place Atlas 集約公開が当該レガシー import の同意範囲に含まれることを ToS/同意履歴で確認し、バックアウト経路とオプトアウトを用意（既存明示行が勝つ緩和はあるが不十分）。
- **P1-3（D1 レイテンシ）**：1 プロファイル読取で membership(≤501) + exclusion(≤5000, 権利/visit 結合) + geometry + asset サブクエリ + visits/occurrences/media/theme とファンアウトが増大。カバリングインデックス（`record_place_memberships(place_id, membership_state, removed_at)`、`observation_data_rights(visit_id)`、occurrences の record/visit）と p95 実測、除外集合のキャッシュ検討を条件に。現状 D1 レイテンシ影響は未定量。

## 5. P2

- 500 Record 上限での**切り詰め時に partial=true を立てているか**、および confirmed > candidate/geometry の順序で truncate しているかを明示（テストは 5000 除外オーバーフローと merge オーバーフローのみに言及）。
- アセットが visit_id 単独キーのため、Record が複数 visit を跨ぐ場合に他 visit のアセットが黙って欠落（漏洩ではないが完全性低下）。意図的として文書化。

## 7 問への回答

1. 漏洩：単一 visit Record では**否**。複数 visit Record が存在し得る場合は**未証明＝条件付き可**（P0-1）。
2. 多重 Occurrence の水増し：**否**（recordId 二段デデュープ、Occurrence→Record 対応が正しい前提）。
3. geometry による candidate/removed 再導入：メンバーシップ保有 Record は**否**、geometry-only Record に残余リスク（P1-1）。
4. optional-table フォールバックの fail-closed：**十分**（欠損⇒除外不完全⇒geometry 抑止）。
5. 500 上限と partial の正直さ：**概ね正直**、500 上限ヒット時の partial 反映と truncate 順序を要確認（P2）。
6. D1 レイテンシ/ファンアウト：**懸念あり・未定量**。インデックスと p95 の証跡が必要（P1-3）。
7. staging を止める P0/P1：**あり（条件付き）**＝ P0-1 の Record↔visit 1:1 証明。

## 最終推奨

**Staging ブロック：YES（条件付き）。** ブロック解除条件は P0-1 の解消のみ、すなわち「1 Record = 1 visit_id」がスキーマ制約またはバックフィル不変条件で証明されること（あるいは権利/取消判定を Record 配下全 visit 網羅に変更）。これが既に 1:1 で確定しているなら P0 は消え、**ブロック不要**とし、P1-1〜P1-3 を staging 後の必須フォローアップとして進めて差し支えありません。

なお本レビューは提示スキーマ事実を前提としており、P0-1 の 1:1 保証だけはパケット内に証跡がないため、コード/マイグレーション側での確認が必要です。確認が取れれば当該判定を更新できます。
