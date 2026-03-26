package life.ikimon.pocket

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import life.ikimon.IkimonApp
import life.ikimon.data.DetectionEvent
import life.ikimon.data.EventBuffer
import java.util.UUID

/**
 * BioScan Foreground Service — 永続スキャン
 *
 * 手に持って使う。カメラは MainActivity 側で処理。
 * このServiceは音声+センサーを担当し、止めるまで永遠に動く。
 *
 * 同時実行:
 * 1. 音声録音 → BirdNET 推論 (15秒間隔で5秒キャプチャ)
 * 2. サウンドスケープ分析 (dB, 周波数帯域, Biophony Index)
 * 3. GPS 追跡 (10秒間隔)
 * 4. 全センサー収集 (光・磁気・気圧・近接・重力・ジャイロ)
 * 5. 環境スナップショット記録 (1分ごと)
 * 6. 1分ごとにサーバーへバッチ送信
 */
class PocketService : Service() {

    companion object {
        private const val TAG = "BioScanService"
        private const val NOTIFICATION_ID = 1001
        private const val AUDIO_INTERVAL_MS = 15_000L
        private const val AUDIO_DURATION_MS = 5_000L
        private const val GPS_INTERVAL_MS = 10_000L
        private const val FLUSH_INTERVAL_MS = 60_000L  // 1分

        @Volatile var isActive: Boolean = false; private set
        @Volatile var currentStats: LiveStats = LiveStats(); private set

        // 共有EventBuffer — MainActivity のビジュアル検出もここに入れる
        val sharedEventBuffer = EventBuffer()

        fun start(context: Context) {
            context.startForegroundService(Intent(context, PocketService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, PocketService::class.java))
        }
    }

    data class LiveStats(
        val speciesCount: Int = 0,
        val totalDetections: Int = 0,
        val visualDetections: Int = 0,
        val audioDetections: Int = 0,
        val soundscapeRecords: Int = 0,
        val durationMinutes: Int = 0,
        val distanceMeters: Float = 0f,
        val stepCount: Int = 0,
        val lastSpecies: String = "",
        val soundDbA: Float = -96f,
        val biophonyIndex: Float = 0f,
        val lightLux: Float = 0f,
        val pressureHpa: Float = 0f,
        val temperatureC: Float = Float.NaN,
        val humidityPercent: Float = 0f,
        val magneticHeading: Float = 0f,
        val availableSensors: List<String> = emptyList(),
        val uploadedBatches: Int = 0,
        val pendingEvents: Int = 0,
        val speedKmh: Float = 0f,
    )

    private val sessionId = UUID.randomUUID().toString()
    private var audioClassifier: AudioClassifier? = null
    private var audioAnalyzer: AudioAnalyzer? = null
    private var locationTracker: LocationTracker? = null
    private var sensorCollector: SensorCollector? = null
    private var isRunning = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var uploadedBatches = 0

    private var lastSoundMetrics: AudioAnalyzer.SoundscapeMetrics? = null

    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    private val audioRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            captureAndAnalyzeAudio()
            handler.postDelayed(this, AUDIO_INTERVAL_MS)
        }
    }

    private val flushRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            periodicFlush()
            handler.postDelayed(this, FLUSH_INTERVAL_MS)
        }
    }

    private val statsRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            updateLiveStats()
            handler.postDelayed(this, 3_000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        audioClassifier = AudioClassifier(this)
        audioAnalyzer = AudioAnalyzer()
        locationTracker = LocationTracker(this)
        sensorCollector = SensorCollector(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification("BioScan フルスキャン中..."))
        acquireWakeLock()
        startMonitoring()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopMonitoring()
        releaseWakeLock()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ikimon:bioscan").apply { acquire() }
        Log.i(TAG, "WakeLock acquired — eternal BioScan")
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    private fun startMonitoring() {
        isRunning = true
        isActive = true
        sharedEventBuffer.sessionId = sessionId
        Log.i(TAG, "=== BIOSCAN STARTED === session=$sessionId")

        locationTracker?.startTracking(GPS_INTERVAL_MS) { location ->
            sharedEventBuffer.updateLocation(location.latitude, location.longitude, location.altitude)
            sharedEventBuffer.updateGpsAccuracy(location.accuracy)
            if (location.hasSpeed()) sharedEventBuffer.updateSpeed(location.speed * 3.6f)
        }

        sensorCollector?.start()
        handler.post(audioRunnable)
        handler.postDelayed(flushRunnable, FLUSH_INTERVAL_MS)
        handler.post(statsRunnable)
    }

    private fun stopMonitoring() {
        isRunning = false
        isActive = false
        handler.removeCallbacks(audioRunnable)
        handler.removeCallbacks(flushRunnable)
        handler.removeCallbacks(statsRunnable)
        locationTracker?.stopTracking()
        sensorCollector?.stop()

        finalFlush()

        val summary = sharedEventBuffer.getSummary()
        if (summary.totalDetections > 0) showSummaryNotification(summary)

        currentStats = LiveStats()
        Log.i(TAG, "=== BIOSCAN STOPPED === " +
            "Detections: ${summary.totalDetections}, Species: ${summary.speciesCount}, " +
            "Duration: ${summary.durationMinutes}min, Uploads: $uploadedBatches")
    }

    private fun captureAndAnalyzeAudio() {
        audioClassifier?.classifyAmbientAudioWithRaw(AUDIO_DURATION_MS) { results, rawAudio ->
            if (rawAudio != null) {
                lastSoundMetrics = audioAnalyzer?.analyze(rawAudio)
            }

            val location = locationTracker?.lastLocation
            val snapshot = sensorCollector?.getSnapshot(
                soundDbA = lastSoundMetrics?.dbA,
                soundFreqLow = lastSoundMetrics?.freqLow,
                soundFreqMid = lastSoundMetrics?.freqMid,
                soundFreqHigh = lastSoundMetrics?.freqHigh,
                soundBiophonyIndex = lastSoundMetrics?.biophonyIndex,
                lat = location?.latitude,
                lng = location?.longitude,
                altitudeM = location?.altitude,
                gpsAccuracyM = location?.accuracy,
                speedKmh = if (location?.hasSpeed() == true) location.speed * 3.6f else null,
            )

            if (snapshot != null) sensorCollector?.maybeLogEnvironment(snapshot)

            // サウンドスケープ記録（常に）
            if (lastSoundMetrics != null && lastSoundMetrics!!.dbA > -80f) {
                sharedEventBuffer.add(DetectionEvent(
                    type = "soundscape",
                    taxonName = "ambient",
                    scientificName = "",
                    confidence = 0f,
                    lat = location?.latitude,
                    lng = location?.longitude,
                    timestamp = System.currentTimeMillis(),
                    model = "soundscape_analyzer_v1",
                    environmentSnapshot = snapshot,
                    speedKmh = if (location?.hasSpeed() == true) location.speed * 3.6f else null,
                ))
            }

            // BirdNET検出
            for (result in results) {
                if (result.confidence < 0.5f) continue
                sharedEventBuffer.add(DetectionEvent(
                    type = "audio",
                    taxonName = result.name,
                    scientificName = result.scientificName,
                    confidence = result.confidence,
                    lat = location?.latitude,
                    lng = location?.longitude,
                    timestamp = System.currentTimeMillis(),
                    model = "birdnet_lite_v1",
                    environmentSnapshot = snapshot,
                    speedKmh = if (location?.hasSpeed() == true) location.speed * 3.6f else null,
                ))

                Log.d(TAG, "Audio: ${result.name} (${(result.confidence * 100).toInt()}%)")

                if (result.confidence >= 0.7f && sharedEventBuffer.isNewSpecies(result.name)) {
                    updateNotification("🐦 ${result.name} (${(result.confidence * 100).toInt()}%)")
                }
            }
        }
    }

    private fun periodicFlush() {
        val envHistory = sensorCollector?.getEnvHistory() ?: emptyList()
        val routePoints = locationTracker?.getRoutePoints() ?: emptyList()
        val distance = locationTracker?.getTotalDistanceMeters() ?: 0f

        sharedEventBuffer.scheduleIncrementalUpload(this, envHistory, routePoints, distance, isFinal = false)
        sensorCollector?.clearEnvHistory()
        uploadedBatches++

        val stats = sharedEventBuffer.getSummary()
        updateNotification("🌿 ${stats.speciesCount}種 | ${stats.durationMinutes}分 | 📤${uploadedBatches}")
        Log.i(TAG, "Flush #$uploadedBatches: ${stats.totalDetections} events")
    }

    private fun finalFlush() {
        val envHistory = sensorCollector?.getEnvHistory() ?: emptyList()
        val routePoints = locationTracker?.getRoutePoints() ?: emptyList()
        val distance = locationTracker?.getTotalDistanceMeters() ?: 0f
        sharedEventBuffer.scheduleIncrementalUpload(this, envHistory, routePoints, distance, isFinal = true)
        uploadedBatches++
    }

    private fun updateLiveStats() {
        val summary = sharedEventBuffer.getSummary()
        val sound = lastSoundMetrics
        val sensor = sensorCollector
        val location = locationTracker

        currentStats = LiveStats(
            speciesCount = summary.speciesCount,
            totalDetections = summary.totalDetections,
            durationMinutes = summary.durationMinutes,
            distanceMeters = location?.getTotalDistanceMeters() ?: 0f,
            stepCount = sensor?.stepCount ?: 0,
            lastSpecies = summary.speciesNames.lastOrNull() ?: "",
            soundDbA = sound?.dbA ?: -96f,
            biophonyIndex = sound?.biophonyIndex ?: 0f,
            lightLux = sensor?.lightLux ?: 0f,
            pressureHpa = sensor?.pressure ?: 0f,
            temperatureC = sensor?.temperature ?: Float.NaN,
            humidityPercent = sensor?.humidity ?: 0f,
            magneticHeading = if (sensor != null && sensor.magneticX != 0f) {
                val deg = Math.toDegrees(Math.atan2(sensor.magneticY.toDouble(), sensor.magneticX.toDouble())).toFloat()
                if (deg < 0) deg + 360f else deg
            } else 0f,
            availableSensors = sensor?.availableSensors ?: emptyList(),
            uploadedBatches = uploadedBatches,
            pendingEvents = summary.totalDetections,
            speedKmh = location?.lastLocation?.let { if (it.hasSpeed()) it.speed * 3.6f else 0f } ?: 0f,
        )
    }

    private fun createNotification(text: String): Notification {
        return NotificationCompat.Builder(this, IkimonApp.CHANNEL_POCKET)
            .setContentTitle("🔬 ikimon BioScan")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, createNotification(text))
    }

    private fun showSummaryNotification(summary: EventBuffer.Summary) {
        val notification = NotificationCompat.Builder(this, IkimonApp.CHANNEL_DETECTION)
            .setContentTitle("🌿 BioScanレポート")
            .setContentText("${summary.speciesCount}種検出 (${summary.durationMinutes}分)")
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                "検出: ${summary.speciesNames.joinToString(", ")}\n" +
                "総件数: ${summary.totalDetections} | 送信: ${uploadedBatches}回"
            ))
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setAutoCancel(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(2001, notification)
    }
}
