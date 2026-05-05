package life.ikimon.pocket

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import life.ikimon.IkimonApp
import life.ikimon.api.DiagnosticsUploadCoordinator
import life.ikimon.data.DetectionEvent
import life.ikimon.data.EventBuffer

/**
 * フィールドスキャン Foreground Service
 *
 * Foreground Service はバックグラウンド継続可能な入力だけを担当:
 * 1. 🎧 BirdNET+ V3.0 — 音声 (15秒間隔/10秒録音)
 * 2. 📍 GPS / sensor stream
 * Nano 4 / CameraX は foreground Activity 側で実行する。
 */
class FieldScanService : Service() {

    companion object {
        private const val TAG = "FieldScanService"
        private const val NOTIFICATION_ID = 1002
        private const val AUDIO_INTERVAL_MS = 15_000L
        private const val AUDIO_DURATION_MS = 10_000L
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
    private var locationTracker: LocationTracker? = null
    private var sensorCollector: SensorCollector? = null
    private var isRunning = false
    private var currentSessionId: String = ""

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    // 音声ループ（録音は10秒ブロッキング → IOスレッドで実行）
    // postDelayed は録音+推論完了後に行う — 多重起動防止
    private val audioRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            val self = this
            scope.launch(Dispatchers.IO) {
                captureAndClassifyAudio()
                if (isRunning) handler.postDelayed(self, runtimeConfig.audioIntervalMs)
            }
        }
    }

    private var sessionIntent: String = "official"
    private var officialRecord: Boolean = true
    private var testProfile: String = "field"
    private var movementMode: String = "walk"
    private var runtimeConfig = RuntimeConfig.standard()

    private data class RuntimeConfig(
        val audioIntervalMs: Long,
        val audioDurationMs: Long,
        val audioMinConfidence: Float,
        val micGain: Float,           // デジタルゲイン係数
        val label: String,
    ) {
        companion object {
            fun quick(): RuntimeConfig = RuntimeConfig(
                audioIntervalMs = 20_000L,
                audioDurationMs = 8_000L,
                audioMinConfidence = 0.25f,
                micGain = 2.0f,
                label = "クイック"
            )

            fun standard(): RuntimeConfig = RuntimeConfig(
                audioIntervalMs = AUDIO_INTERVAL_MS,
                audioDurationMs = AUDIO_DURATION_MS,
                audioMinConfidence = 0.20f,
                micGain = 2.5f,
                label = "標準"
            )

            fun stress(): RuntimeConfig = RuntimeConfig(
                audioIntervalMs = 10_000L,
                audioDurationMs = 10_000L,
                audioMinConfidence = 0.25f,
                micGain = 2.5f,
                label = "ストレス"
            )

            // 移動モード別ゲインテーブル
            fun micGainForMovement(mode: String): Float = when (mode) {
                "walk"     -> 2.5f   // 歩き: 高感度
                "focus"    -> 2.5f   // 立ち止まり: 高感度
                "bicycle"  -> 1.8f   // 自転車: 風切り音あるので中程度
                "vehicle"  -> 1.0f   // 車・電車: 環境ノイズ大、感度下げる
                else       -> 2.5f
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        dualAudio = DualAudioClassifier(this)
        locationTracker = LocationTracker(this)
        sensorCollector = SensorCollector(this)
        currentSessionId = "fs_${System.currentTimeMillis()}"

        scope.launch {
            val perchReady = dualAudio?.isPerchReady() ?: false
            val gemmaReady = dualAudio?.isGemmaReady() ?: false
            val engineLabel = when {
                perchReady && gemmaReady -> "BirdNET V3 + Perch v2 + Nano 4 audio"
                perchReady -> "BirdNET V3 + Perch v2"
                gemmaReady -> "BirdNET V3 + Nano 4 audio"
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
        FieldSessionCoordinator.start(
            context = this,
            sessionId = currentSessionId,
            sessionIntent = sessionIntent,
            officialRecord = officialRecord,
            testProfile = testProfile,
            movementMode = movementMode,
        )
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
        dualAudio = null
        CoroutineScope(Dispatchers.IO).launch {
            audioToClose?.close()
        }
        scope.cancel()
        super.onDestroy()
    }

    private fun startMonitoring() {
        if (isRunning) {
            Log.w(TAG, "startMonitoring called while already running — ignored")
            return
        }
        isRunning = true
        Log.i(TAG, "Field Scan started — intent=$sessionIntent official=$officialRecord profile=$testProfile")

        locationTracker?.startTracking(GPS_INTERVAL_MS) { location ->
            FieldSessionCoordinator.updateLocation(location)
        }

        sensorCollector?.start()
        // 車モードは車内ノイズ（エンジン・ロードノイズ）で音声分類が機能しないため無効
        if (movementMode != "vehicle") {
            handler.post(audioRunnable)
        } else {
            Log.i(TAG, "Audio disabled — vehicle mode")
        }

    }

    private fun stopMonitoring() {
        val t0 = System.currentTimeMillis()
        isRunning = false
        Log.i(TAG, "stopMonitoring: begin intent=$sessionIntent profile=$testProfile")

        handler.removeCallbacks(audioRunnable)
        Log.d(TAG, "stopMonitoring: handlers cleared ${System.currentTimeMillis() - t0}ms")

        locationTracker?.stopTracking()
        sensorCollector?.stop()
        Log.d(TAG, "stopMonitoring: sensors stopped ${System.currentTimeMillis() - t0}ms")

        val summary = FieldSessionCoordinator.summary()
        val sessionLog = FieldSessionCoordinator.persistSessionLog(
            context = this,
            mode = "field",
            metadata = mapOf(
                "movement_mode" to movementMode,
                "runtime_label" to runtimeConfig.label,
                "audio_interval_ms" to runtimeConfig.audioIntervalMs,
                "audio_duration_ms" to runtimeConfig.audioDurationMs,
                "foreground_ai_owner" to "activity",
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

        FieldSessionCoordinator.finish(this)
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
                    onDeviceModelBaseName = result.gemmaModelSnapshot?.baseModelName,
                    onDeviceReleaseStage = result.gemmaModelSnapshot?.releaseStage,
                    onDeviceModelPreference = result.gemmaModelSnapshot?.preference,
                    foregroundAiAvailable = result.gemmaModelSnapshot?.foregroundAiAvailable,
                    fallbackReason = result.gemmaModelSnapshot?.fallbackReason,
                )
                FieldSessionCoordinator.addEvent(
                    context = this,
                    raw = event,
                    isFused = result.consensusLevel != DualAudioClassifier.ConsensusLevel.SINGLE_WEAK,
                )

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

                if (result.fusedConfidence >= 0.5f) {
                    val label = "${result.taxonName} (${(result.fusedConfidence * 100).toInt()}%)"
                    updateNotification("$consensusTag $label")
                }
            }
        }
    }

    private fun createNotification(text: String): Notification {
        return NotificationCompat.Builder(this, IkimonApp.CHANNEL_POCKET)
            .setContentTitle("いきものフィールド")
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
            "🔭 Field Companion — 音声+位置"
        } else {
            "🧪 ${runtimeConfig.label}テスト — 音声+位置"
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
