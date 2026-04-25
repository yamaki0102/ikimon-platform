package life.ikimon.pocket

import life.ikimon.data.HabitatSignals
import kotlin.math.ln

/**
 * Layer 2 出力 → HabitatSignals[7] 変換器（ルールベース）。
 *
 * 種検出結果と視覚環境分析から環境シグナルベクトルを生成する。
 * Phase 2 で EnvironmentalTransformer に置き換わる。
 */
object EnvironmentalSignalExtractor {

    // 水辺指標種（属レベルマッチ）
    private val WATER_GENERA = setOf(
        "Alcedo", "Ardea", "Egretta", "Gallinula", "Fulica",
        "Acrocephalus", "Locustella",
        "Rana", "Hyla", "Bufo", "Rhacophorus",
        "Aix", "Anas", "Actitis",
    )

    // 林内指標種
    private val CANOPY_GENERA = setOf(
        "Sitta", "Certhia", "Dendrocopos", "Dryocopus", "Picus",
        "Regulus", "Phylloscopus", "Cettia",
        "Ficedula", "Terpsiphone",
    )

    // 都市適応種
    private val URBAN_GENERA = setOf(
        "Corvus", "Passer", "Columba", "Streptopelia",
        "Sturnus", "Hirundo",
    )

    // 林縁・エッジ種
    private val EDGE_GENERA = setOf(
        "Emberiza", "Saxicola", "Motacilla",
        "Lanius", "Hypsipetes",
    )

    data class Layer2Snapshot(
        val audioResults: List<DualAudioClassifier.DualResult>,
        val envResult: VisionClassifier.EnvironmentResult?,
        val sensorPressure: Float,
        val isStationary: Boolean,
    )

    fun extract(snapshot: Layer2Snapshot): HabitatSignals {
        val species = snapshot.audioResults
        val env = snapshot.envResult

        // --- waterProximity ---
        val waterFromAudio = species
            .filter { r -> WATER_GENERA.any { r.scientificName.substringBefore(" ").equals(it, ignoreCase = true) } }
            .maxOfOrNull { it.fusedConfidence } ?: 0f
        val waterFromVision = when {
            env?.water?.contains("river") == true -> 0.7f
            env?.water?.contains("stream") == true -> 0.6f
            env?.water?.contains("pond") == true -> 0.6f
            env?.water?.contains("lake") == true -> 0.8f
            env?.water?.contains("none") == true -> 0f
            else -> 0.1f
        }
        val waterProximity = (waterFromAudio * 0.6f + waterFromVision * 0.4f).coerceIn(0f, 1f)

        // --- canopyCover ---
        val canopyFromVision = (env?.canopyCoverPct ?: 0) / 100f
        val canopyFromAudio = species
            .filter { r -> CANOPY_GENERA.any { r.scientificName.substringBefore(" ").equals(it, ignoreCase = true) } }
            .maxOfOrNull { it.fusedConfidence } ?: 0f
        val canopyCover = (canopyFromVision * 0.7f + canopyFromAudio * 0.3f).coerceIn(0f, 1f)

        // --- vegetationDensity ---
        val vegetationDensity = when {
            env?.vegetation?.contains("canopy") == true -> 0.9f
            env?.vegetation?.contains("shrub") == true -> 0.7f
            env?.vegetation?.contains("grass") == true -> 0.5f
            env?.vegetation?.contains("sparse") == true -> 0.2f
            else -> 0.4f
        }

        // --- anthropogenicPressure ---
        val urbanCount = species.count { r ->
            URBAN_GENERA.any { r.scientificName.substringBefore(" ").equals(it, ignoreCase = true) }
        }
        val totalCount = species.size.coerceAtLeast(1)
        val anthropogenicPressure = (urbanCount.toFloat() / totalCount).coerceIn(0f, 1f)

        // --- edgeStructure ---
        val edgeFromAudio = species
            .filter { r -> EDGE_GENERA.any { r.scientificName.substringBefore(" ").equals(it, ignoreCase = true) } }
            .maxOfOrNull { it.fusedConfidence } ?: 0f
        val edgeStructure = (canopyCover * 0.5f + edgeFromAudio * 0.5f).coerceIn(0f, 1f)

        // --- disturbanceLevel ---
        val disturbanceLevel = when (env?.disturbance?.lowercase()) {
            "low" -> 0.1f
            "medium", "moderate" -> 0.5f
            "high" -> 0.9f
            else -> 0.3f
        }

        // --- acousticComplexity (Shannon entropy proxy) ---
        val acousticComplexity = if (species.isEmpty()) 0f else {
            val confs = species.map { it.fusedConfidence.coerceAtLeast(0.01f) }
            val sum = confs.sum()
            val probs = confs.map { it / sum }
            val entropy = -probs.sumOf { p -> (p * ln(p)).toDouble() }.toFloat()
            val maxEntropy = ln(species.size.toFloat().coerceAtLeast(2f))
            if (maxEntropy > 0f) (entropy / maxEntropy).coerceIn(0f, 1f) else 0f
        }

        return HabitatSignals(
            waterProximity = waterProximity,
            canopyCover = canopyCover,
            vegetationDensity = vegetationDensity,
            anthropogenicPressure = anthropogenicPressure,
            edgeStructure = edgeStructure,
            disturbanceLevel = disturbanceLevel,
            acousticComplexity = acousticComplexity,
        )
    }
}
