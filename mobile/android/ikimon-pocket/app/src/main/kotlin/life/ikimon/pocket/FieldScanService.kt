package life.ikimon.pocket

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.IBinder
import android.util.Log
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import life.ikimon.IkimonApp
import life.ikimon.data.DetectionEvent
import life.ikimon.data.EventBuffer

/**
 * フィールドスキャン Foreground Service
 *
 * Triple AI Engine を同時実行:
 * 1. 🎧 BirdNET+ V3.0 — 音声 (15秒間隔/10秒録音)
 * 2. 📷 Gemini Nano v3 — 視覚 (5秒間隔/カメラフレーム)
 * 3. 🌡️ Gemini Nano v3 — 環境分析 (60秒間隔)
 *
 * 音声+視覚で同一種検出 → Evidence Tier 自動昇格
 */
class FieldScanService : Service() {

    companion object {
        private const val TAG = "FieldScanService"
        private const val NOTIFICATION_ID = 1002
        private const val AUDIO_INTERVAL_MS = 15_000L
        private const val AUDIO_DURATION_MS = 10_000L
        private const val VISION_INTERVAL_MS = 5_000L
        private const val ENV_INTERVAL_MS = 60_000L
        private const val GPS_INTERVAL_MS = 10_000L

        fun start(context: Context) {
            context.startForegroundService(Intent(context, FieldScanService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, FieldScanService::class.java))
        }
    }

    private var audioClassifier: AudioClassifier? = null
    private var visionClassifier: VisionClassifier? = null
    private var locationTracker: LocationTracker? = null
    private var sensorCollector: SensorCollector? = null
    private val eventBuffer = EventBuffer()
    private var isRunning = false

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    // 音声ループ
    private val audioRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            captureAndClassifyAudio()
            handler.postDelayed(this, AUDIO_INTERVAL_MS)
        }
    }

    // 視覚ループ
    private val visionRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            scope.launch { captureAndClassifyVision() }
            handler.postDelayed(this, VISION_INTERVAL_MS)
        }
    }

    // 環境分析ループ
    private val envRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            scope.launch { analyzeEnvironment() }
            handler.postDelayed(this, ENV_INTERVAL_MS)
        }
    }

    // 最近の音声検出種（マルチモーダル融合用）
    private val recentAudioSpecies = mutableMapOf<String, Float>() // scientificName -> confidence
    private var lastCameraBitmap: Bitmap? = null

    override fun onCreate() {
        super.onCreate()
        audioClassifier = AudioClassifier(this)
        visionClassifier = VisionClassifier(this)
        locationTracker = LocationTracker(this)
        sensorCollector = SensorCollector(this)

        // Gemini Nano初期化（非同期）
        scope.launch {
            val ready = visionClassifier?.initialize() ?: false
            if (ready) {
                Log.i(TAG, "Triple AI Engine ready: BirdNET+ V3.0 + Gemini Nano v3")
                updateNotification("🔭 Triple AI — 音声+視覚+環境")
            } else {
                Log.w(TAG, "Gemini Nano not available — audio-only mode")
                updateNotification("🎧 音声AIのみ（Gemini Nano準備中）")
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification("🔭 フィールドスキャン起動中..."))
        startMonitoring()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopMonitoring()
        audioClassifier?.close()
        visionClassifier?.close()
        scope.cancel()
        super.onDestroy()
    }

    private fun startMonitoring() {
        isRunning = true
        Log.i(TAG, "Field Scan started — Triple AI Engine")

        locationTracker?.startTracking(GPS_INTERVAL_MS) { location ->
            eventBuffer.updateLocation(location.latitude, location.longitude, location.altitude)
        }

        sensorCollector?.start()
        handler.post(audioRunnable)

        // 視覚と環境は少し遅延して開始（Gemini Nano初期化待ち）
        handler.postDelayed(visionRunnable, 3_000L)
        handler.postDelayed(envRunnable, 10_000L)
    }

    private fun stopMonitoring() {
        isRunning = false
        handler.removeCallbacks(audioRunnable)
        handler.removeCallbacks(visionRunnable)
        handler.removeCallbacks(envRunnable)
        locationTracker?.stopTracking()
        sensorCollector?.stop()

        val summary = eventBuffer.getSummary()
        if (summary.totalDetections > 0) {
            showSummaryNotification(summary)
        }
        eventBuffer.scheduleUpload(this)

        Log.i(TAG, "Field Scan stopped. Detections: ${summary.totalDetections}")
    }

    /**
     * 音声AI（BirdNET+ V3.0）
     */
    private fun captureAndClassifyAudio() {
        audioClassifier?.classifyAmbientAudio(AUDIO_DURATION_MS) { results ->
            val location = locationTracker?.lastLocation
            for (result in results) {
                if (result.confidence < 0.20f) continue

                // マルチモーダル融合用に記録
                recentAudioSpecies[result.scientificName] = result.confidence

                val event = DetectionEvent(
                    type = "audio",
                    taxonName = result.name,
                    scientificName = result.scientificName,
                    confidence = result.confidence,
                    lat = location?.latitude,
                    lng = location?.longitude,
                    timestamp = System.currentTimeMillis(),
                    model = "birdnet_v3_dp3",
                    taxonomicClass = result.taxonomicClass,
                    order = result.order,
                )
                eventBuffer.add(event)

                Log.d(TAG, "🎧 ${result.scientificName} (${(result.confidence * 100).toInt()}%)")

                if (result.confidence >= 0.5f && eventBuffer.isNewSpecies(result.name)) {
                    updateNotification("🎧 ${result.name} (${(result.confidence * 100).toInt()}%)")
                }
            }
        }
    }

    /**
     * 視覚AI（Gemini Nano v3）
     */
    private suspend fun captureAndClassifyVision() {
        if (visionClassifier?.isReady() != true) return

        val bitmap = lastCameraBitmap ?: return
        val result = visionClassifier?.classifyFrame(bitmap) ?: return

        if (result.confidence < 0.3f) return

        val location = locationTracker?.lastLocation

        // マルチモーダル融合: 音声で同種検出済みなら信頼度ブースト
        val audioConf = recentAudioSpecies[result.scientificName]
        val fusedConfidence = if (audioConf != null) {
            // 音声+視覚の両方で検出 → 融合信頼度
            val fused = 1.0f - (1.0f - result.confidence) * (1.0f - audioConf)
            Log.i(TAG, "🔥 MULTIMODAL FUSION: ${result.scientificName} " +
                "audio=${(audioConf * 100).toInt()}% + vision=${(result.confidence * 100).toInt()}% " +
                "→ fused=${(fused * 100).toInt()}%")
            fused
        } else {
            result.confidence
        }

        val event = DetectionEvent(
            type = "visual",
            taxonName = result.commonName.ifEmpty { result.scientificName },
            scientificName = result.scientificName,
            confidence = fusedConfidence,
            lat = location?.latitude,
            lng = location?.longitude,
            timestamp = System.currentTimeMillis(),
            model = "gemini_nano_v3",
            taxonomicClass = result.taxonomicClass,
            order = result.order,
        )
        eventBuffer.add(event)

        Log.d(TAG, "📷 ${result.scientificName} (${(fusedConfidence * 100).toInt()}%)" +
            if (audioConf != null) " [FUSED]" else "")

        if (fusedConfidence >= 0.5f && eventBuffer.isNewSpecies(event.taxonName)) {
            val prefix = if (audioConf != null) "🔥" else "📷"
            updateNotification("$prefix ${event.taxonName} (${(fusedConfidence * 100).toInt()}%)")
        }
    }

    /**
     * 環境分析（Gemini Nano v3）— 60秒間隔
     */
    private suspend fun analyzeEnvironment() {
        if (visionClassifier?.isReady() != true) return
        val bitmap = lastCameraBitmap ?: return

        val env = visionClassifier?.analyzeEnvironment(bitmap) ?: return
        Log.i(TAG, "🌡️ Environment: ${env.habitat}, canopy=${env.canopyCoverPct}%, " +
            "disturbance=${env.disturbance}")
    }

    /**
     * CameraXからBitmapを受け取る（UIのFieldScanScreenから呼ばれる）
     */
    fun updateCameraFrame(bitmap: Bitmap) {
        lastCameraBitmap = bitmap
    }

    private fun createNotification(text: String): Notification {
        return NotificationCompat.Builder(this, IkimonApp.CHANNEL_POCKET)
            .setContentTitle("🔭 ikimon フィールドスキャン")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, createNotification(text))
    }

    private fun showSummaryNotification(summary: EventBuffer.Summary) {
        val notification = NotificationCompat.Builder(this, IkimonApp.CHANNEL_DETECTION)
            .setContentTitle("🔭 フィールドスキャンレポート")
            .setContentText("${summary.speciesCount}種を検出 (${summary.durationMinutes}分)")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText(summary.speciesNames.joinToString(", ")))
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(2002, notification)
    }
}
