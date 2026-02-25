# WSL環境情報

## WSL Ubuntu パスワード
- **ユーザー**: yamaki
- **パスワード**: omoikane2026
- **設定日**: 2026-02-22
- **root操作**: `wsl -u root bash -c "コマンド"` でパスワード不要でroot実行可能

## WSLファイル編集ハザード
- **ファイル編集ツール**（replace_file_content, multi_replace_file_content）は**WSLパス (`\\wsl$\...`) のファイルに対して反映されないことがある**
- ツールは「成功」と報告するが実際のファイルは変更されていない
- **対策**: WSLファイルの編集はPythonスクリプトをWSL内で実行するか、`wsl -u root bash -c` + `sed`等で直接操作すること
- root所有ファイルは `wsl -u root bash -c "chown yamaki:yamaki ファイルパス"` で権限変更可能
