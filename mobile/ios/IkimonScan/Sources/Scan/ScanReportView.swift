import SwiftUI

/// スキャン終了後のレポート画面
struct ScanReportView: View {
    @EnvironmentObject var session: ScanSessionManager
    @Environment(\.dismiss) private var dismiss

    let detections: [Detection]
    @State private var isUploading = false
    @State private var uploadResult: String?

    private var uniqueDetections: [Detection] {
        var seen: Set<String> = []
        return detections.filter { det in
            guard !seen.contains(det.taxonName) else { return false }
            seen.insert(det.taxonName)
            return true
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(.green)
                        Text("スキャン完了!")
                            .font(.title2.bold())
                        Text("\(uniqueDetections.count)種を検出しました")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical)

                    // Detection List
                    VStack(alignment: .leading, spacing: 12) {
                        Text("検出リスト")
                            .font(.headline)

                        ForEach(uniqueDetections) { det in
                            HStack(spacing: 12) {
                                // Thumbnail
                                if let thumb = det.thumbnail {
                                    Image(uiImage: thumb)
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 48, height: 48)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                } else {
                                    Image(systemName: det.icon)
                                        .frame(width: 48, height: 48)
                                        .background(.green.opacity(0.1))
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(det.taxonName)
                                        .font(.subheadline.bold())
                                    if !det.scientificName.isEmpty {
                                        Text(det.scientificName)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .italic()
                                    }
                                }

                                Spacer()

                                // Confidence badge
                                Text("\(Int(det.confidence * 100))%")
                                    .font(.caption.bold())
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(
                                        det.confidence >= 0.7
                                            ? Color.green.opacity(0.2)
                                            : Color.yellow.opacity(0.2)
                                    )
                                    .clipShape(Capsule())
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    // Upload status
                    if let result = uploadResult {
                        Text(result)
                            .font(.caption)
                            .foregroundStyle(.green)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }

                    // Action Buttons
                    VStack(spacing: 12) {
                        Button {
                            Task { await uploadToServer() }
                        } label: {
                            HStack {
                                if isUploading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Image(systemName: "icloud.and.arrow.up")
                                }
                                Text(isUploading ? "送信中..." : "ikimon.life に投稿")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.green)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .disabled(isUploading || uniqueDetections.isEmpty)

                        Button {
                            dismiss()
                        } label: {
                            Text("閉じる")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(.secondary.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func uploadToServer() async {
        isUploading = true
        defer { isUploading = false }

        do {
            let response = try await IkimonAPIClient.shared.submitScanDetections(
                detections: detections,
                sessionMeta: .current
            )

            if response.success {
                let count = response.data?.observations_created ?? 0
                uploadResult = "\(count)件の観察が投稿されました!"
                session.addSession(detections: detections, duration: 0)
            } else {
                uploadResult = "投稿に失敗しました"
            }
        } catch {
            uploadResult = "通信エラー: \(error.localizedDescription)"
        }
    }
}
