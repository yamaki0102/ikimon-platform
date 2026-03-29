package life.ikimon.ui

import android.Manifest
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import life.ikimon.pocket.FieldScanService
import life.ikimon.pocket.PocketService

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            IkimonTheme {
                HomeScreen(
                    onStartPocket = { startPocketMode() },
                    onStopPocket = { stopPocketMode() },
                    onStartFieldScan = { startFieldScan() },
                    onStopFieldScan = { stopFieldScan() },
                    onRequestPermissions = { requestPermissions() },
                )
            }
        }
    }

    private fun requestPermissions() {
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA,
                Manifest.permission.POST_NOTIFICATIONS,
            )
        )
    }

    private fun startPocketMode() {
        if (!hasRequiredPermissions()) { requestPermissions(); return }
        PocketService.start(this)
    }

    private fun stopPocketMode() { PocketService.stop(this) }

    private fun startFieldScan() {
        if (!hasRequiredPermissions()) { requestPermissions(); return }
        FieldScanService.start(this)
    }

    private fun stopFieldScan() { FieldScanService.stop(this) }

    private fun hasRequiredPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }
}

enum class ScanMode(val label: String, val emoji: String, val desc: String) {
    POCKET("ポケット", "🎧", "ポケットに入れて散歩\n音声AIが自動で検出"),
    FIELD("フィールドスキャン", "🔭", "端末を手に持って探索\n音声 + カメラで記録"),
}

@Composable
fun HomeScreen(
    onStartPocket: () -> Unit,
    onStopPocket: () -> Unit,
    onStartFieldScan: () -> Unit,
    onStopFieldScan: () -> Unit,
    onRequestPermissions: () -> Unit,
) {
    var selectedMode by remember { mutableStateOf(ScanMode.POCKET) }
    var isActive by remember { mutableStateOf(false) }

    val green = Color(0xFF2E7D32)
    val darkBg = Color(0xFF0D1117)
    val cardBg = Color(0xFF161B22)
    val borderColor = Color(0xFF30363D)

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = darkBg,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            // Header
            Text("🌿", fontSize = 40.sp)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                "ikimon BioScan",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            Text(
                "BirdNET+ V3.0 · 11,560 species",
                fontSize = 11.sp,
                color = Color.White.copy(alpha = 0.4f),
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Mode selector
            if (!isActive) {
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
                                    if (isSelected)
                                        Modifier.border(2.dp, green, RoundedCornerShape(16.dp))
                                    else
                                        Modifier.border(1.dp, borderColor, RoundedCornerShape(16.dp))
                                )
                                .background(if (isSelected) green.copy(alpha = 0.1f) else cardBg)
                                .clickable { selectedMode = mode }
                                .padding(16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(mode.emoji, fontSize = 28.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    mode.label,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) green else Color.White,
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    mode.desc,
                                    fontSize = 11.sp,
                                    color = Color.White.copy(alpha = 0.5f),
                                    textAlign = TextAlign.Center,
                                    lineHeight = 15.sp,
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Active state card
            if (isActive) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            "${selectedMode.emoji} ${selectedMode.label}モード",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "🟢 記録中 — BirdNET+ V3.0",
                            fontSize = 13.sp,
                            color = green,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            when (selectedMode) {
                                ScanMode.POCKET -> "環境音をモニタリングしています\nスマホをポケットに入れて散歩を楽しんでください"
                                ScanMode.FIELD -> "🎧 BirdNET+ V3.0 — 11,560種 音声AI\n📷 Gemini Nano v3 — 視覚AI\n🌡️ 環境自動分析"
                            },
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.6f),
                            textAlign = TextAlign.Center,
                            lineHeight = 18.sp,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Start / Stop button
            Button(
                onClick = {
                    if (isActive) {
                        when (selectedMode) {
                            ScanMode.POCKET -> onStopPocket()
                            ScanMode.FIELD -> onStopFieldScan()
                        }
                        isActive = false
                    } else {
                        when (selectedMode) {
                            ScanMode.POCKET -> onStartPocket()
                            ScanMode.FIELD -> onStartFieldScan()
                        }
                        isActive = true
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isActive) Color(0xFFD32F2F) else green,
                ),
                shape = RoundedCornerShape(16.dp),
            ) {
                Text(
                    if (isActive) "⏹ 停止" else "▶ スキャン開始",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
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
