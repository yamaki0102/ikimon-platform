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

data class DetectionItem(
    val id: String = UUID.randomUUID().toString(),
    val taxonName: String,
    val scientificName: String,
    val confidence: Float,
    val type: String,           // "audio" | "visual"
    val taxonomicClass: String = "",
    val taxonRank: String = "species",
    val timestamp: Long = System.currentTimeMillis(),
    val isFused: Boolean = false,
    val isFirstInSession: Boolean = false,
)

data class SessionSummary(
    val elapsedSeconds: Int,
    val speciesCount: Int,
    val distanceMeters: Float = 0f,
    val recordsAdded: Int = 0,
)

@Composable
fun ScanActiveScreen(
    detections: List<DetectionItem>,
    scanMode: String,
    elapsedSeconds: Int,
    speciesCount: Int,
    distanceMeters: Float = 0f,
    onStop: () -> Unit,
) {
    val green = Color(0xFF2E7D32)
    val darkBg = Color(0xFF0D1117)
    val listState = rememberLazyListState()
    val context = LocalContext.current

    LaunchedEffect(detections.size) {
        if (detections.isNotEmpty()) {
            listState.animateScrollToItem(0)
            triggerHaptic(context, detections.firstOrNull()?.isFirstInSession == true)
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
                PulsingDot()
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    formatElapsed(elapsedSeconds),
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 14.sp,
                )
                if (distanceMeters > 0) {
                    Text(
                        "  ·  %.1f km".format(distanceMeters / 1000),
                        color = Color.White.copy(alpha = 0.35f),
                        fontSize = 13.sp,
                    )
                }
            }

            Text(
                "$speciesCount 種",
                color = green,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // 検出フィード
        if (detections.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🌿", fontSize = 32.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        if (scanMode == "pocket") "音に耳を澄ませています..." else "自然を感知しています...",
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

        Button(
            onClick = onStop,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1C2128)),
            shape = RoundedCornerShape(16.dp),
        ) {
            Text("記録を終了する", fontSize = 16.sp, color = Color.White.copy(alpha = 0.8f))
        }
    }
}

@Composable
private fun DetectionCard(detection: DetectionItem) {
    val green = Color(0xFF2E7D32)
    val cardBg = Color(0xFF161B22)

    val borderColor = when {
        detection.confidence >= 0.7f -> green.copy(alpha = 0.6f)
        else -> Color(0xFF30363D)
    }

    val classIcon = when (detection.taxonomicClass) {
        "Aves"      -> "🐦"
        "Insecta"   -> "🦗"
        "Amphibia"  -> "🐸"
        "Mammalia"  -> "🦊"
        "Reptilia"  -> "🦎"
        else        -> "🌿"
    }

    val typeIcon = if (detection.type == "visual") "📷" else "🎧"

    val timeLabel = SimpleDateFormat("HH:mm", Locale.getDefault())
        .format(Date(detection.timestamp))

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = cardBg),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
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

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        detection.taxonName,
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (detection.isFirstInSession) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("✨", fontSize = 13.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column(horizontalAlignment = Alignment.End) {
                Text(typeIcon, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    timeLabel,
                    color = Color.White.copy(alpha = 0.3f),
                    fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
fun SessionSummaryScreen(
    summary: SessionSummary,
    onRestart: () -> Unit,
    onViewRecords: () -> Unit,
) {
    val darkBg = Color(0xFF0D1117)
    val green = Color(0xFF2E7D32)

    Surface(modifier = Modifier.fillMaxSize(), color = darkBg) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "おつかれ",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )

            Spacer(modifier = Modifier.height(40.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                SummaryStatItem(formatElapsed(summary.elapsedSeconds), "時間")
                if (summary.distanceMeters > 0f) {
                    SummaryStatItem("%.1f km".format(summary.distanceMeters / 1000), "距離")
                }
                SummaryStatItem("${summary.speciesCount}", "種")
            }

            if (summary.recordsAdded > 0) {
                Spacer(modifier = Modifier.height(36.dp))
                Text(
                    "この地域の記録  +${summary.recordsAdded}",
                    color = Color.White.copy(alpha = 0.45f),
                    fontSize = 13.sp,
                )
            }

            Spacer(modifier = Modifier.height(56.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedButton(
                    onClick = onRestart,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("もう一度", color = Color.White)
                }
                Button(
                    onClick = onViewRecords,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = green),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("記録を見る", color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun SummaryStatItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(modifier = Modifier.height(4.dp))
        Text(label, fontSize = 11.sp, color = Color.White.copy(alpha = 0.4f))
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

internal fun formatElapsed(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}

private fun triggerHaptic(context: Context, isFirst: Boolean) {
    try {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = if (isFirst) {
                VibrationEffect.createWaveform(longArrayOf(0, 50, 50, 80), -1)
            } else {
                VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE)
            }
            vibrator.vibrate(effect)
        }
    } catch (_: Exception) { }
}
