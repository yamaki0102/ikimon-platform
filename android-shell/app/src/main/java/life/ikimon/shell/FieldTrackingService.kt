package life.ikimon.shell

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import org.json.JSONArray
import org.json.JSONObject

class FieldTrackingService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var sessionId: String? = null
    private var fieldId: String? = null
    private val recentPoints = mutableListOf<JSONObject>()
    private var stepCount: Int? = null

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        ensureNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            COMMAND_START -> startTracking(intent.getStringExtra(EXTRA_OPTIONS))
            COMMAND_STOP -> stopTracking(intent.getStringExtra(EXTRA_OPTIONS))
            COMMAND_STATE -> broadcastState()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopLocationUpdates()
        super.onDestroy()
    }

    private fun startTracking(optionsJson: String?) {
        val options = parseOptions(optionsJson)
        sessionId = options.optString("sessionId").takeIf { it.isNotBlank() } ?: sessionId
        fieldId = options.optString("fieldId").takeIf { it.isNotBlank() }
        stepCount = options.optInt("stepCount").takeIf { it > 0 } ?: stepCount

        val activeSession = sessionId ?: return
        startForeground(NOTIFICATION_ID, buildNotification(activeSession))
        stopLocationUpdates()

        val request = LocationRequest.Builder(5000L)
            .setMinUpdateIntervalMillis(2500L)
            .setWaitForAccurateLocation(false)
            .setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val payloadPoints = JSONArray()
                result.locations.forEach { location ->
                    val point = JSONObject()
                        .put("latitude", location.latitude)
                        .put("longitude", location.longitude)
                        .put("accuracy", location.accuracy.toDouble())
                        .put("altitude", if (location.hasAltitude()) location.altitude else JSONObject.NULL)
                        .put("timestamp", location.time)
                    recentPoints += point
                    if (recentPoints.size > 200) {
                        recentPoints.removeAt(0)
                    }
                    payloadPoints.put(point)
                }

                if (payloadPoints.length() > 0) {
                    val payload = JSONObject()
                        .put("sessionId", activeSession)
                        .put("fieldId", fieldId ?: JSONObject.NULL)
                        .put("points", payloadPoints)
                        .put("stepCount", stepCount ?: JSONObject.NULL)
                    broadcast(ACTION_TRACKING_UPDATE, payload.toString())
                }
            }
        }

        fusedLocationClient.requestLocationUpdates(
            request,
            locationCallback as LocationCallback,
            mainLooper
        )
        broadcastState()
    }

    private fun stopTracking(optionsJson: String?) {
        val options = parseOptions(optionsJson)
        stepCount = options.optInt("stepCount").takeIf { it > 0 } ?: stepCount
        stopLocationUpdates()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        broadcastState(isRecording = false)
    }

    private fun stopLocationUpdates() {
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
        }
        locationCallback = null
    }

    private fun broadcastState(isRecording: Boolean = locationCallback != null) {
        val payload = JSONObject()
            .put("sessionId", sessionId ?: "")
            .put("fieldId", fieldId ?: JSONObject.NULL)
            .put("isRecording", isRecording)
            .put("stepCount", stepCount ?: JSONObject.NULL)
            .put("points", JSONArray(recentPoints))
        broadcast(ACTION_TRACKING_STATE, payload.toString())
    }

    private fun broadcast(action: String, payload: String) {
        LocalBroadcastManager.getInstance(this).sendBroadcast(
            Intent(action).putExtra(EXTRA_PAYLOAD, payload)
        )
    }

    private fun buildNotification(activeSession: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(getString(R.string.tracking_notification_title))
            .setContentText(getString(R.string.tracking_notification_body, activeSession.takeLast(6)))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.tracking_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.tracking_channel_description)
        }
        manager.createNotificationChannel(channel)
    }

    private fun parseOptions(optionsJson: String?): JSONObject {
        return try {
            JSONObject(optionsJson ?: "{}")
        } catch (_: Exception) {
            JSONObject()
        }
    }

    companion object {
        const val COMMAND_START = "life.ikimon.shell.START_FIELD_TRACKING"
        const val COMMAND_STOP = "life.ikimon.shell.STOP_FIELD_TRACKING"
        const val COMMAND_STATE = "life.ikimon.shell.GET_FIELD_TRACKING_STATE"

        const val ACTION_TRACKING_UPDATE = "life.ikimon.shell.ACTION_TRACKING_UPDATE"
        const val ACTION_TRACKING_STATE = "life.ikimon.shell.ACTION_TRACKING_STATE"

        const val EXTRA_OPTIONS = "extra_options"
        const val EXTRA_PAYLOAD = "extra_payload"

        private const val CHANNEL_ID = "field-tracking"
        private const val NOTIFICATION_ID = 1001
    }
}
