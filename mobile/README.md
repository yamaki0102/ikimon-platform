# ZUKAN / IKIMON モバイル資産

> Current architecture note: `docs/spec/mobile-product-family/IMPLEMENTATION_SLICE_V1.md`

このディレクトリには、ZUKANの将来のprimary appへ再利用できる既存ネイティブ資産があります。

これらを「完成済みのZUKAN本体」や「捨てる旧実装」とは扱いません。カメラ、音声、位置情報、端末内AI、background処理などの**native capability実装**として評価し、新しいMobile Product Familyから必要に応じて再利用します。

## 現在の2つの専門ネイティブ実装

| 実装 | プラットフォーム | 主な能力 | 現在の扱い |
|---|---|---|---|
| **IkimonScan** | iOS / Swift | カメラ、Vision/Core ML、ARKit、位置・motion | native capability資産。transport更新が必要 |
| **ikimon-pocket / FieldScan** | Android / Kotlin | CameraX、音声AI、GPS/sensor、WorkManager、端末内ML | native capability資産。current runtime API実装あり |

## 目標アーキテクチャ

ZUKANは近い将来installed appを主役にする方向です。同時にNOCOSILもcamera/photo/PDF/text/voiceを起点とするため、モバイル実装は製品ファミリーで再利用できる形を優先します。

ただしNOCOSILとZUKANの信頼状態は統合しません。

```text
shared mobile implementation
        |
   +----+----+
   |         |
ZUKAN       NOCOSIL
app         app
   |         |
separate auth / DB / keys / release
   |         |
native capability ports
   |         |
Swift / Kotlin specialized modules
        |
versioned product contract
        |
Cloudflare OS adapter / product backend
```

現在の第一仮説は、共有UI・routing・sync clientにExpo/React Nativeを検証しつつ、既存のSwift/Kotlin能力をnative moduleとして残す構成です。Expoはまだ確定ではありません。NOCOSILのsecurity/background要件や既存native codeとの接続コストを含むpaired vertical sliceで決定します。

## iOS: IkimonScan

### セットアップ

```bash
brew install xcodegen
cd mobile/ios/IkimonScan
xcodegen generate
open IkimonScan.xcodeproj
```

### 主な構成

```text
IkimonScan/
├── Sources/
│   ├── App/
│   ├── Scan/         # camera / scan UI
│   ├── Detection/    # Vision / Core ML
│   ├── API/
│   └── Models/
├── Resources/
└── project.yml
```

Frameworks include AVFoundation, Vision, CoreML, ARKit, CoreLocation and CoreMotion.

### transport boundary

`IkimonAPIClient.swift` は現在 `https://ikimon.life/api/v2` のlegacy PHP-compatible endpointを利用しています。capture/detection能力は再利用候補ですが、このtransportを新しいproduct-family APIの正本にはしません。

新しいprimary appへ組み込む前に `ikimon.mobile-platform/v1` / versioned product contract側へadapterを移します。

## Android: ikimon-pocket / FieldScan

### セットアップ

Android Studioから `mobile/android/ikimon-pocket/` を開きます。

### 主な構成

```text
ikimon-pocket/
└── app/src/main/kotlin/life/ikimon/
    ├── api/          # auth, current-runtime client, upload/recovery
    ├── context/
    ├── data/
    ├── pocket/       # passive audio / field collection
    ├── spatial/
    ├── store/
    └── ui/
```

現在のGradle構成にはCompose、Location、CameraX、WorkManager、ONNX Runtime、TensorFlow Lite、および端末内GenAI surfaceが含まれています。

Android側のfield-session clientはcurrent Node runtimeの `/api/v1/mobile/field-sessions` を利用する実装へ移っています。一方、旧pending JSON用 `UploadWorker` は明示的に停止されており、長期のdurable outboxとみなしてはいけません。

## 新しいMobile Platform Contract

current runtime側に次のread-only discoveryを追加する実装を進めています。

```text
GET /.well-known/ikimon-platform
GET /api/v1/mobile/capabilities
```

mobile contract version:

```text
ikimon.mobile-platform/v1
```

モバイルからCloudflareのR2/D1/Queues等へ直接依存させません。クライアントはversioned capability / API contractだけを参照し、Cloudflare resourceはserver-side adapterに隠します。

## 再利用ルール

既存native codeは以下の単位でport化を検討します。

- camera / scan;
- audio inference;
- location / sensor capture;
- on-device ML;
- background scheduling;
- media preparation;
- secure device capability.

API URL、auth token、local DB、product policyなどのtrust stateは共通native moduleへ持ち込みません。NOCOSILとZUKANは別app・別認証・別local DB・別鍵・別releaseを維持します。

## 開発判断

1. 既存native codeを削除しない。
2. 先にversioned contractとnegative testを固定する。
3. native capabilityを1つずつport化する。
4. その上でshared shellを小さく試す。
5. Expo/native-module構成が実測で不適なら、該当理由に限定してKotlin Multiplatform等を比較する。
6. production/store releaseは別gateで扱う。
