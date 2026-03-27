package life.ikimon.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
import life.ikimon.data.DetectionEvent
import life.ikimon.pocket.PocketService
import life.ikimon.pocket.VisualDetector
import life.ikimon.voice.VoiceAssistant

class MainActivity : ComponentActivity() {

    private val TAG = "MainActivity"
    private var visualDetector: VisualDetector? = null
    private var visualDetectionLog = mutableListOf<String>()
    private var isVisualRunning = false
    private var voiceAssistant: VoiceAssistant? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        voiceAssistant = VoiceAssistant(this)

        visualDetector = VisualDetector(this)
        visualDetector?.setCallback { result ->
            // 共有EventBufferに入れる（PocketServiceと同じバッファ）
            val event = DetectionEvent(
                type = "visual",
                taxonName = result.category,
                scientificName = "",
                confidence = result.confidence,
                lat = null,
                lng = null,
                timestamp = System.currentTimeMillis(),
                model = "mlkit_image_labeling_v1",
            )
            PocketService.sharedEventBuffer.add(event)
            voiceAssistant?.conversationContext?.addDetection(event)

            val logEntry = "${result.category} (${result.rawLabel}) ${(result.confidence * 100).toInt()}%" +
                (result.detailLabel?.let { " [$it]" } ?: "")
            synchronized(visualDetectionLog) {
                visualDetectionLog.add(0, logEntry)
                if (visualDetectionLog.size > 30) visualDetectionLog.removeAt(visualDetectionLog.lastIndex)
            }
            Log.i(TAG, "Visual: $logEntry")
        }

        setContent {
            IkimonTheme {
                Box(modifier = Modifier.fillMaxSize()) {
                    BioScanScreen(
                        onStartScan = { startBioScan() },
                        onStopScan = { stopBioScan() },
                        visualDetectionLog = visualDetectionLog,
                    )
                    VoiceFab(
                        voiceAssistant = voiceAssistant,
                        modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        voiceAssistant?.destroy()
        visualDetector?.stop()
        super.onDestroy()
    }

    private fun requestPermissions() {
        permissionLauncher.launch(arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.POST_NOTIFICATIONS,
            Manifest.permission.CAMERA,
        ))
    }

    /**
     * BioScan開始 = 音声+センサー(Service) + カメラ視覚検出(Activity) 同時起動
     */
    private fun startBioScan() {
        if (!hasRequiredPermissions()) {
            requestPermissions()
            return
        }
        PocketService.start(this)
        visualDetector?.startWithCamera(this)
        isVisualRunning = true
    }

    private fun stopBioScan() {
        PocketService.stop(this)
        visualDetector?.stop()
        isVisualRunning = false
    }

    private fun hasRequiredPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }
}

@Composable
fun BioScanScreen(
    onStartScan: () -> Unit,
    onStopScan: () -> Unit,
    visualDetectionLog: List<String>,
) {
    var isActive by remember { mutableStateOf(PocketService.isActive) }
    var stats by remember { mutableStateOf(PocketService.currentStats) }

    LaunchedEffect(isActive) {
        while (isActive) {
            stats = PocketService.currentStats
            isActive = PocketService.isActive
            delay(2000)
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(20.dp))

            Text("🔬", fontSize = 36.sp)
            Text("ikimon BioScan", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text("v0.6.0-experimental", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

            Spacer(modifier = Modifier.height(16.dp))

            // === スキャン開始/停止 ===
            Button(
                onClick = {
                    if (isActive) { onStopScan(); isActive = false }
                    else { onStartScan(); isActive = true }
                },
                modifier = Modifier.fillMaxWidth().height(64.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isActive) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary
                ),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        if (isActive) "⏹ BioScan 停止" else "🔬 BioScan 開始",
                        fontSize = 18.sp, fontWeight = FontWeight.Bold,
                    )
                    Text(
                        if (isActive) "音声+カメラ+全センサー稼働中"
                        else "カメラ・音声・全センサーで環境をスキャン",
                        fontSize = 11.sp,
                    )
                }
            }

            if (isActive) {
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(Color(0xFF4CAF50)))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("BioScan稼働中 — ${stats.durationMinutes}分",
                        fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color(0xFF4CAF50))
                }

                Spacer(modifier = Modifier.height(8.dp))

                // 検出サマリー
                DashboardCard(title = "🐦 検出") {
                    StatRow("検出カテゴリ数", "${stats.speciesCount}")
                    StatRow("総検出数", "${stats.totalDetections}件")
                    if (stats.lastSpecies.isNotEmpty() && stats.lastSpecies != "ambient") {
                        StatRow("最新", stats.lastSpecies)
                    }
                }

                // ビジュアル検出ログ
                if (visualDetectionLog.isNotEmpty()) {
                    DashboardCard(title = "📷 視覚検出") {
                        for (entry in visualDetectionLog.take(8)) {
                            Text("• $entry", fontSize = 11.sp)
                        }
                    }
                }

                // 移動
                DashboardCard(title = "🚶 移動") {
                    StatRow("距離", "%.0fm".format(stats.distanceMeters))
                    StatRow("歩数", "${stats.stepCount}歩")
                    StatRow("速度", "%.1fkm/h".format(stats.speedKmh))
                }

                // サウンドスケープ
                DashboardCard(title = "🔊 サウンドスケープ") {
                    StatRow("音量", "%.1f dB".format(stats.soundDbA))
                    StatRow("生物音指標", "%.3f".format(stats.biophonyIndex))
                }

                // 環境
                DashboardCard(title = "🌡️ 環境") {
                    StatRow("照度", "%.0f lux".format(stats.lightLux))
                    StatRow("気圧", "%.1f hPa".format(stats.pressureHpa))
                    if (!stats.temperatureC.isNaN()) StatRow("気温", "%.1f°C".format(stats.temperatureC))
                    if (stats.humidityPercent > 0) StatRow("湿度", "%.0f%%".format(stats.humidityPercent))
                    if (stats.magneticHeading > 0) StatRow("方位", "%.0f°".format(stats.magneticHeading))
                }

                // 通信
                DashboardCard(title = "📡 通信") {
                    StatRow("送信バッチ", "${stats.uploadedBatches}回")
                    StatRow("バッファ", "${stats.pendingEvents}件")
                }

                // 利用センサー
                if (stats.availableSensors.isNotEmpty()) {
                    DashboardCard(title = "📱 センサー (${stats.availableSensors.size})") {
                        Text(stats.availableSensors.joinToString(", "),
                            fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                Spacer(modifier = Modifier.height(16.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("🧪 実験版 v0.6.0", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "手に持って周囲をスキャン。止めるまで永遠に動く。\n\n" +
                            "📷 カメラ → ML Kit で生物の存在を検出\n" +
                            "  （同定なし。鳥類/昆虫類/植物等の大分類のみ）\n" +
                            "🎧 マイク → BirdNET推論 + サウンドスケープ分析\n" +
                            "📍 GPS → 位置・速度・標高・精度\n" +
                            "📱 全センサー → 光・気圧・磁気・近接・重力・ジャイロ\n" +
                            "📤 1分ごとにサーバー送信",
                            fontSize = 12.sp, lineHeight = 18.sp,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@Composable
fun DashboardCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(10.dp),
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Spacer(modifier = Modifier.height(3.dp))
            content()
        }
    }
}

@Composable
fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 1.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun VoiceFab(voiceAssistant: VoiceAssistant?, modifier: Modifier = Modifier) {
    if (voiceAssistant == null) return

    var assistantState by remember { mutableStateOf(VoiceAssistant.State.IDLE) }
    var partialText by remember { mutableStateOf("") }
    var lastReply by remember { mutableStateOf("") }
    var showReply by remember { mutableStateOf(false) }

    LaunchedEffect(voiceAssistant) {
        voiceAssistant.onStateChanged = { assistantState = it }
        voiceAssistant.onPartialText = { partialText = it }
        voiceAssistant.onReply = { reply ->
            lastReply = reply
            showReply = true
        }
        voiceAssistant.onError = { error ->
            lastReply = error
            showReply = true
        }
    }

    // Auto-hide reply after 8 seconds
    LaunchedEffect(showReply, lastReply) {
        if (showReply) {
            delay(8000)
            showReply = false
        }
    }

    Column(modifier = modifier, horizontalAlignment = Alignment.End) {
        // Reply bubble
        if (showReply && lastReply.isNotBlank()) {
            Card(
                modifier = Modifier.widthIn(max = 280.dp).padding(bottom = 8.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1B5E20)),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(
                    lastReply,
                    modifier = Modifier.padding(12.dp),
                    color = Color.White,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                )
            }
        }

        // Partial recognition text
        if (assistantState == VoiceAssistant.State.LISTENING && partialText.isNotBlank()) {
            Card(
                modifier = Modifier.widthIn(max = 240.dp).padding(bottom = 8.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0)),
                shape = RoundedCornerShape(8.dp),
            ) {
                Text(
                    partialText,
                    modifier = Modifier.padding(8.dp),
                    fontSize = 12.sp,
                    color = Color(0xFF5D4037),
                )
            }
        }

        // FAB
        val fabColor = when (assistantState) {
            VoiceAssistant.State.IDLE -> Color(0xFF2E7D32)
            VoiceAssistant.State.LISTENING -> Color(0xFFE53935)
            VoiceAssistant.State.THINKING -> Color(0xFFFFA726)
            VoiceAssistant.State.SPEAKING -> Color(0xFF1565C0)
        }
        val fabIcon = when (assistantState) {
            VoiceAssistant.State.IDLE -> "🎤"
            VoiceAssistant.State.LISTENING -> "⏺"
            VoiceAssistant.State.THINKING -> "💭"
            VoiceAssistant.State.SPEAKING -> "🔊"
        }
        val fabLabel = when (assistantState) {
            VoiceAssistant.State.IDLE -> "質問する"
            VoiceAssistant.State.LISTENING -> "聴いてるよ..."
            VoiceAssistant.State.THINKING -> "考え中..."
            VoiceAssistant.State.SPEAKING -> "話し中"
        }

        FloatingActionButton(
            onClick = {
                when (assistantState) {
                    VoiceAssistant.State.IDLE -> voiceAssistant.startListening()
                    VoiceAssistant.State.SPEAKING -> voiceAssistant.stopSpeaking()
                    else -> voiceAssistant.cancel()
                }
            },
            containerColor = fabColor,
            contentColor = Color.White,
            shape = CircleShape,
            modifier = Modifier.size(64.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(fabIcon, fontSize = 22.sp)
                Text(fabLabel, fontSize = 8.sp, color = Color.White.copy(alpha = 0.9f))
            }
        }
    }
}

@Composable
fun IkimonTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(
        primary = Color(0xFF2E7D32),
        onPrimary = Color.White,
        primaryContainer = Color(0xFFE8F5E9),
        surfaceVariant = Color(0xFFF5F5F5),
    ), content = content)
}
