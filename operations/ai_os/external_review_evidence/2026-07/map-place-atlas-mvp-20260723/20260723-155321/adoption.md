# Map Place Atlas初回Wレビュー採否

- task: `map-place-atlas-mvp-20260723`
- Claude: `claude-opus-4-8` / verdict `block`
- Gemini: `gemini-3.5-flash` / verdict `approve`
- wrapper status: `complete`
- failed model candidates: なし
- model docs check: 不要
- final authority: local source、tests、D1 contract、browser QAでCodexが照合

## 採用・修正

- Claude P0-1を採用。`loadSnapshotRows`のcell INだけが未チャンクで、最大259 bindを
  D1へ渡し得た。80 cell単位へ分割し、全chunkから最新5,000行を決定論的に選ぶ。
  100 cell超のOSM fixtureで各queryが82 bind以下になる回帰testを追加した。
- Claude P0-2をcontract parity問題として採用。本番Workerの現行mapは
  `cell:<lat>,<lng>`を出すため常時404という断定は当たらないが、公開contractが許可する
  Web Mercator grid IDをWorkerが解釈できなかった。canonical `publicLocation`変換を再利用し、
  grid cellをboundedなpublic snapshot cell集合へ変換するtestを追加した。
- Claudeのmedia allowlist提案を採用。実production Tokiwa bboxの43件は全てsame-origin
  `/derived/...`だった。外部HTTPSは`ikimon.life`またはそのsubdomainだけへ限定し、
  UIでも二重検証する。
- GeminiのOSM cache eviction型安全化を採用した。
- SPECの公開query例を実clientと同じcamelCaseへ更新し、snake_caseは互換aliasと明記した。

## 不採用・調整

- Node/Worker sensitive抑制の非対称を即時blockとはしない。Workerは
  `sensitive_precheck_failed`時にRecord全体を抑制し、Nodeは既存public map quality/maskingを
  通過したRecordを保ったままfield editorial sectionsを抑制する。公開位置の漏洩経路はなく、
  本番runtimeは厳しいWorker側である。再レビューで反証を求める。
- Place Memoryの`echoNote`を`photo_echo_visibility`へ連動させる案は不採用。
  既存正本でecho textとphoto echoは別制御であり、現行list APIもechoNoteを独立表示する。
  今回は既存unlock、moderation、viewer-hide、public Record条件をそのまま再利用する。
- 匿名cacheの`Vary`による効率低下は安全側の設計であり、MVPのcorrectness/privacyより
  優先しない。
- Overpass endpointの新規設定は追加しない。既存Workerにも同じ既定endpointとtimeoutがあり、
  secret不要のstaging実測で到達性を判定する。

## 次のgate

修正後にNode/Worker full tests、typecheck、Wrangler dry-runを再実行し、更新patchを
Claude/Geminiへ再投入する。両laneがproduction blockなしと判定するまで本番へ進めない。
