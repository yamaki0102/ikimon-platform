# ikimon.life モバイルアプリ

## 2つのモード

| モード | プラットフォーム | 機能 |
|---|---|---|
| **スキャン** (iOS) | iPhone 13 Pro | カメラで生物をリアルタイム検出・マッピング |
| **ポケット** (Android) | Pixel 10 Pro | 歩くだけで鳥声・虫声を自動検出 |

## iOS: IkimonScan

### セットアップ

```bash
# XcodeGen でプロジェクト生成
brew install xcodegen
cd mobile/ios/IkimonScan
xcodegen generate

# Xcode で開く
open IkimonScan.xcodeproj
```

### 構成

```
IkimonScan/
├── Sources/
│   ├── App/          # SwiftUI App + ContentView
│   ├── Scan/         # カメラ + スキャン画面
│   ├── Detection/    # Vision + Core ML 推論
│   ├── API/          # ikimon.life API クライアント
│   └── Models/       # データモデル
├── Resources/        # Info.plist
└── project.yml       # XcodeGen 設定
```

### 必要な環境
- Xcode 15+
- iOS 16+ (iPhone 13 Pro 推奨)
- Apple Developer Account (実機テスト用)

## Android: ikimon-pocket

### セットアップ

```bash
# Android Studio で開く
# File > Open > mobile/android/ikimon-pocket/

# BirdNET モデル配置
# app/src/main/assets/birdnet_lite.tflite
# app/src/main/assets/birdnet_labels.txt
```

### 構成

```
ikimon-pocket/
├── app/src/main/
│   ├── kotlin/life/ikimon/
│   │   ├── IkimonApp.kt         # Application (通知チャネル)
│   │   ├── ui/MainActivity.kt   # ホーム画面 (Compose)
│   │   ├── pocket/
│   │   │   ├── PocketService.kt     # Foreground Service
│   │   │   ├── AudioClassifier.kt   # BirdNET TFLite 推論
│   │   │   ├── LocationTracker.kt   # GPS 追跡
│   │   │   └── SensorCollector.kt   # 加速度 + 気圧
│   │   ├── api/
│   │   │   └── UploadWorker.kt      # WorkManager バッチ送信
│   │   └── data/
│   │       ├── DetectionEvent.kt    # イベントモデル
│   │       └── EventBuffer.kt      # ローカルバッファ
│   ├── assets/                      # TFLite モデル
│   └── res/
└── build.gradle.kts
```

### 必要な環境
- Android Studio Ladybug+
- Android SDK 35
- Pixel 10 Pro (実機推奨) or エミュレータ

### BirdNET モデル

1. https://github.com/kahst/BirdNET-Analyzer から TFLite モデルをダウンロード
2. `app/src/main/assets/birdnet_lite.tflite` に配置
3. ラベルファイルを `app/src/main/assets/birdnet_labels.txt` に配置

## サーバー API

両アプリ共通のバックエンド API:

| エンドポイント | 用途 |
|---|---|
| `POST /api/v2/passive_event.php` | ポケットモード: 音声+GPS バッチ送信 |
| `POST /api/v2/scan_detection.php` | スキャンモード: 写真付き検出送信 |
| `GET /api/v2/observations.php` | 観察データ取得 |

## アーキテクチャ

```
iPhone 13 Pro (Swift)          Pixel 10 Pro (Kotlin)
┌──────────────┐              ┌──────────────┐
│ CameraX      │              │ AudioRecord  │
│ Vision       │              │ BirdNET Lite │
│ Core ML      │              │ GPS Tracker  │
│ ARKit/LiDAR  │              │ Sensors      │
└──────┬───────┘              └──────┬───────┘
       │                             │
       │    JSON over HTTPS          │
       └──────────┬──────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │ ikimon.life     │
        │ API v2          │
        │ (PHP 8.2)       │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Passive         │
        │ Observation     │
        │ Engine          │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ DataStore       │
        │ (JSON + SQLite) │
        └─────────────────┘
```
