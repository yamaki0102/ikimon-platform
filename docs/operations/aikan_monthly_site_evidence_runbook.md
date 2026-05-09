# Aikan Monthly Site Evidence Runbook

目的: `site_evidence_report/v0` を Aikan 実証の月次補助資料として確認し、AI候補、reviewer検証済み、活動指標を混同しない状態でPDF保存する。

## 1. field確認

1. 管理者または analyst でログインする。
2. `/admin/site-evidence` を開く。
3. `field_id` が未指定の場合、`certification_id = "aikan-renri-ikan-hq"` の field が優先表示される。
4. 対象月を `YYYY-MM` で指定する。
5. 表示field名、場所ラベル、verification level、対象月が実証対象と一致することを確認する。

## 2. passive audio ingest smoke

1. ingest smoke は実証用の小さいpayloadだけで実行する。
2. `source_id`, `source_name`, `device_id`, `site_id`, `plot_id`, `timezone`, `model_version` が欠けていないことを確認する。
3. `sampling_effort`, `sensor_status`, clip参照、spectrogram参照が記録されることを確認する。
4. 生音声の恒久保存を前提にしない。レビューに必要な短いclipと監査メタデータだけを確認する。

## 3. レビュー

1. `/admin/sound-review` で対象月の音声候補を確認する。
2. AI候補は活動指標として扱い、reviewer検証済みと分ける。
3. confirm/reject の理由、reviewer、reviewed_at、model_version が残ることを確認する。
4. 却下された候補は削除せず、月次reportの却下数と監査ログで追える状態にする。

## 4. 月次report確認

1. `/admin/site-evidence?field_id=<field_id>&month=<YYYY-MM>` を開く。
2. 人間観察、機械観測、AI候補、reviewer検証済み、却下、passive audio、活動指標が別枠で表示されることを確認する。
3. readiness/blockers を確認する。
   - `missing_human_evidence`
   - `missing_machine_evidence`
   - `missing_reviewer_verified_machine_evidence`
   - `missing_effort_metadata`
4. calibration audit を確認する。
   - registry適用時: `source = registry`, threshold, region, taxon を確認する。
   - registry未適用時: `default threshold 0.9` と表示されることを確認する。

## 5. 印刷PDF化

1. `/admin/site-evidence/print?field_id=<field_id>&month=<YYYY-MM>` を開く。
2. ブラウザ印刷でA4縦、余白標準、背景印刷なしでPDF保存する。
3. 表題が「月次 site evidence report」、用途が「補助資料」になっていることを確認する。
4. PDFには操作フォームを含めない。

## 6. 表現確認

1. レポート、PDF、共有文面では「証明」ではなく「検討材料」「レビュー済み記録」「活動指標」「補助資料」と書く。
2. 準拠、認定、改善を保証するような言い方は使わない。
3. AI候補を確定記録のように扱わない。
4. reviewer検証済みも、外部提出時は根拠、対象月、方法、限界を併記する。

## 7. 翌月TODO

1. 欠測、故障、電池、SDカード、設置移動、天候影響を `sensor_status` に反映する。
2. `missing_effort_metadata` が出た場合は、巡回時間、調査人数、距離、稼働時間のどれを月次入力にするか決める。
3. registry未適用が続く分類群は、地域・taxon・model_version別の calibration registry 追加候補にする。
4. 月次PDFの共有範囲を owner/internal/public のどれにするか記録する。
