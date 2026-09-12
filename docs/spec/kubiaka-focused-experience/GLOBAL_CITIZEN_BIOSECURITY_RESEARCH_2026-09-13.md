# 市民参加型バイオセキュリティ — 一次情報と設計への採用範囲

- Status: `EVIDENCE NOTE; NOT RUNTIME OR PERFORMANCE EVIDENCE`
- Checked: 2026-09-13 JST
- Product contract: [共通詳細設計](../citizen-biosecurity/SPEC.md)
- First target: [クビアカprofile](SPEC.md)

## 1. 結論の位置付け

「専門的な入口＋共通の記録・証拠＋確認＋地域に応じた連絡＋再訪」を採用する。これは以下の事例とZUKANの既存正本を踏まえた設計判断であり、世界全体の優劣ランキングや、この実装の検出性能の証明ではない。

観察の保存、主張の確認、一般公開、機関への送付、現地対応を分ける。種ごとの別アプリ/DBを作る必要があるとは結論しない。一方、全サービスが同じ内部DBモデルを採用しているとも主張しない。

## 2. 参加体験と確認の一次情報

### R1 — MyPestGuide Reporter / Western Australia DPIRD

Source: https://www.dpird.wa.gov.au/online-tools/mypestguide/mypestguide-reporter/
Related portal: https://mypestguide.dpird.wa.gov.au/

確認できたこと: 虫・動物・雑草・病害等を共通Reporterへ報告し、写真等を専門家が確認して返す。公開mapには共有された報告が表示される。写真保存と共有は同一の意味ではない。

採用: 共通captureと対象別guide、確認結果の返却、共有を別にすること。写真上限等の個別数値はZUKANへそのまま移植しない。

### R2 — EASIN / European Commission JRC

Source: https://easin.jrc.ec.europa.eu/ias
Privacy: https://easin.jrc.ec.europa.eu/easin/home/privacy

確認できたこと: web/mobileからの市民観察、専門家検証、検証済み情報によるCatalogue/Geodatabaseの充実が説明されている。

採用: 投稿、検証、公開版、公式利用を区別する。対象はこのReport Speciesの説明範囲であり、EASINという名称を持つ全API・旧公開hubの全レコードが検証済みとは拡張しない。

### R3 — Yellow-legged Hornet / UK APHA

Source: https://aphascience.blog.gov.uk/2025/05/15/yellow-legged-hornet-monitoring-and-eradication-in-the-uk/
Related reporting guide: https://www.ceh.ac.uk/our-science/citizen-science/asian-hornet

確認できたこと: 専門的な報告入口と確認・現地対応を接続し、写真のある信用できる報告と写真がない報告で扱いを分けている。説明された件数は該当年の実績であり、現在の全件数へ読み替えない。

採用: evidenceの品質と対応経路を分けること。安全に写真を撮れない人の公式連絡を妨げない。ZUKANのAI/Review待ちを公式窓口案内の必須条件にしない。英国の捕獲・駆除手順を別地域へ移植しない。

### R4 — iNaturalist / geoprivacy

Source: https://help.inaturalist.org/en/support/solutions/articles/151000233080-how-does-inaturalist-protect-the-locations-of-sensitive-species-

確認できたこと: 公開精度とprivate位置、対象種の保護等を区別する仕組みが説明されている。

採用: 取得した位置と公開する位置を別に評価すること。iNaturalistの共有条件をZUKANの同意とみなさず、project参加だけでprivate座標を取得できるとはしない。

## 3. 国際交換標準

### R5 — TDWG Darwin Core

Standard: https://www.tdwg.org/standards/dwc/
Terms: https://dwc.tdwg.org/list/
Establishment means: https://dwc.tdwg.org/em/
Degree of establishment: https://dwc.tdwg.org/doe/

確認できたこと: 生物多様性の情報共有用語彙であり、taxon、occurrence、event、位置、権利等を表せる。在来/導入・定着等は場所と時点に関係する情報であり、世界共通の種の属性一つに還元しない。

採用: 内部Record/Claim/Caseを標準へ置換するのでなく、適格な生物情報を交換時にmappingする。行政送付状態や処置履歴をOccurrenceのpresence/absenceへ押し込まない。採用時に実際の用語版と受信側要件をpinする。

### R6 — GBIF data quality / sampling events

Current technical documentation: https://techdocs.gbif.org/en/data-publishing/data-quality-recommendations
Sampling events: https://www.gbif.org/sampling-event-data

確認できたこと: 調査イベントには方法、努力量、範囲等の文脈が重要で、時点・位置・対象を解釈可能にする要件がある。

採用: casual写真の無所見と、protocolに基づくnot_detectedを分ける。absenceという単語が書けることを「この地域にいない」の根拠としない。古いGBIF案内のnegative data indexing説明を現在の受入仕様として引用しない。

## 4. 国内の適用範囲

### R7 — 国と自治体の案内

MAFF meeting notice: https://www.maff.go.jp/j/press/syouan/syokubo/260911.html
Osaka guide: https://www.pref.osaka.lg.jp/o120030/midori/seibututayousei/kubiaka.html
Nagano reporting guide: https://www.pref.nagano.lg.jp/nogi/kubiaka.html
Hamamatsu project: https://www.city.hamamatsu.shizuoka.jp/kankyou/env/tayousei/senryaku2024/project2.html

採用: 成虫/痕跡の区別、土地利用や地域ごとの窓口、出典付き安全案内。依頼者提示の2026-09-11報道と、MAFFの開催案内、戦略の正式本文、個別自治体の区分指定は別Evidenceとして扱う。浜松の一般的な取組資料からクビアカ専用受理契約・専門家体制があるとは推定しない。

公式ページの写真公開は再利用許諾の証拠ではない。実装素材は権利/credit/加工条件を個別に確認する。

## 5. 実装上の一次情報

### R8 — Cloudflare D1 / R2

D1 database API: https://developers.cloudflare.com/d1/worker-api/d1-database/
R2 consistency: https://developers.cloudflare.com/r2/reference/consistency/

確認できたこと: D1 batchはSQLのtransaction境界を提供し、R2はobject操作の整合性を説明している。これらはD1とR2を跨ぐ一つの原子的transactionを意味しない。

採用: 既存のprivate媒体予約と保存確定/再開を再利用する。conditional SQLの0件更新を正常成功と取り違えず、部分的所有者変更を防ぐ。private媒体や削除後の派生cacheはobject保管とは別に扱う。これらの防御は設計判断であり、既存runtimeでテスト済みとはしない。

## 6. 未採用・未確認を正直に残す

以前の広い事例メモに含まれるEDDMapS、FeralScan、Mosquito Alertの最新AI運用、Find-A-Pestの休止状態、ニュージーランドの957人調査等は、この設計の必須根拠・性能数値として採用しない。実利用で必要な事実がある場合に、その対象を一次情報から再確認する。

対象を絞る理由はそれらを否定するためではなく、この変更で実際に確認できたEvidenceと、参考候補を混同しないためである。旧メモはGit履歴に残る。

AIでexpert確認を減らせる割合、誤検出率、見逃し率、地域被害縮小、予算削減額は未測定。低confidenceでの自動却下を正当化しない。初期は保守的な理由付き振分けを用い、将来の自動化は対象/地域別の実測・監査・rollbackが成立した範囲だけ採用する。

## 7. 設計と研究の境界

このノートはsource registerであり、プロファイル設定やruntime機能を有効化しない。採用された振る舞い・supersessionは共通SPEC、対象別差分はクビアカSPEC、実装順と受入はPLANとCONTRACT_EXAMPLES.jsonを参照する。
