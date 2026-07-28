# ZUKAN Current Runtime Instructions

このディレクトリ以下ではroot `AGENTS.md`に加えて次を守る。

1. 公開サービス名は`ZUKAN`。`ikimon.life`と`platform_v2`は承認済み移行まで技術識別子として維持する。
2. 実装前に`../docs/START_HERE.md`と`../docs/spec/zukan-product-architecture/SPEC.md`を読む。
3. ZUKANを「生き物・自然観察アプリ」と定義しない。写真、資料、観察、活動、出来事等をPlace・Source・Evidence・Claim・Rights・Review・Publicationへ接続する地域知識基盤として扱う。
4. 現行のTaxon、Occurrence、Identification、観察AI、外来種ReportingはBiodiversity Domain Packの専門資産として維持する。汎用SubjectやIssueへ一括改名・置換しない。
5. `Record`、`Claim / ClaimRevision`、`Source / Evidence`、`Place / Entity Identity`、`PublicationEdition`、`Case`の責務を混ぜない。
6. ObservationをPDF、歴史資料、証言、活動等の共通親にしない。ObservationはRecord kindの一つである。
7. 新しい情報、Review、対応結果で原Recordを上書きしない。Claim revisionまたは新Recordとして追記する。
8. ZUKANを緊急通報経路にしない。AI候補を安全・医療・法的資格を伴う最終判断として公開しない。
9. 専門領域は、具体的な利用者、成果物、責任者が存在するときだけDomain Packとして追加する。巨大EAVや汎用`issue_kind`を先に作らない。
10. 通常の組織利用は無料コア。専門責任、提出成果物、Publication制作、クーポン、個別連携・運用を有償領域とする。
11. Foundation v2はadditive expand状態を維持し、承認済みwriter・reader・migrationなしに現行runtime routeやpublic responseへ接続しない。
12. production、DB実適用、secret、DNS、外部送信、mergeはrootの承認・検証境界に従う。
