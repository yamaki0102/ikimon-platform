package life.ikimon.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.compose.foundation.rememberScrollState
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import life.ikimon.api.AppAuthManager
import life.ikimon.api.AppLoginState
import life.ikimon.api.ImmediateUploadDrainer
import life.ikimon.api.InstallIdentityManager
import life.ikimon.api.MobileApiConfig
import life.ikimon.api.SessionRecapClient
import life.ikimon.api.UploadStatusSnapshot
import life.ikimon.api.UploadStatusStore
import life.ikimon.data.DetectionEvent
import life.ikimon.data.EventBuffer
import life.ikimon.pocket.AudioSnippetStore
import life.ikimon.pocket.FieldScanService
import life.ikimon.pocket.FieldSessionCoordinator
import life.ikimon.pocket.PocketService
import life.ikimon.pocket.VisionClassifier
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    companion object {
        const val ACTION_DETECTION = "life.ikimon.fieldscan.DETECTION"
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    // リアルタイム検出リスト（UIに反映される）
    private val _detections = mutableStateListOf<DetectionItem>()
    private var _elapsedSeconds = mutableIntStateOf(0)
    private var _uploadStatus = mutableStateOf(UploadStatusSnapshot())
    private var _loginState = mutableStateOf(AppLoginState())
    private var _timerHandler: android.os.Handler? = null
    private var _timerRunnable: Runnable? = null
    private var _lastSummary = mutableStateOf<EventBuffer.Summary?>(null)
    private var _showResultSheet = mutableStateOf(false)
    private var _sessionRecap = mutableStateOf<SessionRecapClient.RecapResult?>(null)
    private var currentMovementMode: String = "walk"
    private var visionClassifier: VisionClassifier? = null
    private var visionReady = false
    private var lastVisionAt = 0L
    private var lastEnvAt = 0L
    private var tts: TextToSpeech? = null

    private val detectionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent ?: return
            val item = DetectionItem(
                taxonName = intent.getStringExtra("taxon_name") ?: return,
                scientificName = intent.getStringExtra("scientific_name") ?: "",
                confidence = intent.getFloatExtra("confidence", 0f),
                type = intent.getStringExtra("type") ?: "audio",
                taxonomicClass = intent.getStringExtra("taxonomic_class") ?: "",
                taxonRank = intent.getStringExtra("taxon_rank") ?: "species",
                sceneDigest = intent.getStringExtra("scene_digest") ?: "",
                modelBaseName = intent.getStringExtra("model_base_name") ?: "",
                isFused = intent.getBooleanExtra("is_fused", false),
            )
            _detections.add(0, item)
            if (currentMovementMode == "vehicle" && item.sceneDigest.isNotBlank()) {
                speakDriveCue(item.sceneDigest)
            }
        }
    }

    private val uploadStatusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            _uploadStatus.value = UploadStatusStore.snapshot(this@MainActivity)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.JAPAN
            }
        }
        InstallIdentityManager.getOrCreateInstallId(this)
        _uploadStatus.value = UploadStatusStore.snapshot(this)
        _loginState.value = AppAuthManager.currentState(this)
        handleRuntimeConfigIntent(intent)
        handleAuthIntent(intent)

        setContent {
            IkimonTheme {
                var selectedMode by remember { mutableStateOf(ScanMode.FIELD) }
                var fieldSessionIntent by remember { mutableStateOf(FieldSessionIntent.OFFICIAL) }
                var fieldTestLevel by remember { mutableStateOf(FieldTestLevel.STANDARD) }
                var movementMode by remember { mutableStateOf(MovementMode.WALK) }
                var isActive by remember { mutableStateOf(false) }
                var showAudioReview by remember { mutableStateOf(false) }
                var pendingSnippets by remember { mutableStateOf(listOf<AudioSnippetStore.Snippet>()) }
                val showResultSheet by _showResultSheet
                val lastSummary by _lastSummary
                val sessionRecap by _sessionRecap

                LaunchedEffect(showResultSheet) {
                    if (showResultSheet) {
                        pendingSnippets = withContext(Dispatchers.IO) {
                            AudioSnippetStore.listPending(this@MainActivity)
                        }
                    }
                }

                if (showAudioReview) {
                    AudioReviewPanel(
                        snippets = pendingSnippets,
                        onConfirm = { snippet: AudioSnippetStore.Snippet, _: String, _: String ->
                            pendingSnippets = pendingSnippets.filter { it.id != snippet.id }
                            kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                                AudioSnippetStore.confirm(this@MainActivity, snippet.id)
                            }
                        },
                        onSkip = { snippet: AudioSnippetStore.Snippet ->
                            pendingSnippets = pendingSnippets.filter { it.id != snippet.id }
                            kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                                AudioSnippetStore.skip(this@MainActivity, snippet.id)
                            }
                        },
                        onDone = { showAudioReview = false },
                    )
                } else if (showResultSheet && lastSummary != null) {
                    ScanResultSheet(
                        summary = lastSummary!!,
                        uploadStatus = _uploadStatus.value,
                        pendingAudioCount = pendingSnippets.size,
                        recap = sessionRecap,
                        onReviewAudio = { showAudioReview = true },
                        onDismiss = {
                            _showResultSheet.value = false
                            _lastSummary.value = null
                            _sessionRecap.value = null
                        },
                    )
                } else if (isActive) {
                    ScanActiveScreen(
                        detections = _detections,
                        scanMode = if (selectedMode == ScanMode.FIELD) "field" else "pocket",
                        movementMode = movementMode.key,
                        loginState = _loginState.value,
                        uploadStatus = _uploadStatus.value,
                        elapsedSeconds = _elapsedSeconds.intValue,
                        speciesCount = _detections.map { it.scientificName }.distinct().size,
                        onCameraFrame = { bitmap ->
                            if (selectedMode == ScanMode.FIELD) {
                                handleCameraFrame(bitmap, movementMode.key)
                            }
                        },
                        onRepeatPulse = { repeatLatestPulse() },
                        onStop = {
                            stopTimer()
                            when (selectedMode) {
                                ScanMode.POCKET -> PocketService.stop(this@MainActivity)
                                ScanMode.FIELD -> FieldScanService.stop(this@MainActivity)
                            }
                            isActive = false
                            val durationSec = _elapsedSeconds.intValue
                            val detectionsSnapshot = _detections.toList()
                            val audioCount = _detections.count { it.type == "audio" }
                            val visualCount = _detections.count { it.type == "visual" }
                            val isOfficial = fieldSessionIntent == FieldSessionIntent.OFFICIAL
                            _lastSummary.value = EventBuffer.Summary(
                                totalDetections = _detections.size,
                                speciesCount = _detections.map { it.scientificName }.distinct().size,
                                speciesNames = _detections.map { it.taxonName }.distinct(),
                                durationMinutes = durationSec / 60,
                                durationSeconds = durationSec,
                                audioDetections = audioCount,
                                visualDetections = visualCount,
                                sessionIntent = if (isOfficial) "official" else "test",
                                officialRecord = isOfficial,
                                testProfile = if (!isOfficial) fieldTestLevel.profileKey else "field",
                            )
                            _showResultSheet.value = true
                            kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                                val recap = SessionRecapClient.fetch(
                                    context = this@MainActivity,
                                    sessionId = FieldSessionCoordinator.currentSessionId(),
                                    detections = detectionsSnapshot,
                                    durationSec = durationSec,
                                    lat = null,
                                    lng = null,
                                    movementMode = movementMode.key,
                                )
                                withContext(Dispatchers.Main) {
                                    _sessionRecap.value = recap
                                }
                            }
                        },
                    )
                } else {
                    HomeScreen(
                        selectedMode = selectedMode,
                        onModeSelected = { selectedMode = it },
                        fieldSessionIntent = fieldSessionIntent,
                        onFieldSessionIntentSelected = { fieldSessionIntent = it },
                        fieldTestLevel = fieldTestLevel,
                        onFieldTestLevelSelected = { fieldTestLevel = it },
                        movementMode = movementMode,
                        onMovementModeSelected = { movementMode = it },
                        onStart = {
                            _detections.clear()
                            _sessionRecap.value = null
                            _elapsedSeconds.intValue = 0
                            when (selectedMode) {
                                ScanMode.POCKET -> startPocketMode()
                                ScanMode.FIELD -> startFieldScan(fieldSessionIntent, fieldTestLevel, movementMode)
                            }
                            isActive = true
                            startTimer()
                        },
                        onRequestPermissions = { requestPermissions() },
                        loginState = _loginState.value,
                        onLoginStateChanged = { _loginState.value = AppAuthManager.currentState(this@MainActivity) },
                        uploadStatus = _uploadStatus.value,
                        onRetryPendingUploads = {
                            val retryScope = kotlinx.coroutines.CoroutineScope(Dispatchers.IO)
                            retryScope.launch {
                                ImmediateUploadDrainer.drain(this@MainActivity)
                                withContext(Dispatchers.Main) {
                                    _uploadStatus.value = UploadStatusStore.snapshot(this@MainActivity)
                                }
                            }
                        },
                        lastSessionCount = _detections.size,
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        registerReceiver(detectionReceiver, IntentFilter(ACTION_DETECTION), RECEIVER_NOT_EXPORTED)
        registerReceiver(uploadStatusReceiver, IntentFilter(UploadStatusStore.ACTION_STATUS_CHANGED), RECEIVER_NOT_EXPORTED)
        val snapshot = UploadStatusStore.snapshot(this)
        if (snapshot.isOnline) {
            val drainScope = kotlinx.coroutines.CoroutineScope(Dispatchers.IO)
            drainScope.launch {
                ImmediateUploadDrainer.drain(this@MainActivity)
                withContext(Dispatchers.Main) {
                    _uploadStatus.value = UploadStatusStore.snapshot(this@MainActivity)
                }
            }
        }
        _uploadStatus.value = UploadStatusStore.snapshot(this)
        _loginState.value = AppAuthManager.currentState(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleRuntimeConfigIntent(intent)
        handleAuthIntent(intent)
    }

    override fun onPause() {
        super.onPause()
        try { unregisterReceiver(detectionReceiver) } catch (_: Exception) {}
        try { unregisterReceiver(uploadStatusReceiver) } catch (_: Exception) {}
    }

    override fun onDestroy() {
        visionClassifier?.close()
        tts?.shutdown()
        super.onDestroy()
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

    private fun startFieldScan(intent: FieldSessionIntent, testLevel: FieldTestLevel, movementMode: MovementMode) {
        if (!hasRequiredPermissions()) { requestPermissions(); return }
        currentMovementMode = movementMode.key
        FieldScanService.start(
            context = this,
            sessionIntent = if (intent == FieldSessionIntent.TEST) "test" else "official",
            officialRecord = intent == FieldSessionIntent.OFFICIAL,
            testProfile = if (intent == FieldSessionIntent.TEST) testLevel.profileKey else "field",
            movementMode = movementMode.key,
        )
    }

    private fun hasRequiredPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    private fun handleAuthIntent(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        val result = AppAuthManager.handleOAuthCallback(this, data) ?: return
        _loginState.value = AppAuthManager.currentState(this)
        _uploadStatus.value = UploadStatusStore.snapshot(this)
    }

    private fun handleRuntimeConfigIntent(intent: Intent?) {
        MobileApiConfig.applyDebugOverrideFromIntent(
            context = this,
            rawBase = intent?.getStringExtra(MobileApiConfig.EXTRA_FIELD_SESSION_API_BASE),
        )
    }

    private fun handleCameraFrame(bitmap: Bitmap, movementMode: String) {
        val now = System.currentTimeMillis()
        val runVision = now - lastVisionAt >= if (movementMode == "vehicle") 10_000L else 5_000L
        val runEnv = now - lastEnvAt >= if (movementMode == "vehicle") 20_000L else 12_000L
        if (!runVision && !runEnv) return

        lifecycleScope.launch(Dispatchers.IO) {
            val classifier = visionClassifier ?: VisionClassifier(this@MainActivity).also {
                visionClassifier = it
                visionReady = it.initialize()
            }
            if (!visionReady) return@launch

            if (runVision) {
                lastVisionAt = now
                classifier.classifyFrame(bitmap)?.let { result ->
                    if (result.confidence >= 0.30f) {
                        val (lat, lng) = FieldSessionCoordinator.currentLocation()
                        FieldSessionCoordinator.addEvent(
                            context = this@MainActivity,
                            raw = DetectionEvent(
                                type = "visual",
                                taxonName = result.commonName.ifEmpty { result.scientificName },
                                scientificName = result.scientificName,
                                confidence = result.confidence,
                                lat = lat,
                                lng = lng,
                                timestamp = System.currentTimeMillis(),
                                model = result.modelSnapshot.baseModelName,
                                taxonomicClass = result.taxonomicClass,
                                order = result.order,
                                photoRef = "scene_${now}_visual",
                                onDeviceModelBaseName = result.modelSnapshot.baseModelName,
                                onDeviceReleaseStage = result.modelSnapshot.releaseStage,
                                onDeviceModelPreference = result.modelSnapshot.preference,
                                foregroundAiAvailable = result.modelSnapshot.foregroundAiAvailable,
                                fallbackReason = result.modelSnapshot.fallbackReason,
                            ),
                        )
                    }
                }
            }

            if (runEnv) {
                lastEnvAt = now
                classifier.analyzeEnvironment(bitmap)?.let { env ->
                    val (lat, lng) = FieldSessionCoordinator.currentLocation()
                    FieldSessionCoordinator.addEvent(
                        context = this@MainActivity,
                        raw = DetectionEvent(
                            type = "sensor",
                            taxonName = env.habitat.ifBlank { "環境コンテキスト" },
                            scientificName = "environment_context",
                            confidence = 1.0f,
                            lat = lat,
                            lng = lng,
                            timestamp = System.currentTimeMillis(),
                            model = env.modelSnapshot.baseModelName,
                            taxonomicClass = "Environment",
                            order = env.vegetation,
                            taxonRank = "context",
                            photoRef = "scene_${now}_env",
                            onDeviceModelBaseName = env.modelSnapshot.baseModelName,
                            onDeviceReleaseStage = env.modelSnapshot.releaseStage,
                            onDeviceModelPreference = env.modelSnapshot.preference,
                            foregroundAiAvailable = env.modelSnapshot.foregroundAiAvailable,
                            fallbackReason = env.modelSnapshot.fallbackReason,
                            sceneDigest = env.sceneDigest,
                            areaResolutionSignals = env.areaResolutionSignals,
                        ),
                    )
                }
            }
        }
    }

    private fun repeatLatestPulse() {
        val latest = _detections
            .take(3)
            .mapNotNull { it.sceneDigest.ifBlank { it.taxonName }.takeIf { text -> text.isNotBlank() } }
            .joinToString("。")
        if (latest.isNotBlank()) speakDriveCue(latest)
    }

    private fun speakDriveCue(text: String) {
        val short = text.replace('\n', ' ').take(120)
        tts?.speak(short, TextToSpeech.QUEUE_FLUSH, null, "field_pulse")
    }
}

@Composable
private fun AudioReviewPanel(
    snippets: List<AudioSnippetStore.Snippet>,
    onConfirm: (AudioSnippetStore.Snippet, String, String) -> Unit,
    onSkip: (AudioSnippetStore.Snippet) -> Unit,
    onDone: () -> Unit,
) {
    val green = Color(0xFF2E7D32)
    val ink = Color(0xFF17211B)
    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF6F7F2)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Spacer(modifier = Modifier.height(48.dp))
            Text("音を確認", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = ink)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (snippets.isEmpty()) "確認待ちの音はありません。"
                else "あとで見返すため、必要な音だけ残します。",
                fontSize = 15.sp,
                color = ink.copy(alpha = 0.62f),
                lineHeight = 22.sp,
            )
            Spacer(modifier = Modifier.height(20.dp))

            snippets.take(20).forEach { snippet ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text("録音 ${"%.1f".format(snippet.durationSec)}秒", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = ink)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "候補を確認して、記録に使うか選びます。",
                            fontSize = 13.sp,
                            color = ink.copy(alpha = 0.58f),
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = { onSkip(snippet) },
                                modifier = Modifier.weight(1f).height(52.dp),
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                Text("残さない")
                            }
                            Button(
                                onClick = { onConfirm(snippet, "", "") },
                                modifier = Modifier.weight(1f).height(52.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = green),
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                Text("残す", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            Spacer(modifier = Modifier.weight(1f, fill = false))
            Button(
                onClick = onDone,
                modifier = Modifier.fillMaxWidth().height(64.dp),
                colors = ButtonDefaults.buttonColors(containerColor = green),
                shape = RoundedCornerShape(18.dp),
            ) {
                Text("戻る", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

enum class ScanMode(val label: String, val emoji: String, val desc: String) {
    POCKET("聞くだけ", "🎧", "画面を閉じて\n音と場所を残す"),
    FIELD("場所を読む", "🔭", "カメラ・音・位置から\n周りの手がかりを集める"),
}

enum class FieldSessionIntent(
    val label: String,
    val emoji: String,
    val desc: String,
    val buttonLabel: String,
    val color: Color,
) {
    TEST("ためす", "🧪", "動作確認用\n公開記録には入れない", "ためしてみる", Color(0xFF2F7DA1)),
    OFFICIAL("記録する", "🌿", "自分の記録として保存\n地図にも反映する", "記録をはじめる", Color(0xFF2E7D32)),
}

enum class FieldTestLevel(
    val profileKey: String,
    val label: String,
    val emoji: String,
    val desc: String,
) {
    QUICK("quick", "短く", "⚡", "すぐ終わる確認"),
    STANDARD("standard", "ふつう", "🎯", "普段の確認"),
    STRESS("stress", "しっかり", "🔥", "長めに動かす確認"),
}

enum class MovementMode(
    val key: String,
    val label: String,
    val emoji: String,
    val desc: String,
) {
    WALK("walk", "歩く", "🚶", "散歩しながら"),
    VEHICLE("vehicle", "車", "🚗", "画面を見ない"),
    FOCUS("focus", "じっくり", "🔎", "立ち止まって"),
}

@Composable
fun HomeScreen(
    selectedMode: ScanMode,
    onModeSelected: (ScanMode) -> Unit,
    fieldSessionIntent: FieldSessionIntent,
    onFieldSessionIntentSelected: (FieldSessionIntent) -> Unit,
    fieldTestLevel: FieldTestLevel,
    onFieldTestLevelSelected: (FieldTestLevel) -> Unit,
    movementMode: MovementMode,
    onMovementModeSelected: (MovementMode) -> Unit,
    onStart: () -> Unit,
    onRequestPermissions: () -> Unit,
    loginState: AppLoginState,
    onLoginStateChanged: () -> Unit,
    uploadStatus: UploadStatusSnapshot,
    onRetryPendingUploads: () -> Unit,
    lastSessionCount: Int,
) {
    val green = Color(0xFF2E7D32)
    val ink = Color(0xFF17211B)
    val darkBg = Color(0xFFF6F7F2)
    val cardBg = Color.White
    val borderColor = Color(0xFFDCE4D8)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf(loginState.email) }
    var password by remember { mutableStateOf("") }
    var loginMessage by remember { mutableStateOf(loginState.detail) }

    Surface(modifier = Modifier.fillMaxSize(), color = darkBg) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            Text("🌿", fontSize = 36.sp)
            Spacer(modifier = Modifier.height(4.dp))
            Text("いきものフィールド", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = ink)
            Text("散歩や移動中に、場所の手がかりを集めます", fontSize = 12.sp, color = ink.copy(alpha = 0.58f))

            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "今いる場所を、見えるもの・聞こえるもの・地図の文脈から読み解く。",
                color = ink.copy(alpha = 0.72f),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 19.sp,
            )

            Spacer(modifier = Modifier.height(32.dp))

            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.CenterStart,
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFFEAF2EA))
                        .border(1.dp, borderColor, RoundedCornerShape(16.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("🔭", fontSize = 24.sp)
                    Column(modifier = Modifier.weight(1f)) {
                        Text("今の場所を読む", color = ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text("カメラ・音・位置から、周りの自然の手がかりをまとめます", color = ink.copy(alpha = 0.62f), fontSize = 12.sp, lineHeight = 17.sp)
                    }
                }
            }

            if (selectedMode == ScanMode.FIELD) {
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    "保存のしかた",
                    fontSize = 13.sp,
                    color = ink.copy(alpha = 0.72f),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    FieldSessionIntent.entries.forEach { intent ->
                        val isSelected = fieldSessionIntent == intent
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .then(
                                    if (isSelected) Modifier.border(2.dp, intent.color, RoundedCornerShape(16.dp))
                                    else Modifier.border(1.dp, borderColor, RoundedCornerShape(16.dp))
                                )
                                .background(if (isSelected) intent.color.copy(alpha = 0.12f) else cardBg)
                                .clickable { onFieldSessionIntentSelected(intent) }
                                .padding(14.dp),
                        ) {
                            Column {
                                Text(intent.emoji, fontSize = 24.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(intent.label, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = if (isSelected) intent.color else ink)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(intent.desc, fontSize = 12.sp, color = ink.copy(alpha = 0.58f), lineHeight = 17.sp)
                            }
                        }
                    }
                }

                if (fieldSessionIntent == FieldSessionIntent.TEST) {
                    Spacer(modifier = Modifier.height(18.dp))
                    Text(
                        "ためし方",
                        fontSize = 13.sp,
                        color = ink.copy(alpha = 0.72f),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        FieldTestLevel.entries.forEach { level ->
                            val isSelected = fieldTestLevel == level
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .then(
                                        if (isSelected) Modifier.border(2.dp, Color(0xFF38BDF8), RoundedCornerShape(16.dp))
                                        else Modifier.border(1.dp, borderColor, RoundedCornerShape(16.dp))
                                    )
                                    .background(if (isSelected) Color(0xFF38BDF8).copy(alpha = 0.12f) else cardBg)
                                    .clickable { onFieldTestLevelSelected(level) }
                                    .padding(14.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(level.emoji, fontSize = 22.sp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(level.label, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (isSelected) Color(0xFF2F7DA1) else ink)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(level.desc, fontSize = 12.sp, color = ink.copy(alpha = 0.58f), lineHeight = 17.sp)
                                }
                            }
                        }
                    }
                }

                // 移動手段選択（マイクゲイン制御）
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    "どう使う？",
                    fontSize = 13.sp,
                    color = ink.copy(alpha = 0.72f),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(10.dp))
                val moveColor = Color(0xFF64B5F6)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MovementMode.entries.forEach { mode ->
                        val isSelected = movementMode == mode
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .then(
                                    if (isSelected) Modifier.border(2.dp, moveColor, RoundedCornerShape(14.dp))
                                    else Modifier.border(1.dp, borderColor, RoundedCornerShape(14.dp))
                                )
                                .background(if (isSelected) moveColor.copy(alpha = 0.12f) else cardBg)
                                .clickable { onMovementModeSelected(mode) }
                                .padding(10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(mode.emoji, fontSize = 22.sp)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    mode.label,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) moveColor else ink.copy(alpha = 0.8f),
                                    textAlign = TextAlign.Center,
                                    lineHeight = 14.sp,
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    mode.desc,
                                    fontSize = 10.sp,
                                    color = ink.copy(alpha = 0.55f),
                                    textAlign = TextAlign.Center,
                                    lineHeight = 12.sp,
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // スタートボタン
            Button(
                onClick = onStart,
                modifier = Modifier.fillMaxWidth().height(64.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedMode == ScanMode.FIELD) fieldSessionIntent.color else green
                ),
                shape = RoundedCornerShape(16.dp),
            ) {
                Text(
                    if (selectedMode == ScanMode.FIELD) fieldSessionIntent.buttonLabel else "▶ スキャン開始",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            LoginCard(
                loginState = loginState,
                email = email,
                password = password,
                loginMessage = loginMessage,
                onEmailChange = { email = it },
                onPasswordChange = { password = it },
                onLogin = {
                    scope.launch {
                        val result = withContext(Dispatchers.IO) {
                            AppAuthManager.login(context, email, password, "0.8.1")
                        }
                        loginMessage = result.message
                        if (result.success) {
                            password = ""
                            onLoginStateChanged()
                        }
                    }
                },
                onGoogleLogin = {
                    AppAuthManager.launchGoogleLogin(context, "0.8.1")
                },
                onLogout = {
                    AppAuthManager.logout(context)
                    password = ""
                    loginMessage = "ログアウトした。以後は端末単位の記録として扱う"
                    onLoginStateChanged()
                },
            )

            Spacer(modifier = Modifier.height(24.dp))

            UploadStatusCard(
                snapshot = uploadStatus,
                onRetryPendingUploads = onRetryPendingUploads,
            )

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun LoginCard(
    loginState: AppLoginState,
    email: String,
    password: String,
    loginMessage: String,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLogin: () -> Unit,
    onGoogleLogin: () -> Unit,
    onLogout: () -> Unit,
) {
    val ink = Color(0xFF17211B)
    val cardBg = Color.White
    val borderColor = Color(0xFFDCE4D8)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text("アカウント", color = ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (loginState.isLoggedIn) "${loginState.userName} で同期中" else "ログインしていません",
                color = if (loginState.isLoggedIn) Color(0xFF2E7D32) else ink,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(loginMessage, color = ink.copy(alpha = 0.66f), fontSize = 12.sp, lineHeight = 18.sp)
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                if (loginState.isLoggedIn) {
                    "記録はWeb版の地図・ガイド・履歴と同じ場所に保存されます"
                } else {
                    "ログインしなくても使えます。ログインすると、あとでWeb版でも見られます"
                },
                color = ink.copy(alpha = 0.58f),
                fontSize = 12.sp,
                lineHeight = 17.sp,
            )
            Spacer(modifier = Modifier.height(12.dp))

            if (!loginState.isLoggedIn) {
                OutlinedTextField(
                    value = email,
                    onValueChange = onEmailChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("メールアドレス") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                )
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = onPasswordChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("パスワード") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                )
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = onLogin,
                    enabled = email.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text("ログインする", fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedButton(
                    onClick = onGoogleLogin,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text("Googleでログイン", fontWeight = FontWeight.Bold)
                }
            } else {
                Button(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF374151)),
                ) {
                    Text("ログアウト", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun UploadStatusCard(
    snapshot: UploadStatusSnapshot,
    onRetryPendingUploads: () -> Unit,
) {
    val ink = Color(0xFF17211B)
    val cardBg = Color.White
    val borderColor = Color(0xFFDCE4D8)
    val textSubtle = ink.copy(alpha = 0.6f)
    val accent = when (snapshot.state) {
        "uploaded" -> Color(0xFF2E7D32)
        "uploading" -> Color(0xFF0284C7)
        "retrying", "queued" -> Color(0xFFF59E0B)
        "offline_saved" -> Color(0xFF8B5CF6)
        "failed" -> Color(0xFFD32F2F)
        else -> Color(0xFF78909C)
    }
    val modeLabel = if (snapshot.lastOfficialRecord) "フィールド記録" else "動作チェック"
    val statusLabel = when (snapshot.state) {
        "uploaded" -> "送信完了"
        "uploading" -> "送信中"
        "retrying" -> "再試行待ち"
        "queued" -> "保存済み"
        "offline_saved" -> "オフライン保管"
        "failed" -> "送信失敗"
        else -> "待機中"
    }
    val updatedAt = if (snapshot.updatedAt > 0L) {
        SimpleDateFormat("HH:mm:ss", Locale.JAPAN).format(Date(snapshot.updatedAt))
    } else {
        "まだなし"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text("保存状態", color = ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(statusLabel, color = accent, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(modeLabel, color = textSubtle, fontSize = 12.sp)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(snapshot.detail, color = ink.copy(alpha = 0.76f), fontSize = 13.sp, lineHeight = 18.sp)
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StatusMetric("未送信", "${snapshot.pendingCount}件")
                StatusMetric("通信", if (snapshot.isOnline) "オンライン" else "オフライン")
                StatusMetric("反映準備", when {
                    snapshot.installRegistered -> "OK"
                    snapshot.installIdPresent -> "仮ID"
                    else -> "未完了"
                })
                StatusMetric("更新", updatedAt)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(snapshot.installDetail, color = ink.copy(alpha = 0.56f), fontSize = 11.sp, lineHeight = 16.sp)

            if (snapshot.pendingCount > 0) {
                Spacer(modifier = Modifier.height(14.dp))
                Button(
                    onClick = onRetryPendingUploads,
                    enabled = snapshot.installIdPresent,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(
                        if (snapshot.installIdPresent) "未送信を再試行"
                        else "端末登録後に再試行",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.StatusMetric(label: String, value: String) {
    Column(modifier = Modifier.weight(1f)) {
        Text(label, color = Color(0xFF17211B).copy(alpha = 0.5f), fontSize = 11.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, color = Color(0xFF17211B), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun IkimonTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Color(0xFF2E7D32),
            onPrimary = Color.White,
            background = Color(0xFFF6F7F2),
            surface = Color.White,
        ),
        content = content,
    )
}
