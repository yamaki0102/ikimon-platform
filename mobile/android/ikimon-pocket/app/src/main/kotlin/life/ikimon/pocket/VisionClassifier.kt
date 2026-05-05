package life.ikimon.pocket

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONObject

/**
 * 視覚AI分類器（Gemini Nano / Gemma 4 on-device）
 *
 * カメラフレームをAICore Developer Preview優先のNano 4経路に渡し、
 * 生物候補と環境手がかりを端末内で要約する。
 * 完全オンデバイス推論 — ネットワーク不要。
 * Pixel 10 Pro (Tensor G5) で最高性能。
 */
class VisionClassifier(private val context: Context) {

    companion object {
        private const val TAG = "VisionClassifier"
        private const val FEATURE_AVAILABLE = 1  // FeatureStatus.AVAILABLE
        private const val FEATURE_DOWNLOADABLE = 3  // FeatureStatus.DOWNLOADABLE

        private const val SPECIES_PROMPT = """Identify any living organism (plant, animal, insect, fungus) visible in this photo.
Identify to the most specific taxonomic level possible. Species is ideal but genus, family, or order is also valuable.
Return ONLY a valid JSON object, nothing else:
{"taxon":"Parus minor","rank":"species","common_name":"Japanese Tit","confidence":0.85,"class":"Aves","order":"Passeriformes","family":"Paridae","genus":"Parus","habitat":"deciduous forest"}
If you cannot identify to species, identify to the lowest rank you can:
{"taxon":"Paridae","rank":"family","common_name":"Tit family","confidence":0.70,"class":"Aves","order":"Passeriformes","family":"Paridae","genus":null,"habitat":"forest edge"}
If multiple organisms, return the most prominent one.
If no identifiable organism is visible, return: {"taxon":null}
Do NOT explain. ONLY JSON."""

        private const val ENVIRONMENT_PROMPT = """Analyze the natural environment in this photo for ecological survey.
Return ONLY a valid JSON object:
{"habitat":"deciduous_forest","vegetation":"canopy_present","ground":"leaf_litter","water":"stream_nearby","canopy_cover_pct":60,"disturbance":"low","season_cue":"spring_bloom","area_resolution_signals":["水辺の近さ","落葉広葉樹林","春の開花"],"scene_digest":"落葉広葉樹林の林縁。足元は落ち葉が多く、近くに水音の手がかりがある。"}
Do NOT explain. ONLY JSON."""
    }

    data class VisionResult(
        val scientificName: String,
        val commonName: String,
        val confidence: Float,
        val taxonomicClass: String,
        val order: String,
        val family: String = "",
        val genus: String = "",
        val taxonRank: String = "species",  // species/genus/family/order/class
        val habitat: String = "",
        val modelSnapshot: OnDeviceFieldAiEngine.ModelSnapshot = OnDeviceFieldAiEngine.ModelSnapshot.unavailable("not_run"),
    )

    data class EnvironmentResult(
        val habitat: String,
        val vegetation: String,
        val ground: String,
        val water: String,
        val canopyCoverPct: Int,
        val disturbance: String,
        val sceneDigest: String = "",
        val areaResolutionSignals: List<String> = emptyList(),
        val modelSnapshot: OnDeviceFieldAiEngine.ModelSnapshot = OnDeviceFieldAiEngine.ModelSnapshot.unavailable("not_run"),
    )

    private val fieldAi = OnDeviceFieldAiEngine()
    private var isAvailable = false

    suspend fun initialize(): Boolean {
        return try {
            val snapshot = fieldAi.snapshotFor(OnDeviceFieldAiEngine.Profile.FAST)
            isAvailable = snapshot.foregroundAiAvailable
            Log.i(TAG, "On-device vision AI status: $snapshot")
            isAvailable
        } catch (e: Exception) {
            Log.e(TAG, "On-device vision init failed: ${e.message}")
            false
        }
    }

    fun isReady(): Boolean = isAvailable

    /**
     * カメラフレームから生物種を同定する。
     */
    suspend fun classifyFrame(bitmap: Bitmap): VisionResult? {
        if (!isAvailable) return null

        return try {
            val response = fieldAi.generateImageJson(
                bitmap = bitmap,
                prompt = SPECIES_PROMPT,
                profile = OnDeviceFieldAiEngine.Profile.FAST,
            )
            if (response.text.isBlank()) return null
            parseSpeciesResponse(response.text, response.modelSnapshot)
        } catch (e: Exception) {
            Log.e(TAG, "Vision classification failed: ${e.message}")
            null
        }
    }

    /**
     * カメラフレームから環境タイプを推定する。
     */
    suspend fun analyzeEnvironment(bitmap: Bitmap): EnvironmentResult? {
        if (!isAvailable) return null

        return try {
            val response = fieldAi.generateImageJson(
                bitmap = bitmap,
                prompt = ENVIRONMENT_PROMPT,
                profile = OnDeviceFieldAiEngine.Profile.FULL,
            )
            if (response.text.isBlank()) return null
            parseEnvironmentResponse(response.text, response.modelSnapshot)
        } catch (e: Exception) {
            Log.e(TAG, "Environment analysis failed: ${e.message}")
            null
        }
    }

    private fun extractJson(text: String): String? {
        val mdMatch = Regex("```(?:json)?\\s*(\\{[\\s\\S]*?\\})\\s*```").find(text)
        if (mdMatch != null) return mdMatch.groupValues[1]
        val start = text.indexOf('{')
        if (start < 0) return null
        var depth = 0
        for (i in start until text.length) {
            when (text[i]) {
                '{' -> depth++
                '}' -> { depth--; if (depth == 0) return text.substring(start, i + 1) }
            }
        }
        return null
    }

    private fun parseSpeciesResponse(
        text: String,
        modelSnapshot: OnDeviceFieldAiEngine.ModelSnapshot,
    ): VisionResult? {
        return try {
            val jsonStr = extractJson(text) ?: return null
            val json = JSONObject(jsonStr)
            val taxon = json.optString("taxon", json.optString("species", ""))
            if (taxon.isEmpty() || taxon == "null") return null

            VisionResult(
                scientificName = taxon,
                commonName = json.optString("common_name", ""),
                confidence = json.optDouble("confidence", 0.5).toFloat(),
                taxonomicClass = json.optString("class", ""),
                order = json.optString("order", ""),
                family = json.optString("family", ""),
                genus = json.optString("genus", ""),
                taxonRank = json.optString("rank", "species"),
                habitat = json.optString("habitat", ""),
                modelSnapshot = modelSnapshot,
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse species response: $text")
            null
        }
    }

    private fun parseEnvironmentResponse(
        text: String,
        modelSnapshot: OnDeviceFieldAiEngine.ModelSnapshot,
    ): EnvironmentResult? {
        return try {
            val jsonStr = extractJson(text) ?: return null
            val json = JSONObject(jsonStr)
            val signals = json.optJSONArray("area_resolution_signals")
            val signalList = if (signals == null) {
                emptyList()
            } else {
                (0 until signals.length()).mapNotNull { i -> signals.optString(i).takeIf { it.isNotBlank() } }
            }
            EnvironmentResult(
                habitat = json.optString("habitat", "unknown"),
                vegetation = json.optString("vegetation", ""),
                ground = json.optString("ground", ""),
                water = json.optString("water", "none"),
                canopyCoverPct = json.optInt("canopy_cover_pct", 0),
                disturbance = json.optString("disturbance", "unknown"),
                sceneDigest = json.optString("scene_digest", ""),
                areaResolutionSignals = signalList,
                modelSnapshot = modelSnapshot,
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse environment response: $text")
            null
        }
    }

    fun close() {
        fieldAi.close()
    }
}
