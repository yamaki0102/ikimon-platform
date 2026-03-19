package life.ikimon.pocket

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log

/**
 * センサー収集（加速度 + 気圧）
 * 歩行パターンの検出と標高変化の記録。
 */
class SensorCollector(context: Context) : SensorEventListener {

    companion object {
        private const val TAG = "SensorCollector"
    }

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val barometer = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
    private val stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    // 状態
    var stepCount: Int = 0; private set
    var pressure: Float = 0f; private set
    var isStationary: Boolean = false; private set

    // 加速度の移動平均（静止検出用）
    private val accelHistory = mutableListOf<Float>()
    private val accelWindowSize = 20

    fun start() {
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        barometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        stepCounter?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        Log.i(TAG, "Sensor collection started")
    }

    fun stop() {
        sensorManager.unregisterListener(this)
        Log.i(TAG, "Sensor collection stopped. Steps: $stepCount")
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val magnitude = Math.sqrt(
                    (event.values[0] * event.values[0] +
                     event.values[1] * event.values[1] +
                     event.values[2] * event.values[2]).toDouble()
                ).toFloat()

                accelHistory.add(magnitude)
                if (accelHistory.size > accelWindowSize) {
                    accelHistory.removeAt(0)
                }

                // 静止判定: 加速度の分散が小さい → 静止
                if (accelHistory.size >= accelWindowSize) {
                    val mean = accelHistory.average().toFloat()
                    val variance = accelHistory.map { (it - mean) * (it - mean) }.average()
                    isStationary = variance < 0.5
                }
            }
            Sensor.TYPE_PRESSURE -> {
                pressure = event.values[0]
            }
            Sensor.TYPE_STEP_COUNTER -> {
                stepCount = event.values[0].toInt()
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
