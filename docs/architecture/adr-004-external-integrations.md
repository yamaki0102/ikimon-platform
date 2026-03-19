# ADR-004: 外部連携方針

**ステータス**: 承認
**日付**: 2026-03-19
**影響範囲**: 外部サービス統合全般

## 原則

全外部サービスは **replaceable context adapter** として扱う。ikimon の正本・意味論・識別子体系の外に置くこと。

## 外部連携マップ

### VIRTUAL SHIZUOKA（優先度: 高）

静岡県の県土全域 3D 点群データ。Eagle でゼロから広域基盤を作る必要がない。

**用途**:
- 広域基盤として優先利用（県土レベルの地形・建物・植生）
- Eagle は microhabitat / canopy-understory / 更新差分の高精細補完
- 静岡での PoC は「VIRTUAL SHIZUOKA + ikimon 観測 + 衛星時系列」の統合

**方針**:
- VIRTUAL SHIZUOKA のデータを ikimon の正本にしない（参照リンクとして保持）
- 独自の observation event は ikimon 側で管理
- 点群の座標系は VIRTUAL SHIZUOKA に合わせて変換

### Google Earth Engine（優先度: 中）

地球観測ラスタ・時系列解析の文脈追加。

**用途**:
- NDVI / EVI（植生指標）
- 水域変化
- 地表面温度
- 土地被覆変化
- 火災 / 洪水 / 裸地変化
- 季節変動の衛星指標

**方針**:
- context layer として扱う（ikimon の system of record にしない）
- site / month / season 単位で集約値を取り込む
- raw user observation を GEE に依存させない
- GEE 側でしか再現できない分析結果を唯一の成果物にしない

### Google Earth / KML / KMZ（優先度: 中）

軽量な共有・合意形成・プレゼン用途。

**用途**:
- 研究者/自治体向けレビュー
- 現地点検ルートの共有
- 種分布の簡易可視化
- before / after 比較

**方針**:
- KML/KMZ export を提供する
- raw point cloud 正本や内部精度モデルは KML に寄せない
- KML は共有フォーマットであり、保存正本ではない

### Cesium / 3D Tiles（優先度: 将来）

3D 空間の Web 配信。

**用途**:
- Eagle の点群 → 3D Tiles 変換 → ブラウザ表示
- 生物検出ポイントのオーバーレイ
- 時間スライダーで季節変動表示

**方針**:
- 3D Tiles (OGC 標準) を配信フォーマットとして採用
- Cesium ion は便利だが、ベンダーロックインに注意
- セルフホスト可能な構成を維持

### Google Maps Platform / Photorealistic 3D Tiles

**方針**: 背景基盤としては有用だが、プロダクトの基幹依存にしない。ライセンス・コスト・長期可搬性の問題があるため。

## adapter パターン

```php
// 全外部サービスは adapter 経由でアクセス
interface ExternalDataAdapter {
    public function fetch(string $areaId, array $params): array;
    public function getSource(): string;
    public function isAvailable(): bool;
}

class VirtualShizuokaAdapter implements ExternalDataAdapter { ... }
class EarthEngineAdapter implements ExternalDataAdapter { ... }
class CesiumAdapter implements ExternalDataAdapter { ... }
```

外部サービスが停止しても、ikimon の正本データと日常 UX は影響を受けない構造にすること。
