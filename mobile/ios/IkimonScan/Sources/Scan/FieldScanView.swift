import SwiftUI
import ARKit
import RealityKit
import CoreLocation

/// 統合フィールドスキャンモード
/// LiDAR + カメラ + 音声 + GPS + センサー を全統合
/// エリアの3D生態系モデルを構築する
struct FieldScanView: View {
    @EnvironmentObject var session: ScanSessionManager
    @StateObject private var fieldEngine = FieldScanEngine()
    @Environment(\.dismiss) private var dismiss

    @State private var bottomTab: BottomTab = .species

    enum BottomTab { case species, map, stats }

    var body: some View {
        ZStack {
            // AR View (LiDAR + カメラ)
            ARViewContainer(engine: fieldEngine)
                .ignoresSafeArea()

            // UI Overlay
            VStack(spacing: 0) {
                // Top Bar
                topBar

                Spacer()

                // Latest Detection Float
                if let det = fieldEngine.latestDetection {
                    detectionFloat(det)
                        .transition(.scale.combined(with: .opacity))
                        .id(det.id)
                }

                Spacer()

                // Bottom Panel
                bottomPanel
            }
        }
        .statusBarHidden()
        .onAppear { fieldEngine.startSession() }
        .onDisappear { fieldEngine.endSession() }
    }

    // MARK: - Top Bar

    var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.7))
            }

            Spacer()

            // Sensor Status Pills
            HStack(spacing: 4) {
                sensorPill("📷", active: fieldEngine.isCameraActive)
                sensorPill("🎤", active: fieldEngine.isAudioActive)
                sensorPill("📍", active: fieldEngine.isGPSActive)
                sensorPill("📐", active: fieldEngine.isLiDARActive)
            }

            Spacer()

            HStack(spacing: 8) {
                Text(fieldEngine.elapsedString)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.gray)

                Text("\(fieldEngine.uniqueSpeciesCount)種")
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.green.opacity(0.3))
                    .clipShape(Capsule())
            }
        }
        .padding()
        .background(.linearGradient(colors: [.black.opacity(0.7), .clear], startPoint: .top, endPoint: .bottom))
    }

    func sensorPill(_ emoji: String, active: Bool) -> some View {
        Text(emoji)
            .font(.system(size: 10))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(active ? Color.green.opacity(0.2) : Color.white.opacity(0.05))
            .clipShape(Capsule())
    }

    // MARK: - Detection Float

    func detectionFloat(_ det: FieldDetection) -> some View {
        VStack(spacing: 4) {
            Text(det.taxonName)
                .font(.title2.bold())
            if !det.scientificName.isEmpty {
                Text(det.scientificName)
                    .font(.caption)
                    .italic()
                    .foregroundStyle(.gray)
            }
            HStack(spacing: 8) {
                Text("\(Int(det.confidence * 100))%")
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(det.confidence >= 0.7 ? Color.green.opacity(0.3) : Color.yellow.opacity(0.3))
                    .clipShape(Capsule())

                Text(det.source.emoji)
                    .font(.caption)

                if let zone = det.zone {
                    Text(zone)
                        .font(.system(size: 10))
                        .foregroundStyle(.gray)
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - Bottom Panel

    var bottomPanel: some View {
        VStack(spacing: 0) {
            // Tab Selector
            HStack(spacing: 8) {
                tabButton("🌿 種リスト", tab: .species)
                tabButton("🗺️ マップ", tab: .map)
                tabButton("📊 統計", tab: .stats)
            }
            .padding(.horizontal)
            .padding(.top, 8)

            // Content
            Group {
                switch bottomTab {
                case .species:
                    speciesList
                case .map:
                    Text("3Dマップ生成中...")
                        .font(.caption)
                        .foregroundStyle(.gray)
                        .frame(height: 120)
                case .stats:
                    statsGrid
                }
            }
            .frame(height: 130)
            .padding(.horizontal)
            .padding(.bottom, 16)
        }
        .background(.linearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .top, endPoint: .bottom))
    }

    func tabButton(_ label: String, tab: BottomTab) -> some View {
        Button {
            bottomTab = tab
        } label: {
            Text(label)
                .font(.system(size: 11))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(bottomTab == tab ? Color.white.opacity(0.15) : Color.white.opacity(0.05))
                .clipShape(Capsule())
        }
    }

    var speciesList: some View {
        ScrollView {
            LazyVStack(spacing: 4) {
                ForEach(fieldEngine.speciesList, id: \.name) { sp in
                    HStack {
                        Text(sp.source.emoji)
                            .font(.system(size: 11))
                        Text(sp.name)
                            .font(.subheadline)
                        Spacer()
                        Text("×\(sp.count)")
                            .font(.caption)
                            .foregroundStyle(.gray)
                        Text("\(Int(sp.confidence * 100))%")
                            .font(.caption)
                            .foregroundStyle(sp.confidence >= 0.7 ? .green : .yellow)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    var statsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 8) {
            statCell("\(fieldEngine.uniqueSpeciesCount)", "種数", .green)
            statCell("\(fieldEngine.totalDetections)", "検出", .white)
            statCell("\(fieldEngine.routePointCount)", "GPS点", .blue)
            statCell("\(fieldEngine.audioDetectionCount)", "音声", .yellow)
        }
    }

    func statCell(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(.gray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - AR View Container

struct ARViewContainer: UIViewRepresentable {
    let engine: FieldScanEngine

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)

        // LiDAR シーン再構成
        let config = ARWorldTrackingConfiguration()
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            config.sceneReconstruction = .mesh
        }
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .automatic

        arView.session.run(config)
        engine.arSession = arView.session

        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {}
}

// MARK: - Supporting Types

struct FieldDetection: Identifiable {
    let id = UUID()
    let taxonName: String
    let scientificName: String
    let confidence: Float
    let source: DetectionSource
    let zone: String?
    let timestamp: Date
}

enum DetectionSource {
    case visual, audio, lidar

    var emoji: String {
        switch self {
        case .visual: return "📷"
        case .audio: return "🎤"
        case .lidar: return "📐"
        }
    }
}

struct SpeciesEntry {
    let name: String
    var count: Int
    var confidence: Float
    let source: DetectionSource
}
