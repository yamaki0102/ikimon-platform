import SwiftUI

struct ContentView: View {
    @EnvironmentObject var session: ScanSessionManager
    @State private var showScan = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "leaf.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.green)
                    Text("ikimon scan")
                        .font(.title.bold())
                    Text("カメラを向けると、自然が名前を持つ")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 40)

                Spacer()

                // Scan Button
                Button {
                    showScan = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "camera.viewfinder")
                            .font(.title2)
                        VStack(alignment: .leading) {
                            Text("スキャンモード")
                                .font(.headline)
                            Text("カメラで生物を自動検出")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.8))
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.green.gradient)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }

                // Stats Card
                if session.totalDetections > 0 {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("累計記録")
                            .font(.headline)
                        HStack(spacing: 24) {
                            StatItem(icon: "bird", value: "\(session.totalSpecies)", label: "種")
                            StatItem(icon: "mappin.circle", value: "\(session.totalDetections)", label: "検出")
                            StatItem(icon: "clock", value: "\(session.totalSessions)", label: "回")
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }

                // Recent Session
                if let last = session.lastSession {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("最近のスキャン")
                            .font(.headline)
                        HStack {
                            Text(last.dateString)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(last.speciesCount)種検出")
                                .font(.subheadline.bold())
                                .foregroundStyle(.green)
                        }
                        ForEach(last.topDetections.prefix(3), id: \.taxonName) { det in
                            HStack {
                                Image(systemName: det.icon)
                                    .foregroundStyle(.green)
                                Text(det.taxonName)
                                    .font(.subheadline)
                                Spacer()
                                Text("\(Int(det.confidence * 100))%")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }

                Spacer()
            }
            .padding()
            .fullScreenCover(isPresented: $showScan) {
                ScanView()
                    .environmentObject(session)
            }
        }
    }
}

struct StatItem: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundStyle(.green)
            Text(value)
                .font(.title2.bold())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
