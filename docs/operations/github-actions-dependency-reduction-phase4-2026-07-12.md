# GitHub Actions依存削減 Phase 4 — 管理サーバー導入・診断・証拠保持

更新日: 2026-07-12

## 目的

Phase 3で作成した読み取り専用のproduction検証を、管理サーバーへ安全に導入・更新・診断できる状態にする。

このPhaseはproduction Worker、D1、R2、DNS、Secretsを変更しない。管理サーバーへのsystemd unit設置だけは、そのサーバーのroot権限が必要であり、GitHub上の実装だけでは有効化されない。

## 一発導入

管理サーバーでrepoをmainへ更新した後、次を実行する。

```bash
sudo bash scripts/install_production_verification_service.sh --create-user
```

処理内容:

1. 必要コマンドとrepo内の正本ファイルを検査
2. `ikimon` system user/groupがなければ明示指定時だけ作成
3. service userがrepoを読み取れるか検査
4. systemd unitを実パス・実userへrender
5. `systemd-analyze verify`でunitを事前検査
6. `/etc/ikimon/production-verification.env`がなければ安全な例を0640で作成
7. 既存の環境ファイルがある場合は内容を上書きせず、owner/modeだけ安全側へ補正
8. unitを設置してdaemon-reload
9. targeted検証を1回実行
10. 初回検証成功後に15分timerを有効化
11. doctorを実行

## 変更前のdry-run

```bash
bash scripts/install_production_verification_service.sh \
  --create-user \
  --dry-run
```

秘密値をコマンドライン引数で渡すオプションは設けない。

## GitHub statusを有効にする

初回作成される環境ファイルは、status送信を無効にした状態である。

```text
GITHUB_REPOSITORY=yamaki0102/ikimon-platform
PUBLISH_GITHUB_STATUS=false
```

`/etc/ikimon/production-verification.env`へstatus書込専用tokenを設定し、その後に以下へ変更する。

```text
PUBLISH_GITHUB_STATUS=true
GITHUB_TOKEN=<status-only token>
```

ファイル条件:

- owner: `root`
- group: service group
- mode: `0640`以下
- repoへcommitしない

反映確認:

```bash
sudo systemctl start ikimon-production-verification.service
sudo bash scripts/doctor_production_verification_service.sh
```

## 証拠保存

通常のlatestファイルに加えて、管理サーバーでは以下へ日付・SHA付きの履歴を残す。

```text
/var/lib/ikimon-production-verification/history/YYYY-MM-DD/
```

ファイル名は次の情報から作る。

```text
finished timestamp - production SHA prefix - smoke tier - outcome
```

- JSON、log、runtime snapshotはmode `0600`
- `latest.json`は最新履歴への相対pointer
- 14日より古い日付directoryを自動削除
- 履歴保存失敗は警告するが、検証本体のexit codeを改変しない

## doctor

```bash
sudo bash scripts/doctor_production_verification_service.sh
```

確認項目:

- bash/curl/Node.js 22/git/systemctl
- repoとwatch script
- EnvironmentFileのowner/mode
- status送信有効時のtoken有無
- timerのinstalled/enabled/active
- serviceの直近Result
- StateDirectoryのmode
- public runtime endpointのexact SHA
- latest reportのschema、成功、no-personal-data、read-only、SHA一致、鮮度
- evidence archive pointer

未導入状態の事前確認には以下を使う。

```bash
bash scripts/doctor_production_verification_service.sh --allow-inactive
```

## 更新

repoをmainへ更新後、同じinstallerを再実行する。

```bash
sudo bash scripts/install_production_verification_service.sh
```

既存EnvironmentFileは保持される。unitとdoctorは最新版へ更新される。

## アンインストール

unitだけを削除し、秘密値と証拠は残す。

```bash
sudo bash scripts/install_production_verification_service.sh --uninstall
```

秘密値と証拠も削除する場合だけ、明示的に以下を使用する。

```bash
sudo bash scripts/install_production_verification_service.sh \
  --uninstall \
  --purge-state
```

## 障害時

```bash
systemctl status ikimon-production-verification.timer
systemctl status ikimon-production-verification.service
journalctl -u ikimon-production-verification.service -n 200 --no-pager
sudo bash scripts/doctor_production_verification_service.sh
```

GitHub APIだけが停止している場合、status送信は警告に留まり、本番検証の成否を上書きしない。

production runtime endpointが壊れたJSONを返した場合、temporary fileを破棄し、正常なruntime snapshotを不正な内容で上書きしない。

## 現在の残作業

コード、unit、installer、doctor、environment example、証拠rotation、検証テストまではrepoに実装済み。

実管理サーバーで必要なのは次だけである。

1. repo checkoutの配置・更新
2. root権限でinstaller実行
3. status送信を使う場合のみstatus専用tokenをEnvironmentFileへ投入
4. doctor結果の確認
