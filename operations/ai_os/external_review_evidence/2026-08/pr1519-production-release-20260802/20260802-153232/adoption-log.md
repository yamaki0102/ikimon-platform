# PR #1519 外部レビュー採否ログ

対象: `yamaki0102/ikimon-platform` PR #1519

レビュー対象SHA: `3cb7c8e032b447e07aac6b192e179d8c3950de77`

レビュー実行:

- Claude: `claude-opus-4-8`。raw証跡は同ディレクトリの `claude-review.md`。
- Gemini: `gemini-3.5-flash`。raw証跡は同ディレクトリの `gemini-review.md`。

## 採用

- stagingとproductionの両方で、最終SHA、実行release、live runtime identity、bindings、health/readinessをread-backする。
- stagingで320/375/390/412/768/1024/1440幅と、guest/member、0〜5枚fixtureを分けてVisual QAする。ローカルテスト成功をlive QAの代替にしない。
- rollback locatorと、rollback対象runtimeのidentityを本番反映前に取得する。
- Worker-owned marker付きforwarded originの受信境界を、staging runtimeで確認する。markerなしの内部origin forwarded値、client-supplied forwarded host/proto、未許可originが環境判定・OGP・robots・sitemap・LLMs・OAuth・CSRFを切り替えないことを確認する。
- full-diff snapshotとPR差分のpatch identityが一致することを確認する。確認済みpatch-idは `a8be2472785434d992f0e4ebd4cc385f97bf52e8`。
- #1524の修正はcurrent mainの既存VPS P1 blocker 3件を隠さずテスト契約へ反映したtest-only変更であり、runtime blockerを解消したとは扱わない。

## 保留・実体確認待ち

- origin fallback markerが外部clientから注入できないことは、ソーステストだけではネットワーク実体の証明にならない。Cloudflare/Worker/originのstaging read-backで確認し、確認できない場合はproductionへ進めない。
- productionのD1/DB、secret、DNS、Access/permission変更は今回のrelease範囲に含めない。既存VPS P1 blocker 3件のruntime修復は別PR・別承認境界とする。
- privacy metadata leakage、SVG CSP、CSRF fail-closed、HTTPS protoの実runtime挙動は、staging live QAとevidenceで最終確認する。

## 不採用

- Geminiレビューに含まれた、過去の `116dc...` とのSHA不一致および `release_authorization_not_found` という判定は、今回のレビューpacketと現行Issue/PRの証拠に存在しないため、不採用とする。current headは `3cb7...`、current validationは #995である。過去Issueの状態をcurrent-head evidenceへ昇格しない。

## 現時点の判定

外部レビュー自体は完了したが、staging runtime identity、Visual QA、rollback locatorが未取得のため、レビューだけではReady化・merge・production反映を承認しない。これらのnamed gateを取得した最終SHAで再判定する。
