import AVFoundation
import UIKit

/// カメラセッション管理
/// CameraX のように、プレビュー + フレーム解析を同時実行
class CameraManager: NSObject, ObservableObject {
    let captureSession = AVCaptureSession()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let processingQueue = DispatchQueue(label: "life.ikimon.camera", qos: .userInitiated)

    /// フレームコールバック（30fps で呼ばれる）
    var onFrameCaptured: ((CVPixelBuffer) -> Void)?

    /// フレーム間引き: N フレームに1回だけ推論する
    private var frameSkipCounter = 0
    private let analyzeEveryNFrames = 5 // 30fps / 5 = 6fps for inference

    func configure() {
        captureSession.beginConfiguration()
        captureSession.sessionPreset = .hd1920x1080

        // Camera Input (背面カメラ、可能なら広角)
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera) else {
            print("[CameraManager] Failed to get camera input")
            captureSession.commitConfiguration()
            return
        }

        if captureSession.canAddInput(input) {
            captureSession.addInput(input)
        }

        // Video Output (フレーム解析用)
        videoOutput.setSampleBufferDelegate(self, queue: processingQueue)
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]

        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
        }

        // ビデオの向きを固定
        if let connection = videoOutput.connection(with: .video) {
            if connection.isVideoRotationAngleSupported(90) {
                connection.videoRotationAngle = 90
            }
        }

        captureSession.commitConfiguration()
    }

    func start() {
        guard !captureSession.isRunning else { return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.startRunning()
        }
    }

    func stop() {
        guard captureSession.isRunning else { return }
        captureSession.stopRunning()
    }
}

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        frameSkipCounter += 1
        guard frameSkipCounter >= analyzeEveryNFrames else { return }
        frameSkipCounter = 0

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        onFrameCaptured?(pixelBuffer)
    }
}

/// SwiftUI 用カメラプレビュー
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        context.coordinator.previewLayer = previewLayer
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        DispatchQueue.main.async {
            context.coordinator.previewLayer?.frame = uiView.bounds
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var previewLayer: AVCaptureVideoPreviewLayer?
    }
}
