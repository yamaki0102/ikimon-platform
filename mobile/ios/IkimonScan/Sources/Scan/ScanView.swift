import SwiftUI
import AVFoundation

/// スキャンモードのメイン画面
/// カメラプレビュー + 検出オーバーレイ + ステータスバー
struct ScanView: View {
    @EnvironmentObject var session: ScanSessionManager
    @StateObject private var camera = CameraManager()
    @StateObject private var detector = SpeciesDetector()
    @Environment(\.dismiss) private var dismiss

    @State private var isScanning = false
    @State private var showReport = false
    @State private var elapsedSeconds = 0
    @State private var timer: Timer?

    var body: some View {
        ZStack {
            // Camera Preview
            CameraPreview(session: camera.captureSession)
                .ignoresSafeArea()

            // Detection Overlays
            ForEach(detector.activeDetections) { detection in
                DetectionOverlay(detection: detection)
            }

            // UI Layer
            VStack {
                // Top Bar
                HStack {
                    Button {
                        stopScan()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.white.opacity(0.8))
                    }

                    Spacer()

                    if isScanning {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(.red)
                                .frame(width: 8, height: 8)
                            Text("SCAN中")
                                .font(.caption.bold())
                            Text(timeString(elapsedSeconds))
                                .font(.caption.monospacedDigit())
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.black.opacity(0.6))
                        .clipShape(Capsule())
                    }

                    Spacer()

                    // Species counter
                    HStack(spacing: 4) {
                        Image(systemName: "leaf.fill")
                            .foregroundStyle(.green)
                        Text("\(detector.uniqueSpeciesCount)種")
                            .font(.caption.bold())
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.black.opacity(0.6))
                    .clipShape(Capsule())
                }
                .foregroundStyle(.white)
                .padding()

                Spacer()

                // Bottom Panel - Recent Detections
                if !detector.recentDetections.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(detector.recentDetections.prefix(5)) { det in
                                DetectionChip(detection: det)
                            }
                        }
                        .padding(.horizontal)
                    }
                }

                // Control Bar
                HStack(spacing: 32) {
                    // Mini Map
                    Button {
                        // TODO: Show map
                    } label: {
                        Image(systemName: "map")
                            .font(.title3)
                    }

                    // Main Scan Button
                    Button {
                        if isScanning {
                            stopScan()
                            showReport = true
                        } else {
                            startScan()
                        }
                    } label: {
                        ZStack {
                            Circle()
                                .stroke(.white, lineWidth: 3)
                                .frame(width: 72, height: 72)
                            Circle()
                                .fill(isScanning ? .red : .green)
                                .frame(width: 60, height: 60)
                            Image(systemName: isScanning ? "stop.fill" : "viewfinder")
                                .font(.title2)
                                .foregroundStyle(.white)
                        }
                    }

                    // Settings
                    Button {
                        // TODO: Settings
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .font(.title3)
                    }
                }
                .foregroundStyle(.white)
                .padding(.vertical, 20)
                .padding(.bottom, 20)
            }
        }
        .statusBarHidden()
        .onAppear {
            camera.configure()
            camera.onFrameCaptured = { pixelBuffer in
                detector.detect(in: pixelBuffer)
            }
        }
        .onDisappear {
            stopScan()
            camera.stop()
        }
        .sheet(isPresented: $showReport) {
            ScanReportView(detections: detector.allDetections)
                .environmentObject(session)
        }
    }

    private func startScan() {
        isScanning = true
        elapsedSeconds = 0
        detector.startSession()
        camera.start()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsedSeconds += 1
        }
    }

    private func stopScan() {
        isScanning = false
        timer?.invalidate()
        timer = nil
        detector.endSession()
    }

    private func timeString(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}

/// 検出結果のオーバーレイ（AR的に画面上に浮かぶラベル）
struct DetectionOverlay: View {
    let detection: Detection

    var body: some View {
        VStack(spacing: 2) {
            Text(detection.taxonName)
                .font(.caption.bold())
            Text("\(Int(detection.confidence * 100))%")
                .font(.system(size: 10).monospacedDigit())
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.black.opacity(0.7))
        .foregroundStyle(detection.confidence > 0.7 ? .green : .yellow)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .position(detection.screenPosition)
        .animation(.easeInOut(duration: 0.3), value: detection.screenPosition)
    }
}

/// 最近の検出を表示するチップ
struct DetectionChip: View {
    let detection: Detection

    var body: some View {
        HStack(spacing: 6) {
            if let thumbnail = detection.thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 32, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(detection.taxonName)
                    .font(.caption2.bold())
                Text("\(Int(detection.confidence * 100))%")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }
            if detection.confidence >= 0.7 {
                Image(systemName: "checkmark.circle.fill")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
    }
}
