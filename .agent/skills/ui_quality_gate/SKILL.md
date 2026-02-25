---
name: UI Quality Gate (ikimon override)
description: ikimon.life 固有の設定上書き。共通スキルは .agent/skills/ui_quality_gate/SKILL.md を参照。
---

# UI Quality Gate — ikimon.life 固有設定

> **共通スキル**: `.agent/skills/ui_quality_gate/SKILL.md` が正規版  
> このファイルはikimon固有の上書き設定のみを定義する。

## ikimon 固有パラメータ

| パラメータ | 値 |
|----------|-----|
| ローカルサーバー | `php -S localhost:8899 -t upload_package/public_html` |
| 検証URL | `http://localhost:8899/` |
| CSS変数定義 | `public_html/assets/css/tokens.css` |
| 本番URL | `https://ikimon.life` |

## ikimon 固有のデザインルール

- **ブランドカラー**: `#2D5016` (Forest Green) / `#4A7C2E`
- **テーマ**: ikimon Premium Light（自然 × テクノロジー）
- **アイコン**: Material Symbols + カスタム生物アイコン
- **マップUI**: 全幅表示、左サイドバーは768px以上のみ

## 使い方

1. **まず共通スキルの全Gate（0〜9）を適用**
2. **次にこのファイルの固有パラメータで補完**

*Promoted to global: 2026-02-17*
