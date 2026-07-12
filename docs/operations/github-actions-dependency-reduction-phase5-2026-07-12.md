# GitHub Actions依存削減 Phase 5 — Windows管理PCの定期検証

> **SUPERSEDED FOR NEW INSTALLATIONS**
>
> 新規PCではこのrepoのTask Scheduler installerを実行しない。scheduler、evidence、heartbeat、alertingは`yamaki0102/all-projects-management`の`operations/service_observability/`へ中央化する。既存Taskが見つかった場合も自動アンインストールしない。中央shadow runを48時間比較し、別承認でdisableしてからcleanupする。

更新日: 2026-07-12

## 目的

Codex管理PCがWindowsの場合でも、GitHub Actionsのscheduleやrunnerを使わず、productionを15分間隔で読み取り専用検証する。

Linux管理サーバーのsystemd経路と同じBash検証・JSON schema・証拠archive・GitHub statusを再利用する。

## 前提

- Windows PowerShell 5.1以上
- Git for WindowsのBash
- Node.js 22以上
- 管理者権限
- PCが起動しており、`ikimon.life`と必要に応じてGitHub APIへ接続できること

GitHub status送信は任意であり、token未設定時もローカル監視は動作する。

## dry-run

管理者PowerShellで実行する前に、通常PowerShellから確認できる。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-ProductionVerificationScheduledTask.ps1 -DryRun
```

表示される内容:

- repo path
- Git Bash path
- Node.js path
- Task名
- ProgramDataのstate/env path

秘密値は表示・受領しない。

## 一発導入

管理者PowerShellで実行する。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-ProductionVerificationScheduledTask.ps1
```

処理内容:

1. Git Bash・Node.js 22・repo内正本を確認
2. `%ProgramData%\IKIMON\production-verification`を作成
3. stateとenvironment fileのACLをSYSTEM・Administratorsへ限定
4. environment fileがなければstatus送信無効の例を作成
5. 既存environment fileは上書きしない
6. 管理者contextでtargeted検証を1回実行
7. 成功した場合だけ、SYSTEM権限の15分タスクを登録
8. 登録したSYSTEMタスクをその場で起動し、完了とresult=0を待つ
9. doctorでtask、ACL、runtime SHA、report鮮度、archiveを確認

これにより、ユーザーだけがアクセスできるドライブやGit Bashを指定した場合も、導入時にSYSTEM実行が失敗して検知される。

## 設定・証拠の保存先

```text
%ProgramData%\IKIMON\production-verification.env
%ProgramData%\IKIMON\production-verification\
```

主な生成物:

```text
production-verification-latest.json
production-verification-latest.log
production-runtime-version-latest.json
history\YYYY-MM-DD\...
history\latest.json
```

archiveは日付・production SHA・smoke tier・成否を含む名前で14日保持する。

## GitHub statusを有効にする

`%ProgramData%\IKIMON\production-verification.env`を管理者権限で編集する。

```text
GITHUB_REPOSITORY=yamaki0102/ikimon-platform
PUBLISH_GITHUB_STATUS=true
GITHUB_TOKEN=<commit status書込専用token>
```

tokenをrepoやPowerShell履歴へ保存しない。installerはtoken引数を受け付けない。

反映確認:

```powershell
Start-ScheduledTask -TaskName "IKIMON Production Verification"
powershell -ExecutionPolicy Bypass -File .\scripts\Test-ProductionVerificationWindows.ps1
```

## doctor

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-ProductionVerificationWindows.ps1
```

確認内容:

- Windows runnerとrepo
- Git BashとNode.js 22
- environment/state ACL
- status有効時のtoken
- Taskの存在・有効状態・直近result
- Taskのrepo/runner参照
- 15分interval
- public runtimeの40文字SHA
- latest reportのschema、成功、no-personal-data、read-only、SHA一致、鮮度
- archive pointer

タスク登録前の確認:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-ProductionVerificationWindows.ps1 -AllowMissingTask
```

## 更新

repoをmainへ更新した後、同じinstallerを管理者PowerShellで再実行する。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-ProductionVerificationScheduledTask.ps1
```

既存environment fileは保持され、taskのaction・trigger・doctor契約が更新される。

## アンインストール

Taskだけ削除し、秘密値と証拠は残す。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-ProductionVerificationScheduledTask.ps1 -Uninstall
```

秘密値と証拠も削除するときだけ明示する。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-ProductionVerificationScheduledTask.ps1 -Uninstall -PurgeState
```

## 障害確認

```powershell
Get-ScheduledTask -TaskName "IKIMON Production Verification"
Get-ScheduledTaskInfo -TaskName "IKIMON Production Verification"
Get-Content "$env:ProgramData\IKIMON\production-verification\production-verification-latest.log" -Tail 200
powershell -ExecutionPolicy Bypass -File .\scripts\Test-ProductionVerificationWindows.ps1
```

Task Schedulerの履歴が有効な場合は、Microsoft-Windows-TaskScheduler/Operationalも確認する。

## 運用境界

- production Worker、D1、R2、DNS、Secretsを変更しない
- targeted検証を15分間隔で実行
- full検証はproduction release直後のActions経路などに限定
- GitHub API障害はstatus送信警告に留め、検証本体のexit codeを上書きしない
- PCが停止中は検証も停止する。Taskは`StartWhenAvailable`により復帰後に実行する
- Linux管理サーバーが常時稼働する場合はsystemd経路を主、Windowsを補助経路としてもよい
