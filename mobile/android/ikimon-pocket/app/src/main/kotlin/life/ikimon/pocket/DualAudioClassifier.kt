package life.ikimon.pocket

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*

/**
 * デュアル音声分類器 — BirdNET V3 + Perch v2 並列推論
 *
 * Pixel 10 Pro (Tensor G5) の NPU コアを両エンジンで分割使用。
 * 同一種をどちらかが検出 → 信頼度統合
 * 両エンジンが合意 → Evidence Tier 2（証拠強度が高い）
 */
class DualAudioClassifier(private val context: Context) {

    companion object {
        private const val TAG = "DualAudioClassifier"
        // 同一種とみなす学名の一致判定（属レベルまで）
        private const val GENUS_MATCH_BONUS = 0.1f
    }

    data class DualResult(
        val taxonName: String,
        val scientificName: String,
        val fusedConfidence: Float,
        val birdnetConfidence: Float?,    // null = BirdNET で未検出
        val perchConfidence: Float?,      // null = Perch  で未検出
        val consensusLevel: ConsensusLevel,
        val taxonomicClass: String,
        val order: String,
    )

    enum class ConsensusLevel {
        DUAL_CONSENSUS,   // 両エンジンが同種で合意 → Evidence Tier 2
        SINGLE_STRONG,    // 片方のみ、高信頼度
        SINGLE_WEAK,      // 片方のみ、低信頼度
    }

    private val birdnet = AudioClassifier(context)
    private val perch = PerchClassifier(context)

    fun isReady(): Boolean = birdnet.isReady()
    fun isPerchReady(): Boolean = perch.isReady()

    /**
     * 音声データを BirdNET と Perch に同時に投げ、コンセンサス結果を返す。
     * Perch が使えない場合は BirdNET 単体で動く。
     */
    fun classifyDual(
        audioData: FloatArray,
        durationMs: Long,
        minConfidence: Float,
        callback: (List<DualResult>) -> Unit,
    ) {
        val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
        scope.launch {
            // BirdNET と Perch を並列実行
            val birdnetDeferred = async {
                runCatching {
                    var birdnetResults: List<AudioClassifier.ClassificationResult> = emptyList()
                    // BirdNET はコールバック形式なのでチャネルで同期
                    val channel = kotlinx.coroutines.channels.Channel<List<AudioClassifier.ClassificationResult>>(1)
                    birdnet.classifyAmbientAudio(durationMs) { results ->
                        scope.launch { channel.send(results) }
                    }
                    channel.receive()
                }.getOrElse {
                    Log.e(TAG, "BirdNET error: ${it.message}")
                    emptyList()
                }
            }

            val perchDeferred = async {
                runCatching {
                    if (perch.isReady()) perch.classify(audioData)
                    else emptyList()
                }.getOrElse {
                    Log.e(TAG, "Perch error: ${it.message}")
                    emptyList()
                }
            }

            val birdnetResults = birdnetDeferred.await()
            val perchResults = perchDeferred.await()

            val fused = fuse(birdnetResults, perchResults, minConfidence)

            withContext(Dispatchers.Main) {
                callback(fused)
            }
        }
    }

    /**
     * BirdNET と Perch の結果をマージしてコンセンサスを計算する。
     *
     * fusion 式: P(A ∪ B) = 1 - (1 - pA)(1 - pB)
     * 両エンジンが合意した場合に適用。
     */
    private fun fuse(
        birdnet: List<AudioClassifier.ClassificationResult>,
        perch: List<PerchClassifier.PerchResult>,
        minConfidence: Float,
    ): List<DualResult> {
        val birdnetMap = birdnet.associateBy { it.scientificName.lowercase() }
        val perchMap = perch.associateBy { it.scientificName.lowercase() }

        val allKeys = (birdnetMap.keys + perchMap.keys).toSet()
        val results = mutableListOf<DualResult>()

        for (key in allKeys) {
            val b = birdnetMap[key]
            val p = perchMap[key]

            val fusedConf: Float
            val consensus: ConsensusLevel

            when {
                b != null && p != null -> {
                    // 両エンジン合意: Union probability
                    fusedConf = 1f - (1f - b.confidence) * (1f - p.confidence)
                    consensus = ConsensusLevel.DUAL_CONSENSUS
                }
                b != null -> {
                    // BirdNET のみ
                    // Perch が同属で別種を検出している場合は属レベルボーナス
                    val genusKey = key.substringBefore(" ")
                    val perchGenus = perchMap.keys.firstOrNull { it.startsWith(genusKey) }
                    fusedConf = if (perchGenus != null) {
                        minOf(b.confidence + GENUS_MATCH_BONUS, 1f)
                    } else b.confidence
                    consensus = if (fusedConf >= 0.5f) ConsensusLevel.SINGLE_STRONG else ConsensusLevel.SINGLE_WEAK
                }
                p != null -> {
                    // Perch のみ
                    fusedConf = p.confidence
                    consensus = if (fusedConf >= 0.5f) ConsensusLevel.SINGLE_STRONG else ConsensusLevel.SINGLE_WEAK
                }
                else -> continue
            }

            if (fusedConf < minConfidence) continue

            results.add(
                DualResult(
                    taxonName = b?.name ?: p?.commonName ?: key,
                    scientificName = b?.scientificName ?: p?.scientificName ?: key,
                    fusedConfidence = fusedConf,
                    birdnetConfidence = b?.confidence,
                    perchConfidence = p?.confidence,
                    consensusLevel = consensus,
                    taxonomicClass = b?.taxonomicClass ?: "",
                    order = b?.order ?: "",
                )
            )
        }

        return results.sortedByDescending { it.fusedConfidence }
    }

    fun close() {
        birdnet.close()
        perch.close()
    }
}
