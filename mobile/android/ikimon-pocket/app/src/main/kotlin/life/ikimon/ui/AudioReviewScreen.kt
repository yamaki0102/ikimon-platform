package life.ikimon.ui

import android.media.MediaPlayer
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import life.ikimon.pocket.AudioSnippetStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * 音声確認・後同定画面
 *
 * セッション終了後に表示。録音スニペットを再生しながら種を確認できる。
 * 観察投稿の邪魔にならないよう「確認する」「スキップ」のシンプルな2択。
 * AI候補は両エンジン（BirdNET / Perch）の結果を並べて表示。
 */
@Composable
fun AudioReviewScreen(
    snippets: List<AudioSnippetStore.Snippet>,
    onConfirm: (AudioSnippetStore.Snippet, String, String) -> Unit, // snippet, scientificName, taxonName
    onSkip: (AudioSnippetStore.Snippet) -> Unit,
    onDone: () -> Unit,
) {
    val darkBg = Color(0xFF0D1117)
    val cardBg = Color(0xFF161B22)
    val green = Color(0xFF2E7D32)
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(darkBg)
            .padding(horizontal = 20.dp),
    ) {
        Spacer(modifier = Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("音声を確認", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text(
                    "${snippets.size}件の録音 — 再生して確認してください",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 13.sp,
                )
            }
            TextButton(onClick = onDone) {
                Text("完了", color = green, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (snippets.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                Text("確認待ちの音声はありません", color = Color.White.copy(alpha = 0.4f), fontSize = 14.sp)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(snippets, key = { it.id }) { snippet ->
                    AudioSnippetCard(
                        snippet = snippet,
                        onConfirm = { sci, common -> onConfirm(snippet, sci, common) },
                        onSkip = { onSkip(snippet) },
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun AudioSnippetCard(
    snippet: AudioSnippetStore.Snippet,
    onConfirm: (scientificName: String, taxonName: String) -> Unit,
    onSkip: () -> Unit,
) {
    val cardBg = Color(0xFF161B22)
    val green = Color(0xFF2E7D32)
    val perchBlue = Color(0xFF0284C7)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isPlaying by remember { mutableStateOf(false) }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }
    var selectedCandidate by remember { mutableStateOf<AudioSnippetStore.Candidate?>(null) }
    var expanded by remember { mutableStateOf(false) }

    val timeLabel = remember(snippet.timestamp) {
        SimpleDateFormat("HH:mm:ss", Locale.JAPAN).format(Date(snippet.timestamp))
    }

    // 全候補（BirdNET + Perch、重複除去・信頼度順）
    val allCandidates = remember(snippet) {
        (snippet.birdnetCandidates + snippet.perchCandidates)
            .groupBy { it.scientificName.lowercase() }
            .map { (_, group) ->
                // 両エンジンで一致した場合は最大信頼度を使う
                val best = group.maxByOrNull { it.confidence }!!
                val isDual = group.any { it.engine == "birdnet" } && group.any { it.engine == "perch" }
                best.copy(consensusLevel = if (isDual) "DUAL_CONSENSUS" else best.consensusLevel)
            }
            .sortedByDescending { it.confidence }
    }

    DisposableEffect(Unit) {
        onDispose {
            mediaPlayer?.release()
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // ヘッダー: 時刻 + 長さ + 再生ボタン
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(timeLabel, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "${"%.1f".format(snippet.durationSec)}秒",
                        color = Color.White.copy(alpha = 0.45f),
                        fontSize = 12.sp,
                    )
                }

                // 再生/停止ボタン
                IconPlayButton(
                    isPlaying = isPlaying,
                    onClick = {
                        if (isPlaying) {
                            mediaPlayer?.stop()
                            mediaPlayer?.release()
                            mediaPlayer = null
                            isPlaying = false
                        } else {
                            scope.launch {
                                isPlaying = true
                                withContext(Dispatchers.IO) {
                                    runCatching {
                                        val mp = MediaPlayer().apply {
                                            setDataSource(snippet.wavPath)
                                            prepare()
                                            setOnCompletionListener {
                                                isPlaying = false
                                                release()
                                                mediaPlayer = null
                                            }
                                            start()
                                        }
                                        mediaPlayer = mp
                                    }.onFailure { isPlaying = false }
                                }
                            }
                        }
                    },
                )
            }

            if (allCandidates.isEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "AI候補なし — 手動で種を入力できます",
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 12.sp,
                )
            } else {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "AI候補",
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(6.dp))

                val displayCandidates = if (expanded) allCandidates else allCandidates.take(3)
                displayCandidates.forEach { candidate ->
                    val isDual = candidate.consensusLevel == "DUAL_CONSENSUS"
                    val engineColor = if (isDual) Color(0xFFFFB300) else green
                    val isSelected = selectedCandidate?.scientificName == candidate.scientificName
                    val bgColor = when {
                        isSelected -> engineColor.copy(alpha = 0.18f)
                        else -> Color.Transparent
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(bgColor)
                            .then(
                                Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                            ),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        // エンジンバッジ
                        Text(
                            if (isDual) "🔥" else if (candidate.engine == "perch") "🔵" else "🎧",
                            fontSize = 14.sp,
                        )

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                candidate.commonName.ifEmpty { candidate.scientificName },
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                candidate.scientificName,
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 10.sp,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                maxLines = 1,
                            )
                        }

                        Text(
                            "${(candidate.confidence * 100).toInt()}%",
                            color = engineColor,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )

                        // 選択ラジオ
                        RadioButton(
                            selected = isSelected,
                            onClick = {
                                selectedCandidate = if (isSelected) null else candidate
                            },
                            colors = RadioButtonDefaults.colors(selectedColor = engineColor),
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }

                if (allCandidates.size > 3 && !expanded) {
                    TextButton(
                        onClick = { expanded = true },
                        modifier = Modifier.padding(start = 4.dp),
                    ) {
                        Text(
                            "他 ${allCandidates.size - 3} 件を表示",
                            color = green,
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // アクションボタン
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = onSkip,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White.copy(alpha = 0.5f)),
                ) {
                    Text("スキップ", fontSize = 13.sp)
                }

                Button(
                    onClick = {
                        val c = selectedCandidate
                        if (c != null) {
                            onConfirm(c.scientificName, c.commonName.ifEmpty { c.scientificName })
                        }
                    },
                    enabled = selectedCandidate != null,
                    modifier = Modifier.weight(2f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = green),
                ) {
                    Text("この種で記録", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun IconPlayButton(isPlaying: Boolean, onClick: () -> Unit) {
    val green = Color(0xFF2E7D32)
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(if (isPlaying) Color(0xFFD32F2F).copy(alpha = 0.15f) else green.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center,
    ) {
        IconButton(onClick = onClick) {
            Text(if (isPlaying) "⏹" else "▶", fontSize = 18.sp)
        }
    }
}
