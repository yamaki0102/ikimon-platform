package life.ikimon.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
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

class MainActivity : ComponentActivity() {

    companion object {
        const val ACTION_DETECTION = "life.ikimon.bioscan.DETECTION"
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    // リアルタイム検出リスト（UIに反映される）
    private val _detections = mutableStateListOf<DetectionItem>()
    private var _elapsedSeconds = mutableIntStateOf(0)
    private var _timerHandler: android.os.Handler? = null
    private var _timerRunnable: Runnable? = null

    private val detectionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent ?: return
            val item = DetectionItem(
                taxonName = intent.getStringExtra("taxon_name") ?: return,
                scientificName = intent.getStringExtra("scientific_name") ?: "",
                confidence = intent.getFloatExtra("confidence", 0f),
                type = intent.getStringExtra("type") ?: "audio",
                taxonomicClass = intent.getStringExtra("taxonomic_class") ?: "",
                isFused = intent.getBooleanExtra("is_fused", false),
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

                if (isActive) {
                    ScanActiveScreen(
                        detections = _detections,
                        scanMode = if (selectedMode == ScanMode.FIELD) "field" else "pocket",
                        elapsedSeconds = _elapsedSeconds.intValue,
                        speciesCount = _detections.map { it.scientificName }.distinct().size,
                        onStop = {
                            when (selectedMode) {
                                ScanMode.POCKET -> PocketService.stop(this@MainActivity)
                                ScanMode.FIELD -> FieldScanService.stop(this@MainActivity)
                            }
                            isActive = false
                            stopTimer()
                        },
                    )
                } else {
                    HomeScreen(
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
                        lastSessionCount = _detections.size,
                    )
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
}

enum class ScanMode(val label: String, val emoji: String, val desc: String) {
    POCKET("ポケット", "🎧", "ポケットに入れて散歩\n音声AIが自動で検出"),
    FIELD("フィールドスキャン", "🔭", "Triple AI Engine\n音声+視覚+環境分析"),
}

@Composable
fun HomeScreen(
    selectedMode: ScanMode,
    onModeSelected: (ScanMode) -> Unit,
    onStart: () -> Unit,
    onRequestPermissions: () -> Unit,
    lastSessionCount: Int,
) {
    val green = Color(0xFF2E7D32)
    val darkBg = Color(0xFF0D1117)
    val cardBg = Color(0xFF161B22)
    val borderColor = Color(0xFF30363D)

    Surface(modifier = Modifier.fillMaxSize(), color = darkBg) {
        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            Text("🌿", fontSize = 40.sp)
            Spacer(modifier = Modifier.height(4.dp))
            Text("ikimon BioScan", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text("BirdNET+ V3.0 · Gemini Nano v3", fontSize = 11.sp, color = Color.White.copy(alpha = 0.4f))

            Spacer(modifier = Modifier.height(32.dp))

            // モード選択
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
                            .background(if (isSelected) green.copy(alpha = 0.1f) else cardBg)
                            .clickable { onModeSelected(mode) }
                            .padding(16.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(mode.emoji, fontSize = 28.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(mode.label, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                                color = if (isSelected) green else Color.White)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(mode.desc, fontSize = 11.sp, color = Color.White.copy(alpha = 0.5f),
                                textAlign = TextAlign.Center, lineHeight = 15.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // スタートボタン
            Button(
                onClick = onStart,
                modifier = Modifier.fillMaxWidth().height(64.dp),
                colors = ButtonDefaults.buttonColors(containerColor = green),
                shape = RoundedCornerShape(16.dp),
            ) {
                Text("▶ スキャン開始", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
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
