/**
 * 観察記録の作成・削除（非表示化）を、各所の in-memory snapshot cache に即時反映する
 * ための軽量レジストリ。各キャッシュ保持側が clear 関数を登録し、書き込み系
 * ルートが invalidateUserVisibleSnapshots() を呼ぶ。
 *
 * TTL はフォールバックとして残る（登録漏れがあっても従来どおり期限切れで直る）。
 */

type SnapshotInvalidator = () => void;

const invalidators = new Set<SnapshotInvalidator>();

export function registerSnapshotInvalidator(invalidator: SnapshotInvalidator): void {
  invalidators.add(invalidator);
}

export function invalidateUserVisibleSnapshots(): void {
  for (const invalidator of invalidators) {
    try {
      invalidator();
    } catch {
      // キャッシュ削除の失敗で書き込み応答を壊さない
    }
  }
}
