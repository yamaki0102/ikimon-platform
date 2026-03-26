package life.ikimon.pocket

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import life.ikimon.data.EnvironmentSnapshot

class SensorCollector(context: Context) : SensorEventListener {

    companion object {
        private const val TAG = "SensorCollector"
    }

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    private val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val barometer = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
    private val stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private val lightSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT)
    private val magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
    private val humiditySensor = sensorManager.getDefaultSensor(Sensor.TYPE_RELATIVE_HUMIDITY)
    private val tempSensor = sensorManager.getDefaultSensor(Sensor.TYPE_AMBIENT_TEMPERATURE)
    private val proximitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY)
    private val gravitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY)
    private val gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    // 公開状態
    var stepCount: Int = 0; private set
    var pressure: Float = 0f; private set
    var isStationary: Boolean = false; private set
    var lightLux: Float = 0f; private set
    var magneticField: Float = 0f; private set
    var magneticX: Float = 0f; private set
    var magneticY: Float = 0f; private set
    var magneticZ: Float = 0f; private set
    var humidity: Float = 0f; private set
    var temperature: Float = Float.NaN; private set
    var proximityNear: Boolean = false; private set
    var gravityMagnitude: Float = 9.81f; private set
    var gyroX: Float = 0f; private set
    var gyroY: Float = 0f; private set
    var gyroZ: Float = 0f; private set

    // 加速度の移動平均
    private val accelHistory = mutableListOf<Float>()
    private val accelWindowSize = 20

    // 環境ログ（定期記録用）
    private val envHistory = mutableListOf<EnvironmentSnapshot>()
    private var lastEnvLogTime = 0L
    private val envLogIntervalMs = 60_000L // 1分ごと

    // 利用可能センサーのリスト
    val availableSensors = mutableListOf<String>()

    fun start() {
        val sensors = listOf(
            accelerometer to "accelerometer",
            barometer to "barometer",
            stepCounter to "step_counter",
            lightSensor to "light",
            magnetometer to "magnetometer",
            humiditySensor to "humidity",
            tempSensor to "temperature",
            proximitySensor to "proximity",
            gravitySensor to "gravity",
            gyroscope to "gyroscope",
        )

        for ((sensor, name) in sensors) {
            if (sensor != null) {
                sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                availableSensors.add(name)
            }
        }

        Log.i(TAG, "Sensors started: ${availableSensors.joinToString(", ")}")
        Log.i(TAG, "Missing sensors: ${sensors.filter { it.first == null }.map { it.second }}")
    }

    fun stop() {
        sensorManager.unregisterListener(this)
        Log.i(TAG, "Sensor collection stopped. Steps: $stepCount, env logs: ${envHistory.size}")
    }

    fun getSnapshot(
        soundDbA: Float? = null,
        soundFreqLow: Float? = null,
        soundFreqMid: Float? = null,
        soundFreqHigh: Float? = null,
        soundBiophonyIndex: Float? = null,
        lat: Double? = null,
        lng: Double? = null,
        altitudeM: Double? = null,
        gpsAccuracyM: Float? = null,
        speedKmh: Float? = null,
    ): EnvironmentSnapshot {
        val heading = if (magneticX != 0f || magneticY != 0f) {
            val deg = Math.toDegrees(Math.atan2(magneticY.toDouble(), magneticX.toDouble())).toFloat()
            if (deg < 0) deg + 360f else deg
        } else null

        return EnvironmentSnapshot(
            pressureHpa = if (pressure > 0) pressure else null,
            temperatureC = if (!temperature.isNaN()) temperature else null,
            humidityPercent = if (humidity > 0) humidity else null,
            lightLux = if (lightLux >= 0) lightLux else null,
            magneticFieldUt = if (magneticField > 0) magneticField else null,
            magneticHeadingDeg = heading,
            proximityNear = proximityNear,
            gravityMagnitude = gravityMagnitude,
            gyroX = gyroX,
            gyroY = gyroY,
            gyroZ = gyroZ,
            isStationary = isStationary,
            stepCount = stepCount,
            speedKmh = speedKmh,
            altitudeM = altitudeM,
            gpsAccuracyM = gpsAccuracyM,
            soundDbA = soundDbA,
            soundFreqLow = soundFreqLow,
            soundFreqMid = soundFreqMid,
            soundFreqHigh = soundFreqHigh,
            soundBiophonyIndex = soundBiophonyIndex,
        )
    }

    fun maybeLogEnvironment(snapshot: EnvironmentSnapshot) {
        val now = System.currentTimeMillis()
        if (now - lastEnvLogTime >= envLogIntervalMs) {
            envHistory.add(snapshot)
            lastEnvLogTime = now
            Log.d(TAG, "Env logged (#${envHistory.size}): " +
                "light=${snapshot.lightLux}lx, " +
                "pressure=${snapshot.pressureHpa}hPa, " +
                "temp=${snapshot.temperatureC}°C, " +
                "humidity=${snapshot.humidityPercent}%, " +
                "dB=${snapshot.soundDbA}")
        }
    }

    fun getEnvHistory(): List<EnvironmentSnapshot> = envHistory.toList()
    fun clearEnvHistory() { envHistory.clear() }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val magnitude = Math.sqrt(
                    (event.values[0] * event.values[0] +
                     event.values[1] * event.values[1] +
                     event.values[2] * event.values[2]).toDouble()
                ).toFloat()
                accelHistory.add(magnitude)
                if (accelHistory.size > accelWindowSize) accelHistory.removeAt(0)
                if (accelHistory.size >= accelWindowSize) {
                    val mean = accelHistory.average().toFloat()
                    val variance = accelHistory.map { (it - mean) * (it - mean) }.average()
                    isStationary = variance < 0.5
                }
            }
            Sensor.TYPE_PRESSURE -> pressure = event.values[0]
            Sensor.TYPE_STEP_COUNTER -> stepCount = event.values[0].toInt()
            Sensor.TYPE_LIGHT -> lightLux = event.values[0]
            Sensor.TYPE_MAGNETIC_FIELD -> {
                magneticX = event.values[0]
                magneticY = event.values[1]
                magneticZ = event.values[2]
                magneticField = Math.sqrt(
                    (magneticX * magneticX + magneticY * magneticY + magneticZ * magneticZ).toDouble()
                ).toFloat()
            }
            Sensor.TYPE_RELATIVE_HUMIDITY -> humidity = event.values[0]
            Sensor.TYPE_AMBIENT_TEMPERATURE -> temperature = event.values[0]
            Sensor.TYPE_PROXIMITY -> {
                proximityNear = event.values[0] < (event.sensor.maximumRange / 2)
            }
            Sensor.TYPE_GRAVITY -> {
                gravityMagnitude = Math.sqrt(
                    (event.values[0] * event.values[0] +
                     event.values[1] * event.values[1] +
                     event.values[2] * event.values[2]).toDouble()
                ).toFloat()
            }
            Sensor.TYPE_GYROSCOPE -> {
                gyroX = event.values[0]
                gyroY = event.values[1]
                gyroZ = event.values[2]
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
