package life.ikimon.pocket

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import life.ikimon.IkimonApp
import life.ikimon.data.DetectionEvent
import life.ikimon.data.EventBuffer

/**
 * ポケットモード Foreground Service
 *
 * バックグラウンドで以下を同時実行:
 * 1. 音声録音 → BirdNET 推論 (30秒間隔で5秒キャプチャ)
 * 2. GPS 追跡 (10秒間隔)
 * 3. 検出イベントを EventBuffer に蓄積
 * 4. Wi-Fi 接続時にサーバーへバッチ送信
 */
class PocketService : Service() {

    companion object {
        private const val TAG = "PocketService"
        private const val NOTIFICATION_ID = 1001
        private const val AUDIO_INTERVAL_MS = 15_000L  // 15秒ごとに録音（2倍の頻度）
        private const val AUDIO_DURATION_MS = 10_000L  // 10秒間録音（BirdNET精度向上）
        private const val GPS_INTERVAL_MS = 10_000L    // 10秒ごとにGPS

        fun start(context: Context) {
            val intent = Intent(context, PocketService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, PocketService::class.java)
            context.stopService(intent)
        }
    }

    private var audioClassifier: AudioClassifier? = null
    private var locationTracker: LocationTracker? = null
    private var sensorCollector: SensorCollector? = null
    private val eventBuffer = EventBuffer()
    private var isRunning = false

    // 音声録音タイマー
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private val audioRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            captureAndClassifyAudio()
            handler.postDelayed(this, AUDIO_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        audioClassifier = AudioClassifier(this)
        locationTracker = LocationTracker(this)
        sensorCollector = SensorCollector(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification("環境音をモニタリング中..."))
        startMonitoring()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopMonitoring()
        super.onDestroy()
    }

    private fun startMonitoring() {
        isRunning = true
        Log.i(TAG, "Pocket mode started")

        // GPS 追跡開始
        locationTracker?.startTracking(GPS_INTERVAL_MS) { location ->
            eventBuffer.updateLocation(location.latitude, location.longitude, location.altitude)
        }

        // センサー収集開始
        sensorCollector?.start()

        // 音声録音ループ開始
        handler.post(audioRunnable)
    }

    private fun stopMonitoring() {
        isRunning = false
        handler.removeCallbacks(audioRunnable)
        locationTracker?.stopTracking()
        sensorCollector?.stop()

        // サマリー通知
        val summary = eventBuffer.getSummary()
        if (summary.totalDetections > 0) {
            showSummaryNotification(summary)
        }

        // バッファをサーバーに送信（WorkManager でスケジュール）
        eventBuffer.scheduleUpload(this)

        Log.i(TAG, "Pocket mode stopped. Detections: ${summary.totalDetections}")
    }

    /**
     * 10秒間の音声を録音し、BirdNET+ V3.0で分類する
     */
    private fun captureAndClassifyAudio() {
        audioClassifier?.classifyAmbientAudio(AUDIO_DURATION_MS) { results ->
            val location = locationTracker?.lastLocation
            for (result in results) {
                if (result.confidence < 0.20f) continue

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

                Log.d(TAG, "Detected: ${result.scientificName} / ${result.name} " +
                    "(${(result.confidence * 100).toInt()}%) [${result.taxonomicClass}]")

                // 高信頼度の新種検出 → 通知
                if (result.confidence >= 0.5f && eventBuffer.isNewSpecies(result.name)) {
                    updateNotification("${result.name} を検出! (${(result.confidence * 100).toInt()}%)")
                }
            }
        }
    }

    private fun createNotification(text: String): Notification {
        return NotificationCompat.Builder(this, IkimonApp.CHANNEL_POCKET)
            .setContentTitle("🎧 ikimon ポケットモード")
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
            .setContentTitle("🌿 散歩レポート")
            .setContentText("${summary.speciesCount}種を検出 (${summary.durationMinutes}分)")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText(summary.speciesNames.joinToString(", ")))
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(2001, notification)
    }
}
