# ikimon.co.jp learning redirect map

更新日: 2026-05-08

目的:

- `https://ikimon.co.jp/learn/` 配下の学習コンテンツを `https://ikimon.life/ja/learn/` 配下へ統合する
- 旧記事を1本ずつ重複移植せず、MECE な公式解説クラスタへ集約する
- SEO / LLMO の正準 URL を ikimon.life 側へ寄せる

## 正準クラスタ

| 旧カテゴリ | ikimon.life 正準 |
|---|---|
| `01_fundamentals` | `/ja/learn/biodiversity` |
| `02_international-policy` | `/ja/learn/policy-and-business` |
| `03_japan-policy` | `/ja/learn/policy-and-business` |
| `04_business-economy` | `/ja/learn/policy-and-business` |
| `05_citizen-science` | `/ja/learn/citizen-science` |
| `06_wellbeing` | `/ja/learn/wellbeing` |
| `07_technology` | `/ja/learn/technology` |

## 実装済み受け皿

ikimon.life 側では、同一パスが届いた場合に備えて次を 308 redirect する。

```text
/learn/article.php?category=01_fundamentals&slug=*             -> /ja/learn/biodiversity
/learn/article.php?category=02_international-policy&slug=*     -> /ja/learn/policy-and-business
/learn/article.php?category=03_japan-policy&slug=*             -> /ja/learn/policy-and-business
/learn/article.php?category=04_business-economy&slug=*         -> /ja/learn/policy-and-business
/learn/article.php?category=05_citizen-science&slug=*          -> /ja/learn/citizen-science
/learn/article.php?category=06_wellbeing&slug=*                -> /ja/learn/wellbeing
/learn/article.php?category=07_technology&slug=*               -> /ja/learn/technology
```

## 旧ドメイン側で必要な設定

`ikimon.co.jp` の運用 repo / hosting 設定が見つかったら、同じ対応表で 301 か 308 を入れる。恒久移転なので、キャッシュと検索評価の引き継ぎを優先する。

```apache
RewriteCond %{QUERY_STRING} ^category=01_fundamentals&slug=
RewriteRule ^learn/article\.php$ https://ikimon.life/ja/learn/biodiversity? [R=301,L]

RewriteCond %{QUERY_STRING} ^category=(02_international-policy|03_japan-policy|04_business-economy)&slug=
RewriteRule ^learn/article\.php$ https://ikimon.life/ja/learn/policy-and-business? [R=301,L]

RewriteCond %{QUERY_STRING} ^category=05_citizen-science&slug=
RewriteRule ^learn/article\.php$ https://ikimon.life/ja/learn/citizen-science? [R=301,L]

RewriteCond %{QUERY_STRING} ^category=06_wellbeing&slug=
RewriteRule ^learn/article\.php$ https://ikimon.life/ja/learn/wellbeing? [R=301,L]

RewriteCond %{QUERY_STRING} ^category=07_technology&slug=
RewriteRule ^learn/article\.php$ https://ikimon.life/ja/learn/technology? [R=301,L]

RewriteRule ^learn/?$ https://ikimon.life/ja/learn [R=301,L]
```

## 注意

- 旧記事の本文はそのまま複製しない。重複コンテンツを避けるため、ikimon.life 側は要点を統合した公式解説として保持する。
- 医療、企業開示、保全成果、AI同定は断定しない。根拠と限界を同じページ内に置く。
