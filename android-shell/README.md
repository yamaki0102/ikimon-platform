# ikimon-shell

Android WebView shell app for `ikimon.life`.

## 役割

- UI は既存の `https://ikimon.life/` をそのまま表示
- 写真選択だけネイティブ Android で処理
- `ACCESS_MEDIA_LOCATION` を使って EXIF GPS を読んで Web 側へ返す

## いま入っているもの

- `WebView`
- `AndroidBridge.pickImages(optionsJson)`
- `AndroidBridge.startFieldTracking(optionsJson)`
- `AndroidBridge.stopFieldTracking(optionsJson)`
- ギャラリー選択
- カメラ撮影
- EXIF GPS / 撮影日時の読み取り
- Foreground Service によるライブスキャン継続
- Web への JSON payload 返却

## 開き方

1. Android Studio で `android-shell/` を開く
2. SDK / JDK 17 を入れる
3. 初回 sync を通す
4. 実機 Android 10+ で起動する

## 最初の配布方法

一番簡単なのは debug APK をビルドして配る方法。

1. Android Studio で `Build > Build APK(s)`
2. できた APK を端末へ送る
3. 端末側で `提供元不明のアプリを許可`
4. インストール

運用に乗せるなら次は Play Console の内部テスト配布に切り替える。

## このPCですぐ入れる方法

端末を USB 接続して USB デバッグを有効にしていれば、次でビルドからインストールまで一発で通る。

```powershell
powershell -ExecutionPolicy Bypass -File .\build-and-install.ps1
```

端末未接続なら、生成済み APK はここにある。

`app/build/outputs/apk/debug/app-debug.apk`
