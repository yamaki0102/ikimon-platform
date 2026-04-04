package life.ikimon

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.Configuration

class IkimonApp : Application(), Configuration.Provider {
    companion object {
        const val CHANNEL_POCKET = "pocket_mode"
        const val CHANNEL_DETECTION = "detection_alert"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            // ポケットモード常駐通知
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_POCKET,
                    "ポケットモード",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "ポケットモードの実行状態を表示します"
                }
            )

            // 検出アラート
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_DETECTION,
                    "生物検出",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "新しい種が検出された時に通知します"
                }
            )
        }
    }
}
