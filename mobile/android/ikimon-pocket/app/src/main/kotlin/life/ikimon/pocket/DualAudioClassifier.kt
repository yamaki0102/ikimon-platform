package life.ikimon.pocket

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*

/**
 * トリプル音声分類器 — BirdNET V3 + Perch v2 + Gemma E4B 並列推論
 *
 * Pixel 10 Pro (Tensor G5) の NPU コアを3エンジンで分割使用。
 * 同一種をどちらかが検出 → 信頼度統合
 * 2エンジン合意 → Evidence Tier 2 / 3エンジン合意 → Evidence Tier 3
 *
 * Gemma E4B (Android AICore Developer Preview) は isReady()=false の間は
 * 自動的にスキップし、BirdNET+Perch デュアルモードで動作する。
 */
class DualAudioClassifier(private val context: Context) {

    companion object {
        private const val TAG = "DualAudioClassifier"
        private const val GENUS_MATCH_BONUS = 0.1f
    }

    data class DualResult(
        val taxonName: String,
        val scientificName: String,
        val fusedConfidence: Float,
        val birdnetConfidence: Float?,    // null = BirdNET で未検出
        val perchConfidence: Float?,      // null = Perch  で未検出
        val gemmaConfidence: Float?,      // null = Gemma  で未検出 or AICore 未対応
        val consensusLevel: ConsensusLevel,
        val taxonomicClass: String,
        val order: String,
    )

    enum class ConsensusLevel {
        TRIPLE_CONSENSUS, // 3エンジン合意 → Evidence Tier 3
        DUAL_CONSENSUS,   // 2エンジン合意 → Evidence Tier 2
        SINGLE_STRONG,    // 片方のみ、高信頼度
        SINGLE_WEAK,      // 片方のみ、低信頼度
    }

    private val birdnet = AudioClassifier(context)
    private val perch = PerchClassifier(context)
    private val gemma = GemmaAudioClassifier(context)

    fun isReady(): Boolean = birdnet.isReady()
    fun isPerchReady(): Boolean = perch.isReady()
    fun isGemmaReady(): Boolean = gemma.isReady()

    /**
     * 音声データを BirdNET / Perch / Gemma に同時に投げ、コンセンサス結果を返す。
     * 各エンジンは独立して失敗可能（graceful degradation）。
     * callerScope: サービスのスコープを渡すことで、停止時に推論を即座にキャンセルできる。
     */
    fun classifyDual(
        audioData: FloatArray,
        durationMs: Long,
        minConfidence: Float,
        callerScope: CoroutineScope? = null,
        callback: (List<DualResult>) -> Unit,
    ) {
        val scope = callerScope ?: CoroutineScope(Dispatchers.Default + SupervisorJob())
        scope.launch {
            val birdnetDeferred = async {
                runCatching {
                    birdnet.classifyData(audioData)
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

            val gemmaDeferred = async {
                runCatching {
                    if (gemma.isReady()) gemma.classify(audioData)
                    else emptyList<AudioClassifier.ClassificationResult>()
                }.getOrElse {
                    Log.e(TAG, "Gemma error: ${it.message}")
                    emptyList()
                }
            }

            val birdnetResults = birdnetDeferred.await()
            val perchResults = perchDeferred.await()
            val gemmaResults = gemmaDeferred.await()

            val fused = fuse(birdnetResults, perchResults, gemmaResults, minConfidence)

            withContext(Dispatchers.Main) {
                callback(fused)
            }
        }
    }

    /**
     * 3エンジンの結果をマージしてコンセンサスを計算する。
     *
     * fusion 式: P(A ∪ B ∪ C) = 1 - (1 - pA)(1 - pB)(1 - pC)
     */
    private fun fuse(
        birdnet: List<AudioClassifier.ClassificationResult>,
        perch: List<PerchClassifier.PerchResult>,
        gemma: List<AudioClassifier.ClassificationResult>,
        minConfidence: Float,
    ): List<DualResult> {
        val birdnetMap = birdnet.associateBy { it.scientificName.lowercase() }
        val perchMap = perch.associateBy { it.scientificName.lowercase() }
        val gemmaMap = gemma.associateBy { it.scientificName.lowercase() }

        val allKeys = (birdnetMap.keys + perchMap.keys + gemmaMap.keys).toSet()
        val results = mutableListOf<DualResult>()

        for (key in allKeys) {
            val b = birdnetMap[key]
            val p = perchMap[key]
            val g = gemmaMap[key]

            val enginesHit = listOfNotNull(b, p, g).size
            val fusedConf: Float
            val consensus: ConsensusLevel

            when {
                enginesHit == 3 -> {
                    fusedConf = 1f - (1f - b!!.confidence) * (1f - p!!.confidence) * (1f - g!!.confidence)
                    consensus = ConsensusLevel.TRIPLE_CONSENSUS
                }
                b != null && p != null -> {
                    fusedConf = 1f - (1f - b.confidence) * (1f - p.confidence)
                    consensus = ConsensusLevel.DUAL_CONSENSUS
                }
                b != null && g != null -> {
                    fusedConf = 1f - (1f - b.confidence) * (1f - g.confidence)
                    consensus = ConsensusLevel.DUAL_CONSENSUS
                }
                p != null && g != null -> {
                    fusedConf = 1f - (1f - p.confidence) * (1f - g.confidence)
                    consensus = ConsensusLevel.DUAL_CONSENSUS
                }
                b != null -> {
                    val genusKey = key.substringBefore(" ")
                    val nearMatch = (perchMap.keys + gemmaMap.keys).any { it.startsWith(genusKey) }
                    fusedConf = if (nearMatch) minOf(b.confidence + GENUS_MATCH_BONUS, 1f) else b.confidence
                    consensus = if (fusedConf >= 0.5f) ConsensusLevel.SINGLE_STRONG else ConsensusLevel.SINGLE_WEAK
                }
                p != null -> {
                    fusedConf = p.confidence
                    consensus = if (fusedConf >= 0.5f) ConsensusLevel.SINGLE_STRONG else ConsensusLevel.SINGLE_WEAK
                }
                g != null -> {
                    fusedConf = g.confidence
                    consensus = if (fusedConf >= 0.5f) ConsensusLevel.SINGLE_STRONG else ConsensusLevel.SINGLE_WEAK
                }
                else -> continue
            }

            if (fusedConf < minConfidence) continue

            results.add(
                DualResult(
                    taxonName = b?.name ?: g?.name ?: p?.commonName ?: key,
                    scientificName = b?.scientificName ?: g?.scientificName ?: p?.scientificName ?: key,
                    fusedConfidence = fusedConf,
                    birdnetConfidence = b?.confidence,
                    perchConfidence = p?.confidence,
                    gemmaConfidence = g?.confidence,
                    consensusLevel = consensus,
                    taxonomicClass = b?.taxonomicClass ?: g?.taxonomicClass ?: "",
                    order = b?.order ?: g?.order ?: "",
                )
            )
        }

        return results.sortedByDescending { it.fusedConfidence }
    }

    fun close() {
        birdnet.close()
        perch.close()
        gemma.close()
    }
}
