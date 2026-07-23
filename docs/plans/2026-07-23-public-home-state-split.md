# Public home state split implementation plan

## ゴール

ログイン前を価値理解と最初の記録、ログイン後を気軽な記録と返ってきた発見のホームへ分離し、NodeとCloudflareの実配信面を同じ契約へ揃える。

## 完了条件

- [x] runtime、セッション、read model、route、既存/未実装機能を監査
- [x] `state-split-v1` HTML契約と4ロケールcopyを実装
- [x] 所有record、発見、公開recordの重複排除を実装
- [x] 写真、動画、音声、メモの静的カードを実装
- [x] CloudflareのD1注入と旧presentation patchを同期
- [x] HTML契約、Worker契約、320〜1280px E2Eを追加
- [ ] full test、staging dry-run、staging deploy
- [ ] stagingでログイン前後Visual QA、a11y/privacy/performance計測
- [ ] commit、push、PR

## 記録先

- 仕様: `docs/spec/public-home-state-split.md`
- 決定: `docs/architecture/public-home-state-split-decision-20260723.md`
- 完了ゲート: `docs/operations/public-home-ux-completion-gate.md`
- QA証跡: `E:\Projects\_agent_scratch\ikimon-platform\public-home-ux-20260723\`
