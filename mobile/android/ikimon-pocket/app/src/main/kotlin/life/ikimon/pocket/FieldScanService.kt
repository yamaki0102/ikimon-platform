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
import life.ikimon.api.DiagnosticsUploadCoordinator
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
        private const val EXTRA_SESSION_INTENT = "session_intent"
        private const val EXTRA_OFFICIAL_RECORD = "official_record"
        private const val EXTRA_TEST_PROFILE = "test_profile"
        private const val EXTRA_MOVEMENT_MODE = "movement_mode"

        fun start(
            context: Context,
            sessionIntent: String = "official",
            officialRecord: Boolean = true,
            testProfile: String = "field",
            movementMode: String = "walk",
        ) {
            val intent = Intent(context, FieldScanService::class.java).apply {
                putExtra(EXTRA_SESSION_INTENT, sessionIntent)
                putExtra(EXTRA_OFFICIAL_RECORD, officialRecord)
                putExtra(EXTRA_TEST_PROFILE, testProfile)
                putExtra(EXTRA_MOVEMENT_MODE, movementMode)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, FieldScanService::class.java))
        }
    }

    private var dualAudio: DualAudioClassifier? = null
    private var visionClassifier: VisionClassifier? = null
    private var locationTracker: LocationTracker? = null
    private var sensorCollector: SensorCollector? = null
    private val eventBuffer = EventBuffer()
    private var isRunning = false
    private var currentSessionId: String = ""

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    // 音声ループ（録音は10秒ブロッキング → IOスレッドで実行）
    private val audioRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            scope.launch(Dispatchers.IO) { captureAndClassifyAudio() }
            handler.postDelayed(this, runtimeConfig.audioIntervalMs)
        }
    }

    // 視覚ループ
    private val visionRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            scope.launch { captureAndClassifyVision() }
            handler.postDelayed(this, runtimeConfig.visionIntervalMs)
        }
    }

    // 環境分析ループ
    private val envRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            scope.launch { analyzeEnvironment() }
            handler.postDelayed(this, runtimeConfig.envIntervalMs)
        }
    }

    // 最近の音声検出種（マルチモーダル融合用）
    private val recentAudioSpecies = mutableMapOf<String, Float>() // scientificName -> confidence
    private var lastCameraBitmap: Bitmap? = null
    private var sessionIntent: String = "official"
    private var officialRecord: Boolean = true
    private var testProfile: String = "field"
    private var movementMode: String = "walk"
    private var runtimeConfig = RuntimeConfig.standard()

    private data class RuntimeConfig(
        val audioIntervalMs: Long,
        val audioDurationMs: Long,
        val visionIntervalMs: Long,
        val envIntervalMs: Long,
        val audioMinConfidence: Float,
        val visualMinConfidence: Float,
        val micGain: Float,           // デジタルゲイン係数
        val label: String,
    ) {
        companion object {
            fun quick(): RuntimeConfig = RuntimeConfig(
                audioIntervalMs = 20_000L,
                audioDurationMs = 8_000L,
                visionIntervalMs = 8_000L,
                envIntervalMs = 75_000L,
                audioMinConfidence = 0.25f,
                visualMinConfidence = 0.35f,
                micGain = 2.0f,
                label = "クイック"
            )

            fun standard(): RuntimeConfig = RuntimeConfig(
                audioIntervalMs = AUDIO_INTERVAL_MS,
                audioDurationMs = AUDIO_DURATION_MS,
                visionIntervalMs = VISION_INTERVAL_MS,
                envIntervalMs = ENV_INTERVAL_MS,
                audioMinConfidence = 0.20f,
                visualMinConfidence = 0.30f,
                micGain = 2.5f,
                label = "標準"
            )

            fun stress(): RuntimeConfig = RuntimeConfig(
                audioIntervalMs = 10_000L,
                audioDurationMs = 10_000L,
                visionIntervalMs = 3_000L,
                envIntervalMs = 30_000L,
                audioMinConfidence = 0.25f,
                visualMinConfidence = 0.30f,
                micGain = 2.5f,
                label = "ストレス"
            )

            // 移動モード別ゲインテーブル
            fun micGainForMovement(mode: String): Float = when (mode) {
                "walk"     -> 2.5f   // 歩き: 高感度
                "bicycle"  -> 1.8f   // 自転車: 風切り音あるので中程度
                "vehicle"  -> 1.0f   // 車・電車: 環境ノイズ大、感度下げる
                else       -> 2.5f
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        dualAudio = DualAudioClassifier(this)
        visionClassifier = VisionClassifier(this)
        locationTracker = LocationTracker(this)
        sensorCollector = SensorCollector(this)
        currentSessionId = "fs_${System.currentTimeMillis()}"

        scope.launch {
            val ready = visionClassifier?.initialize() ?: false
            val perchReady = dualAudio?.isPerchReady() ?: false
            val gemmaReady = dualAudio?.isGemmaReady() ?: false
            val engineLabel = when {
                ready && perchReady && gemmaReady -> "BirdNET V3 + Perch v2 + Gemma E4B + Gemini Nano v3"
                ready && perchReady -> "BirdNET V3 + Perch v2 + Gemini Nano v3"
                ready && gemmaReady -> "BirdNET V3 + Gemma E4B + Gemini Nano v3"
                ready -> "BirdNET V3 + Gemini Nano v3"
                perchReady -> "BirdNET V3 + Perch v2"
                else -> "BirdNET V3"
            }
            Log.i(TAG, "AI Engine ready: $engineLabel")
            updateNotification(activeNotificationText())
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        sessionIntent = intent?.getStringExtra(EXTRA_SESSION_INTENT)?.takeIf { it == "test" } ?: "official"
        officialRecord = intent?.getBooleanExtra(EXTRA_OFFICIAL_RECORD, true) ?: true
        testProfile = intent?.getStringExtra(EXTRA_TEST_PROFILE)?.takeIf {
            it == "quick" || it == "stress"
        } ?: if (sessionIntent == "test") "standard" else "field"
        movementMode = intent?.getStringExtra(EXTRA_MOVEMENT_MODE) ?: "walk"
        runtimeConfig = when (testProfile) {
            "quick" -> RuntimeConfig.quick()
            "stress" -> RuntimeConfig.stress()
            else -> RuntimeConfig.standard()
        }.let { cfg ->
            // 移動モード別ゲインを適用（walk以外は調整）
            if (movementMode != "walk") {
                cfg.copy(micGain = RuntimeConfig.micGainForMovement(movementMode))
            } else cfg
        }
        eventBuffer.setSessionMode(sessionIntent, officialRecord, testProfile)
        startForeground(
            NOTIFICATION_ID,
            createNotification(if (officialRecord) "🌿 フィールド記録を開始" else "🧪 ${runtimeConfig.label}テストを開始")
        )
        startMonitoring()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopMonitoring()
        // モデルのclose()はブロッキングの可能性があるためバックグラウンドで実行
        val audioToClose = dualAudio
        val visionToClose = visionClassifier
        dualAudio = null
        visionClassifier = null
        CoroutineScope(Dispatchers.IO).launch {
            audioToClose?.close()
            visionToClose?.close()
        }
        scope.cancel()
        super.onDestroy()
    }

    private fun startMonitoring() {
        isRunning = true
        Log.i(TAG, "Field Scan started — intent=$sessionIntent official=$officialRecord profile=$testProfile")

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
        val t0 = System.currentTimeMillis()
        isRunning = false
        Log.i(TAG, "stopMonitoring: begin intent=$sessionIntent profile=$testProfile")

        handler.removeCallbacks(audioRunnable)
        handler.removeCallbacks(visionRunnable)
        handler.removeCallbacks(envRunnable)
        Log.d(TAG, "stopMonitoring: handlers cleared ${System.currentTimeMillis() - t0}ms")

        locationTracker?.stopTracking()
        sensorCollector?.stop()
        Log.d(TAG, "stopMonitoring: sensors stopped ${System.currentTimeMillis() - t0}ms")

        val summary = eventBuffer.getSummary()
        val sessionLog = eventBuffer.persistSessionLog(
            context = this,
            sessionId = currentSessionId,
            mode = "field",
            metadata = mapOf(
                "movement_mode" to movementMode,
                "runtime_label" to runtimeConfig.label,
                "audio_interval_ms" to runtimeConfig.audioIntervalMs,
                "audio_duration_ms" to runtimeConfig.audioDurationMs,
                "vision_interval_ms" to runtimeConfig.visionIntervalMs,
                "env_interval_ms" to runtimeConfig.envIntervalMs,
            ),
        )
        if (summary.totalDetections > 0) {
            showSummaryNotification(summary)
        }
        Log.d(TAG, "stopMonitoring: summary done ${System.currentTimeMillis() - t0}ms detections=${summary.totalDetections}")
        Log.i(TAG, "stopMonitoring: session log saved ${sessionLog.absolutePath}")
        if (!officialRecord || sessionIntent == "test") {
            DiagnosticsUploadCoordinator.enqueueSessionLogUpload(this, sessionLog)
            Log.i(TAG, "stopMonitoring: diagnostics upload queued ${sessionLog.name}")
        }

        eventBuffer.scheduleUpload(this)
        Log.i(TAG, "stopMonitoring: complete ${System.currentTimeMillis() - t0}ms")
    }

    /**
     * トリプル音声AI（BirdNET V3 + Perch v2 + Gemma E4B）
     * IOスレッドで録音（10秒ブロッキング）→ 推論 → メインスレッドでUI更新。
     */
    private suspend fun captureAndClassifyAudio() {
        val dual = dualAudio ?: return
        if (!dual.isReady()) return

        // 音声録音（移動モード別ゲイン適用）
        val audioData = AudioClassifier.recordAudioStatic(this, runtimeConfig.audioDurationMs, runtimeConfig.micGain)
            ?: return

        val location = locationTracker?.lastLocation

        dual.classifyDual(
            audioData = audioData,
            durationMs = runtimeConfig.audioDurationMs,
            minConfidence = runtimeConfig.audioMinConfidence,
            callerScope = scope,
        ) { results ->
            if (results.isEmpty()) return@classifyDual

            // 音声スニペットを保存（高信頼度または仮同定候補がある場合）
            val snippet = AudioSnippetStore.saveSnippet(
                context = this,
                sessionId = currentSessionId,
                audioData = audioData,
                dualResults = results,
                lat = location?.latitude,
                lng = location?.longitude,
            )

            for (result in results) {
                // マルチモーダル融合用に記録
                recentAudioSpecies[result.scientificName] = result.fusedConfidence

                val engineLabel = when {
                    result.birdnetConfidence != null && result.perchConfidence != null && result.gemmaConfidence != null -> "triple_v3_perch2_gemma"
                    result.birdnetConfidence != null && result.perchConfidence != null -> "dual_v3_perch2"
                    result.birdnetConfidence != null && result.gemmaConfidence != null -> "dual_v3_gemma"
                    result.gemmaConfidence != null -> "gemma_e4b"
                    result.perchConfidence != null -> "perch_v2"
                    else -> "birdnet_v3_dp3"
                }

                val event = DetectionEvent(
                    type = "audio",
                    taxonName = result.taxonName,
                    scientificName = result.scientificName,
                    confidence = result.fusedConfidence,
                    lat = location?.latitude,
                    lng = location?.longitude,
                    timestamp = System.currentTimeMillis(),
                    model = engineLabel,
                    taxonomicClass = result.taxonomicClass,
                    order = result.order,
                    audioSnippetId = snippet?.id,
                    birdnetConfidence = result.birdnetConfidence,
                    perchConfidence = result.perchConfidence,
                    gemmaConfidence = result.gemmaConfidence,
                    consensusLevel = result.consensusLevel.name,
                )
                eventBuffer.add(event)

                val consensusTag = when (result.consensusLevel) {
                    DualAudioClassifier.ConsensusLevel.TRIPLE_CONSENSUS -> "🔥🔥"
                    DualAudioClassifier.ConsensusLevel.DUAL_CONSENSUS -> "🔥"
                    else -> "🎧"
                }
                Log.d(TAG, "$consensusTag ${result.scientificName} " +
                    "fused=${(result.fusedConfidence * 100).toInt()}% " +
                    "bn=${result.birdnetConfidence?.let { "${(it*100).toInt()}%" } ?: "-"} " +
                    "perch=${result.perchConfidence?.let { "${(it*100).toInt()}%" } ?: "-"} " +
                    "gemma=${result.gemmaConfidence?.let { "${(it*100).toInt()}%" } ?: "-"}")

                if (result.fusedConfidence >= 0.5f && eventBuffer.isNewSpecies(result.taxonName)) {
                    val label = "${result.taxonName} (${(result.fusedConfidence * 100).toInt()}%)"
                    updateNotification("$consensusTag $label")
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

        if (result.confidence < runtimeConfig.visualMinConfidence) return

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

    private fun activeNotificationText(): String {
        return if (officialRecord) {
            "🔭 Triple AI — 音声+視覚+環境"
        } else {
            "🧪 ${runtimeConfig.label}テスト — 音声+視覚+環境"
        }
    }

    private fun showSummaryNotification(summary: EventBuffer.Summary) {
        val notification = NotificationCompat.Builder(this, IkimonApp.CHANNEL_DETECTION)
            .setContentTitle(if (officialRecord) "🔭 フィールドスキャンレポート" else "🧪 動作チェックレポート")
            .setContentText(
                if (officialRecord) {
                    "${summary.speciesCount}種を検出 (${summary.durationMinutes}分)"
                } else {
                    "${runtimeConfig.label}テスト: ${summary.speciesCount}種を検出 (${summary.durationMinutes}分)"
                }
            )
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText(summary.speciesNames.joinToString(", ")))
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(2002, notification)
    }
}
