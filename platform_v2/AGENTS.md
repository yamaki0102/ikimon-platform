# ZUKAN Current Runtime Instructions

このディレクトリ以下ではroot `AGENTS.md`に加えて次を守る。

1. 公開サービス名は`ZUKAN`。`ikimon.life`と`platform_v2`は承認済み移行まで技術識別子として維持する。
2. 実装前に`../docs/START_HERE.md`、`../docs/spec/zukan-product-architecture/SPEC.md`、`../docs/spec/zukan-product-architecture/PROFILE_HORIZON.md`を読む。UI/UX Workでは`../docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`も読む。
3. ZUKANを「生き物・自然観察アプリ」と定義しない。写真、資料、観察、活動、出来事、施設、歴史、文化等をPlace・Entity・Source・Evidence・Claim・Rights・Review・Publicationへ接続する地域知識基盤として扱う。
4. 現行のTaxon、Occurrence、Identification、観察AI、外来種ReportingはBiodiversity Domain Packの専門資産として維持する。汎用SubjectやIssueへ一括改名・置換しない。
5. `観察会`は現在実装済みのProgram profileの一つであり、Program全体の意味ではない。Photo Contest、写生/編集、Mission/まち歩き、Stamp Rally、観光/地域参加等の将来profileは`PROFILE_HORIZON.md`とProduct Registry frontierに従い、未実装をUI上で利用可能と装わない。
6. 新しいProgram profileやPublication profileのために自治体/顧客別Core、DB、auth、Place modelを作らない。まず既存Program Core / Knowledge Core / Publication contractで表現する。
7. `Record`、`Claim / ClaimRevision`、`Source / Evidence`、`Place / Entity Identity`、`PublicationEdition`、`Case`の責務を混ぜない。
8. ObservationをPDF、歴史資料、証言、活動、人物profile等の共通親にしない。ObservationはRecord kindの一つである。
9. 新しい情報、Review、対応結果で原Recordを上書きしない。Claim revisionまたは新Recordとして追記する。
10. ZUKANを緊急通報経路にしない。AI候補を安全・医療・法的資格を伴う最終判断として公開しない。人物の顔/生体情報から本人識別・追跡を行わない。
11. NOCOSILや外部Publisherとの連携はexplicit rights-safe projection / package境界を使う。private sourceの自動公開や共有巨大DB化をしない。
12. 専門領域は、具体的な利用者、成果物、責任者が存在するときだけDomain Packとして追加する。巨大EAVや汎用`issue_kind`を先に作らない。
13. 通常の組織利用は無料コア。専門責任、提出成果物、Publication制作、クーポン、個別連携・運用を有償領域とする。支払状態でRecord truth、Rights、Review、安全性を変えない。
14. Product Registryの`rolling_frontier`を実装順の静的projectionとして読み、LUNA/executorは商品価値・profile優先順位・privacy/rights・milestone採否を再決定しない。executor Taskがなければ勝手に次milestoneを実装しない。
15. Foundation v2はadditive expand状態を維持し、承認済みwriter・reader・migrationなしに現行runtime routeやpublic responseへ接続しない。
16. production、DB実適用、secret、DNS、外部送信、mergeはrootから参照する現行管理正本と有効な承認・検証境界に従う。DB変更という分類だけで一律の追加承認を作らない。
