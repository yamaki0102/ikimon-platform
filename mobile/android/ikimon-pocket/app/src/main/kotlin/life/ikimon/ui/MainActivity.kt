package life.ikimon.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import life.ikimon.pocket.FieldScanService
import life.ikimon.pocket.PocketService
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {

    companion object {
        const val ACTION_DETECTION = "life.ikimon.fieldscan.DETECTION"
        private const val PREFS_NAME = "ikimon_prefs"
        private const val KEY_LAST_DATE = "last_scan_date"
        private const val KEY_STREAK = "streak_count"
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    private val _detections = mutableStateListOf<DetectionItem>()
    private var _elapsedSeconds = mutableIntStateOf(0)
    private var _timerHandler: android.os.Handler? = null
    private var _timerRunnable: Runnable? = null

    private val detectionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent ?: return
            val name = intent.getStringExtra("taxon_name") ?: return
            val isFirst = _detections.none { it.taxonName == name }
            val item = DetectionItem(
                taxonName = name,
                scientificName = intent.getStringExtra("scientific_name") ?: "",
                confidence = intent.getFloatExtra("confidence", 0f),
                type = intent.getStringExtra("type") ?: "audio",
                taxonomicClass = intent.getStringExtra("taxonomic_class") ?: "",
                isFused = intent.getBooleanExtra("is_fused", false),
                isFirstInSession = isFirst,
            )
            _detections.add(0, item)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            IkimonTheme {
                var selectedMode by remember { mutableStateOf(ScanMode.POCKET) }
                var isActive by remember { mutableStateOf(false) }
                var summary by remember { mutableStateOf<SessionSummary?>(null) }
                val streak by remember { mutableIntStateOf(readStreak()) }

                when {
                    summary != null -> {
                        SessionSummaryScreen(
                            summary = summary!!,
                            onRestart = {
                                summary = null
                                _detections.clear()
                                _elapsedSeconds.intValue = 0
                                when (selectedMode) {
                                    ScanMode.POCKET -> startPocketMode()
                                    ScanMode.FIELD -> startFieldScan()
                                }
                                isActive = true
                                startTimer()
                            },
                            onViewRecords = {
                                summary = null
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://ikimon.life"))
                                startActivity(intent)
                            },
                        )
                    }
                    isActive -> {
                        ScanActiveScreen(
                            detections = _detections,
                            scanMode = if (selectedMode == ScanMode.FIELD) "field" else "pocket",
                            elapsedSeconds = _elapsedSeconds.intValue,
                            speciesCount = _detections.map { it.taxonName }.distinct().size,
                            onStop = {
                                when (selectedMode) {
                                    ScanMode.POCKET -> PocketService.stop(this@MainActivity)
                                    ScanMode.FIELD -> FieldScanService.stop(this@MainActivity)
                                }
                                isActive = false
                                stopTimer()
                                commitStreak()
                                summary = SessionSummary(
                                    elapsedSeconds = _elapsedSeconds.intValue,
                                    speciesCount = _detections.map { it.taxonName }.distinct().size,
                                    recordsAdded = _detections.map { it.taxonName }.distinct().size,
                                )
                            },
                        )
                    }
                    else -> {
                        HomeScreen(
                            streak = streak,
                            selectedMode = selectedMode,
                            onModeSelected = { selectedMode = it },
                            onStart = {
                                _detections.clear()
                                _elapsedSeconds.intValue = 0
                                when (selectedMode) {
                                    ScanMode.POCKET -> startPocketMode()
                                    ScanMode.FIELD -> startFieldScan()
                                }
                                isActive = true
                                startTimer()
                            },
                            onRequestPermissions = { requestPermissions() },
                        )
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        registerReceiver(detectionReceiver, IntentFilter(ACTION_DETECTION), RECEIVER_NOT_EXPORTED)
    }

    override fun onPause() {
        super.onPause()
        try { unregisterReceiver(detectionReceiver) } catch (_: Exception) {}
    }

    private fun startTimer() {
        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        val runnable = object : Runnable {
            override fun run() {
                _elapsedSeconds.intValue++
                handler.postDelayed(this, 1000)
            }
        }
        handler.postDelayed(runnable, 1000)
        _timerHandler = handler
        _timerRunnable = runnable
    }

    private fun stopTimer() {
        _timerRunnable?.let { _timerHandler?.removeCallbacks(it) }
        _timerHandler = null
        _timerRunnable = null
    }

    private fun requestPermissions() {
        permissionLauncher.launch(arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.POST_NOTIFICATIONS,
        ))
    }

    private fun startPocketMode() {
        if (!hasRequiredPermissions()) { requestPermissions(); return }
        PocketService.start(this)
    }

    private fun startFieldScan() {
        if (!hasRequiredPermissions()) { requestPermissions(); return }
        FieldScanService.start(this)
    }

    private fun hasRequiredPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    private fun readStreak(): Int {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastDate = prefs.getString(KEY_LAST_DATE, null) ?: return 0
        val streak = prefs.getInt(KEY_STREAK, 0)
        val today = todayString()
        val yesterday = yesterdayString()
        return if (lastDate == today || lastDate == yesterday) streak else 0
    }

    private fun commitStreak() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastDate = prefs.getString(KEY_LAST_DATE, null)
        val streak = prefs.getInt(KEY_STREAK, 0)
        val today = todayString()
        val yesterday = yesterdayString()
        val newStreak = when (lastDate) {
            today -> streak
            yesterday -> streak + 1
            else -> 1
        }
        prefs.edit()
            .putString(KEY_LAST_DATE, today)
            .putInt(KEY_STREAK, newStreak)
            .apply()
    }

    private fun todayString(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

    private fun yesterdayString(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            .format(Date(System.currentTimeMillis() - 86_400_000L))
}

enum class ScanMode(val label: String, val desc: String) {
    POCKET("ポケット", "ポケットに入れて\n歩くだけ"),
    FIELD("フィールドスキャン", "カメラ+音声で\n環境ごと記録"),
}

@Composable
fun HomeScreen(
    streak: Int,
    selectedMode: ScanMode,
    onModeSelected: (ScanMode) -> Unit,
    onStart: () -> Unit,
    onRequestPermissions: () -> Unit,
) {
    val green = Color(0xFF2E7D32)
    val darkBg = Color(0xFF0D1117)
    val cardBg = Color(0xFF161B22)
    val borderColor = Color(0xFF30363D)

    Surface(modifier = Modifier.fillMaxSize(), color = darkBg) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "いきものセンサー",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                if (streak > 0) {
                    Text(
                        "🔥 $streak",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFFF8F00),
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                ScanMode.entries.forEach { mode ->
                    val isSelected = selectedMode == mode
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .then(
                                if (isSelected) Modifier.border(2.dp, green, RoundedCornerShape(16.dp))
                                else Modifier.border(1.dp, borderColor, RoundedCornerShape(16.dp))
                            )
                            .background(if (isSelected) green.copy(alpha = 0.08f) else cardBg)
                            .clickable { onModeSelected(mode) }
                            .padding(16.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                mode.label,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSelected) green else Color.White,
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                mode.desc,
                                fontSize = 11.sp,
                                color = Color.White.copy(alpha = 0.45f),
                                textAlign = TextAlign.Center,
                                lineHeight = 16.sp,
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = onStart,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                colors = ButtonDefaults.buttonColors(containerColor = green),
                shape = RoundedCornerShape(16.dp),
            ) {
                Text("散歩を始める", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
fun IkimonTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF2E7D32),
            onPrimary = Color.White,
            background = Color(0xFF0D1117),
            surface = Color(0xFF161B22),
        ),
        content = content,
    )
}
