# Android WebView Shell Plan for ikimon.life

## 目的

Chrome / PWA 経由では Android 10 以降の GPS EXIF が redaction される。
これを回避するため、UI は既存の `ikimon.life` をそのまま使い、写真選択と EXIF 読み取りだけを Android ネイティブに逃がす。

## ユーザー体験

- ユーザーは Android アプリをインストールする
- 起動後の見た目はほぼ既存サイトそのまま
- `投稿する` 画面で `写真を撮る` / `ギャラリーから選ぶ` を押す
- 実際の写真選択は Android ネイティブ picker が開く
- 選択後、画像と EXIF GPS / 撮影日時が WebView 内の既存フォームに自動反映される

## 今回の Web 側受け口

既存投稿画面は次の bridge を待つ実装に変更済み。

- JS 呼び出し元: `window.AndroidBridge.pickImages(JSON.stringify(options))`
- JS 受け取り先: `window.__IKIMON_ANDROID__.onMediaSelected(payload)`
- エラー通知先: `window.__IKIMON_ANDROID__.onMediaError(message)`

ネイティブ bridge が存在しない場合は従来どおり `<input type="file">` にフォールバックする。

## Bridge contract

### 1. Android が実装する JavaScriptInterface

```kotlin
class AndroidBridge(
    private val activity: MainActivity
) {
    @JavascriptInterface
    fun pickImages(optionsJson: String) {
        activity.openImagePicker(optionsJson)
    }
}
```

### 2. Web -> Android options

```json
{
  "mode": "camera",
  "multiple": false,
  "limit": 1
}
```

または

```json
{
  "mode": "gallery",
  "multiple": true,
  "limit": 5
}
```

### 3. Android -> Web payload

```json
{
  "items": [
    {
      "name": "IMG_1234.jpg",
      "mimeType": "image/jpeg",
      "dataUrl": "data:image/jpeg;base64,...",
      "lat": 34.710812,
      "lng": 137.726134,
      "observedAt": "2026-03-21T14:08:00+09:00"
    }
  ]
}
```

補足:

- `dataUrl` を優先。`base64` 単体でも受け取れるが `dataUrl` のほうが実装が単純
- `lat` / `lng` が無い場合でも画像だけ渡せる
- `observedAt` は ISO 8601 推奨

## Android 側の最小構成

### 権限

- `READ_MEDIA_IMAGES`
- `ACCESS_MEDIA_LOCATION`
- 必要に応じて `CAMERA`

### 主要クラス

- `MainActivity`
  - `WebView` 初期化
  - `addJavascriptInterface(AndroidBridge(...), "AndroidBridge")`
  - picker 起動
  - picker 結果受信
- `ExifReader`
  - `ContentResolver` + `MediaStore.setRequireOriginal(uri)` で元データを開く
  - `ExifInterface` で GPS / 日時を抽出
- `WebPayloadEncoder`
  - `Uri` を base64 / data URL へ変換
  - JS に渡す JSON を組み立てる

## Android 側の流れ

1. WebView で `https://ikimon.life/post.php` を開く
2. Web 側から `AndroidBridge.pickImages(...)` が呼ばれる
3. Android 側で photo picker か camera intent を起動
4. 選択済み `Uri` ごとに:
   - `MediaStore.setRequireOriginal(uri)` を試す
   - `ExifInterface` で `TAG_GPS_LATITUDE` / `TAG_GPS_LONGITUDE` / `TAG_DATETIME_ORIGINAL` を読む
   - 画像本体を `dataUrl` にする
5. `window.__IKIMON_ANDROID__.onMediaSelected(...)` を `evaluateJavascript()` で呼ぶ
6. Web 側が既存フォームへ流し込む

## Kotlin 実装イメージ

```kotlin
private fun dispatchToWeb(payloadJson: String) {
    val escaped = JSONObject.quote(payloadJson)
    webView.post {
        webView.evaluateJavascript(
            "window.__IKIMON_ANDROID__ && window.__IKIMON_ANDROID__.onMediaSelected($escaped);",
            null
        )
    }
}
```

```kotlin
private fun dispatchError(message: String) {
    val escaped = JSONObject.quote(message)
    webView.post {
        webView.evaluateJavascript(
            "window.__IKIMON_ANDROID__ && window.__IKIMON_ANDROID__.onMediaError($escaped);",
            null
        )
    }
}
```

## EXIF 読み取りの要点

- `ACCESS_MEDIA_LOCATION` が無いと GPS EXIF が redaction される
- 既存写真の GPS を保ちたいなら、ネイティブ側で `MediaStore.setRequireOriginal(uri)` を使う
- 取れない場合は `lat` / `lng` を省略して Web に渡す
- その場合 Web は既存どおりデバイス GPS / 手動位置へフォールバックする

## Web 側変更点

- `post.php`
  - 写真選択ボタンを `openCameraPicker()` / `openGalleryPicker()` に変更
- `post-uploader.js`
  - Android bridge 検出
  - `window.__IKIMON_ANDROID__` の callback 登録
  - `dataUrl + EXIF metadata` を既存フォームに注入
  - bridge 不在時の通常ファイル選択フォールバック維持

## 非目標

- サーバー API の全面改修
- 投稿 UI のフルネイティブ化
- iOS 対応の同時実装

## 次の着手順

1. Android Studio で `ikimon-shell` プロジェクトを新規作成
2. `WebView + AndroidBridge + picker` の最小 PoC を作る
3. `post.php` 上で `写真を撮る` / `ギャラリーから選ぶ` の往復だけ確認する
4. EXIF GPS が `locationSource=exif` として地図に反映されることを実機で確認する
