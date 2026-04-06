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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import life.ikimon.api.AppAuthManager
import life.ikimon.api.AppLoginState
import life.ikimon.api.ImmediateUploadDrainer
import life.ikimon.api.UploadCoordinator
import life.ikimon.api.InstallIdentityManager
import life.ikimon.api.UploadStatusSnapshot
import life.ikimon.api.UploadStatusStore
import life.ikimon.data.EventBuffer
import life.ikimon.pocket.AudioSnippetStore
import life.ikimon.pocket.FieldScanService
import life.ikimon.pocket.PocketService
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

    private val uploadStatusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            _uploadStatus.value = UploadStatusStore.snapshot(this@MainActivity)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        InstallIdentityManager.getOrCreateInstallId(this)
        _uploadStatus.value = UploadStatusStore.snapshot(this)
        _loginState.value = AppAuthManager.currentState(this)
        handleAuthIntent(intent)

        setContent {
            IkimonTheme {
                var selectedMode by remember { mutableStateOf(ScanMode.POCKET) }
                var fieldSessionIntent by remember { mutableStateOf(FieldSessionIntent.OFFICIAL) }
                var fieldTestLevel by remember { mutableStateOf(FieldTestLevel.STANDARD) }
                var movementMode by remember { mutableStateOf(MovementMode.WALK) }
                var isActive by remember { mutableStateOf(false) }
                var showAudioReview by remember { mutableStateOf(false) }
                var pendingSnippets by remember { mutableStateOf(listOf<AudioSnippetStore.Snippet>()) }
                val showResultSheet by _showResultSheet
                val lastSummary by _lastSummary

                LaunchedEffect(showResultSheet) {
                    if (showResultSheet) {
                        pendingSnippets = withContext(Dispatchers.IO) {
                            AudioSnippetStore.listPending(this@MainActivity)
                        }
                    }
                }

                if (showAudioReview) {
                    AudioReviewScreen(
                        snippets = pendingSnippets,
                        onConfirm = { snippet, sci, common ->
                            pendingSnippets = pendingSnippets.filter { it.id != snippet.id }
                            kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                                AudioSnippetStore.confirm(this@MainActivity, snippet.id)
                            }
                        },
                        onSkip = { snippet ->
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
                        onReviewAudio = { showAudioReview = true },
                        onDismiss = {
                            _showResultSheet.value = false
                            _lastSummary.value = null
                        },
                    )
                } else if (isActive) {
                    ScanActiveScreen(
                        detections = _detections,
                        scanMode = if (selectedMode == ScanMode.FIELD) "field" else "pocket",
                        elapsedSeconds = _elapsedSeconds.intValue,
                        speciesCount = _detections.map { it.scientificName }.distinct().size,
                        onStop = {
                            stopTimer()
                            when (selectedMode) {
                                ScanMode.POCKET -> PocketService.stop(this@MainActivity)
                                ScanMode.FIELD -> FieldScanService.stop(this@MainActivity)
                            }
                            isActive = false
                            val durationSec = _elapsedSeconds.intValue
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
                                val drainResult = ImmediateUploadDrainer.drain(this@MainActivity)
                                if (drainResult.remainingCount > 0) {
                                    val queuedCount = UploadCoordinator.enqueuePendingUploads(this@MainActivity)
                                    if (queuedCount > 0) {
                                        UploadStatusStore.recordManualRetryQueued(this@MainActivity, queuedCount)
                                    }
                                }
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
                val drainResult = ImmediateUploadDrainer.drain(this@MainActivity)
                if (drainResult.remainingCount > 0) {
                    val queuedCount = UploadCoordinator.enqueuePendingUploads(this@MainActivity)
                    if (queuedCount > 0) {
                        UploadStatusStore.recordManualRetryQueued(this@MainActivity, queuedCount)
                    }
                }
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
        handleAuthIntent(intent)
    }

    override fun onPause() {
        super.onPause()
        try { unregisterReceiver(detectionReceiver) } catch (_: Exception) {}
        try { unregisterReceiver(uploadStatusReceiver) } catch (_: Exception) {}
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
}

enum class ScanMode(val label: String, val emoji: String, val desc: String) {
    POCKET("ポケット", "🎧", "ポケットに入れて散歩\n音声AIが自動で検出"),
    FIELD("フィールドスキャン", "🔭", "Triple AI Engine\n音声+視覚+環境分析"),
}

enum class FieldSessionIntent(
    val label: String,
    val emoji: String,
    val desc: String,
    val buttonLabel: String,
    val color: Color,
) {
    TEST("動作チェック", "🧪", "室内再生や回帰確認用\n本番記録には反映しない", "🧪 動作チェック開始", Color(0xFF0284C7)),
    OFFICIAL("フィールド記録", "🌿", "本番の観測として保存\n共同データに反映する", "🌿 フィールド記録開始", Color(0xFF2E7D32)),
}

enum class FieldTestLevel(
    val profileKey: String,
    val label: String,
    val emoji: String,
    val desc: String,
) {
    QUICK("quick", "クイック", "⚡", "短時間で停止や送信だけ確認\n再現しやすい最小テスト"),
    STANDARD("standard", "標準", "🎯", "普段の回帰確認に使う\n比較の基準にするレベル"),
    STRESS("stress", "ストレス", "🔥", "高頻度で回して負荷を見る\n誤検出や再送も出やすい"),
}

enum class MovementMode(
    val key: String,
    val label: String,
    val emoji: String,
    val desc: String,
) {
    WALK("walk", "歩き", "🚶", "最大ゲイン\n静かな環境向け"),
    BICYCLE("bicycle", "自転車・バイク", "🚲", "中ゲイン\n移動音を考慮"),
    VEHICLE("vehicle", "車・電車", "🚗", "標準ゲイン\n車内環境向け"),
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
    val darkBg = Color(0xFF0D1117)
    val cardBg = Color(0xFF161B22)
    val borderColor = Color(0xFF30363D)
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

            Text("🌿", fontSize = 40.sp)
            Spacer(modifier = Modifier.height(4.dp))
            Text("ikimon FieldScan", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
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

            if (selectedMode == ScanMode.FIELD) {
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    "開始モード",
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.75f),
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
                                Text(intent.label, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (isSelected) intent.color else Color.White)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(intent.desc, fontSize = 11.sp, color = Color.White.copy(alpha = 0.58f), lineHeight = 15.sp)
                            }
                        }
                    }
                }

                if (fieldSessionIntent == FieldSessionIntent.TEST) {
                    Spacer(modifier = Modifier.height(18.dp))
                    Text(
                        "テストレベル",
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.75f),
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
                                    Text(level.label, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (isSelected) Color(0xFF38BDF8) else Color.White)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(level.desc, fontSize = 11.sp, color = Color.White.copy(alpha = 0.58f), lineHeight = 15.sp)
                                }
                            }
                        }
                    }
                }

                // 移動手段選択（マイクゲイン制御）
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    "移動手段",
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.75f),
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
                                    color = if (isSelected) moveColor else Color.White.copy(alpha = 0.8f),
                                    textAlign = TextAlign.Center,
                                    lineHeight = 14.sp,
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    mode.desc,
                                    fontSize = 9.sp,
                                    color = Color.White.copy(alpha = 0.45f),
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
    val cardBg = Color(0xFF161B22)
    val borderColor = Color(0xFF30363D)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text("アカウント", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (loginState.isLoggedIn) "ログイン中: ${loginState.userName}" else "未ログイン",
                color = if (loginState.isLoggedIn) Color(0xFF2E7D32) else Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(loginMessage, color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp, lineHeight = 18.sp)
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                if (loginState.isLoggedIn) {
                    "本番のフィールド記録は、このアカウントの貢献として積み上がる"
                } else {
                    "未ログインでも観測はできる。あとでログインすると、この端末の本番記録を自分の貢献へ結び直せる"
                },
                color = Color.White.copy(alpha = 0.56f),
                fontSize = 11.sp,
                lineHeight = 16.sp,
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
                    Text("ログインして貢献を固定", fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedButton(
                    onClick = onGoogleLogin,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text("Googleで続ける", fontWeight = FontWeight.Bold)
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
    val cardBg = Color(0xFF161B22)
    val borderColor = Color(0xFF30363D)
    val textSubtle = Color.White.copy(alpha = 0.6f)
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
            Text("反映状態", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
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
            Text(snapshot.detail, color = Color.White.copy(alpha = 0.82f), fontSize = 13.sp, lineHeight = 18.sp)
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
            Text(snapshot.installDetail, color = Color.White.copy(alpha = 0.56f), fontSize = 11.sp, lineHeight = 16.sp)

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
        Text(label, color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
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
