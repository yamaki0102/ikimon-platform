package life.ikimon.ui

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

/**
 * リアルタイム検出フィード — スキャン中に種名がポンポン積み上がるUI
 */

data class DetectionItem(
    val id: String = UUID.randomUUID().toString(),
    val taxonName: String,
    val scientificName: String,
    val confidence: Float,
    val type: String,  // "audio" | "visual"
    val taxonomicClass: String = "",
    val taxonRank: String = "species",  // species/genus/family/order/class
    val timestamp: Long = System.currentTimeMillis(),
    val isFused: Boolean = false,
)

@Composable
fun ScanActiveScreen(
    detections: List<DetectionItem>,
    scanMode: String,
    elapsedSeconds: Int,
    speciesCount: Int,
    onStop: () -> Unit,
) {
    val green = Color(0xFF2E7D32)
    val darkBg = Color(0xFF0D1117)
    val cardBg = Color(0xFF161B22)
    val listState = rememberLazyListState()
    val context = LocalContext.current

    // 新しい検出が来たら自動スクロール + ハプティック
    LaunchedEffect(detections.size) {
        if (detections.isNotEmpty()) {
            listState.animateScrollToItem(0)
            triggerHaptic(context, detections.lastOrNull()?.isFused == true)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(darkBg)
            .padding(16.dp),
    ) {
        // ステータスバー
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // 録音中パルスアニメーション
                PulsingDot()
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    formatElapsed(elapsedSeconds),
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 14.sp,
                )
            }

            Text(
                "$speciesCount 種検出",
                color = green,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // AI エンジン状態
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            AiChip("🎧 BirdNET+", true)
            AiChip("📷 Gemini", scanMode == "field")
            AiChip("🌡️ ENV", scanMode == "field")
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 検出フィード
        if (detections.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🔍", fontSize = 32.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "周囲の生物を探しています...",
                        color = Color.White.copy(alpha = 0.4f),
                        fontSize = 14.sp,
                    )
                }
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                reverseLayout = true,
            ) {
                items(detections, key = { it.id }) { detection ->
                    AnimatedVisibility(
                        visible = true,
                        enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
                    ) {
                        DetectionCard(detection)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 停止ボタン
        Button(
            onClick = onStop,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
            shape = RoundedCornerShape(16.dp),
        ) {
            Text("⏹ スキャン停止", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}

@Composable
private fun DetectionCard(detection: DetectionItem) {
    val green = Color(0xFF2E7D32)
    val cardBg = Color(0xFF161B22)
    val fusedGold = Color(0xFFFFB300)

    val borderColor = when {
        detection.isFused -> fusedGold
        detection.confidence >= 0.7f -> green
        else -> Color(0xFF30363D)
    }

    val icon = when (detection.type) {
        "audio" -> "🎧"
        "visual" -> "📷"
        else -> "🔬"
    }

    val classIcon = when (detection.taxonomicClass) {
        "Aves" -> "🐦"
        "Insecta" -> "🦗"
        "Amphibia" -> "🐸"
        "Mammalia" -> "🦊"
        "Reptilia" -> "🦎"
        else -> "🌿"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        border = CardDefaults.outlinedCardBorder().takeIf { false },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // 分類アイコン
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(borderColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(classIcon, fontSize = 20.sp)
            }

            Spacer(modifier = Modifier.width(12.dp))

            // 種名 + 分類階層
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        detection.taxonName,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    // 分類ランクバッジ
                    val rankLabel = when (detection.taxonRank) {
                        "species" -> "種"
                        "genus" -> "属"
                        "family" -> "科"
                        "order" -> "目"
                        "class" -> "綱"
                        else -> detection.taxonRank
                    }
                    val rankColor = when (detection.taxonRank) {
                        "species" -> green
                        "genus" -> Color(0xFF66BB6A)
                        "family" -> Color(0xFF29B6F6)
                        "order" -> Color(0xFFAB47BC)
                        else -> Color(0xFF78909C)
                    }
                    Text(
                        rankLabel,
                        color = rankColor,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(rankColor.copy(alpha = 0.15f))
                            .padding(horizontal = 4.dp, vertical = 1.dp),
                    )
                    if (detection.isFused) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "FUSED",
                            color = fusedGold,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(fusedGold.copy(alpha = 0.15f))
                                .padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                    }
                }
                Text(
                    detection.scientificName,
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 11.sp,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                    maxLines = 1,
                )
            }

            // 信頼度 + 検出タイプ
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${(detection.confidence * 100).toInt()}%",
                    color = borderColor,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    icon,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
private fun AiChip(label: String, active: Boolean) {
    val green = Color(0xFF2E7D32)
    Text(
        label,
        fontSize = 10.sp,
        color = if (active) green else Color.White.copy(alpha = 0.2f),
        fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) green.copy(alpha = 0.1f) else Color.Transparent)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
private fun PulsingDot() {
    var visible by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        while (true) {
            visible = !visible
            delay(800)
        }
    }
    Box(
        modifier = Modifier
            .size(8.dp)
            .clip(CircleShape)
            .background(
                if (visible) Color(0xFFEF5350) else Color(0xFFEF5350).copy(alpha = 0.3f)
            ),
    )
}

private fun formatElapsed(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}

private fun triggerHaptic(context: Context, isFused: Boolean) {
    try {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = if (isFused) {
                // マルチモーダル融合 → 強い二重バイブ
                VibrationEffect.createWaveform(longArrayOf(0, 50, 50, 80), -1)
            } else {
                // 通常検出 → 軽いタップ
                VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE)
            }
            vibrator.vibrate(effect)
        }
    } catch (_: Exception) { }
}
