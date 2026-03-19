package life.ikimon.pocket

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.*

/**
 * GPS 位置追跡
 * FusedLocationProvider で省電力かつ高精度な位置取得。
 */
class LocationTracker(private val context: Context) {

    companion object {
        private const val TAG = "LocationTracker"
    }

    private val client = LocationServices.getFusedLocationProviderClient(context)
    private var callback: LocationCallback? = null

    var lastLocation: Location? = null
        private set

    // ルート記録
    private val routePoints = mutableListOf<RoutePoint>()

    data class RoutePoint(
        val lat: Double,
        val lng: Double,
        val altitude: Double,
        val timestamp: Long,
    )

    @SuppressLint("MissingPermission")
    fun startTracking(intervalMs: Long, onLocation: (Location) -> Unit) {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateDistanceMeters(5f) // 5m以上動いた時だけ更新
            .setWaitForAccurateLocation(false)
            .build()

        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                lastLocation = location
                routePoints.add(RoutePoint(
                    lat = location.latitude,
                    lng = location.longitude,
                    altitude = location.altitude,
                    timestamp = System.currentTimeMillis(),
                ))
                onLocation(location)
                Log.d(TAG, "Location: ${location.latitude}, ${location.longitude} (±${location.accuracy}m)")
            }
        }

        client.requestLocationUpdates(request, callback!!, Looper.getMainLooper())
        Log.i(TAG, "Location tracking started (interval: ${intervalMs}ms)")
    }

    fun stopTracking() {
        callback?.let { client.removeLocationUpdates(it) }
        callback = null
        Log.i(TAG, "Location tracking stopped. Route points: ${routePoints.size}")
    }

    /**
     * ルートの総距離（メートル）を計算。
     */
    fun getTotalDistanceMeters(): Float {
        if (routePoints.size < 2) return 0f
        var total = 0f
        for (i in 1 until routePoints.size) {
            val results = FloatArray(1)
            Location.distanceBetween(
                routePoints[i - 1].lat, routePoints[i - 1].lng,
                routePoints[i].lat, routePoints[i].lng,
                results,
            )
            total += results[0]
        }
        return total
    }

    /**
     * 標高差（メートル）を取得。
     */
    fun getElevationChange(): Double {
        if (routePoints.size < 2) return 0.0
        val min = routePoints.minOf { it.altitude }
        val max = routePoints.maxOf { it.altitude }
        return max - min
    }

    fun getRoutePoints(): List<RoutePoint> = routePoints.toList()
}
