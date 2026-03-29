package life.ikimon.pocket

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import kotlinx.coroutines.*
import org.json.JSONObject

/**
 * 視覚AI分類器（Gemini Nano v3 on-device）
 *
 * カメラフレームをGemini Nano v3に渡し、種レベルで生物を同定する。
 * 完全オンデバイス推論 — ネットワーク不要。
 * Pixel 10 Pro (Tensor G5) で最高性能。
 */
class VisionClassifier(private val context: Context) {

    companion object {
        private const val TAG = "VisionClassifier"
        private const val FEATURE_AVAILABLE = 1  // FeatureStatus.AVAILABLE
        private const val FEATURE_DOWNLOADABLE = 3  // FeatureStatus.DOWNLOADABLE

        private const val SPECIES_PROMPT = """Identify any living organism (plant, animal, insect, fungus) visible in this photo.
Return ONLY a valid JSON object, nothing else:
{"species":"Parus minor","common_name":"Japanese Tit","confidence":0.85,"class":"Aves","order":"Passeriformes","habitat":"deciduous forest"}
If multiple organisms, return the most prominent one.
If no identifiable organism is visible, return: {"species":null}
Do NOT explain. ONLY JSON."""

        private const val ENVIRONMENT_PROMPT = """Analyze the natural environment in this photo for ecological survey.
Return ONLY a valid JSON object:
{"habitat":"deciduous_forest","vegetation":"canopy_present","ground":"leaf_litter","water":"stream_nearby","canopy_cover_pct":60,"disturbance":"low","season_cue":"spring_bloom"}
Do NOT explain. ONLY JSON."""
    }

    data class VisionResult(
        val scientificName: String,
        val commonName: String,
        val confidence: Float,
        val taxonomicClass: String,
        val order: String,
        val habitat: String = "",
    )

    data class EnvironmentResult(
        val habitat: String,
        val vegetation: String,
        val ground: String,
        val water: String,
        val canopyCoverPct: Int,
        val disturbance: String,
    )

    private var generativeModel: GenerativeModel? = null
    private var isAvailable = false

    suspend fun initialize(): Boolean {
        return try {
            val model = Generation.getClient()
            generativeModel = model

            val status = model.checkStatus()
            when (status) {
                FEATURE_AVAILABLE -> {
                    isAvailable = true
                    Log.i(TAG, "Gemini Nano v3 READY — on-device vision AI active")
                    true
                }
                FEATURE_DOWNLOADABLE -> {
                    Log.i(TAG, "Gemini Nano model downloading...")
                    model.download().collect { downloadStatus ->
                        Log.d(TAG, "Download: $downloadStatus")
                    }
                    isAvailable = true
                    true
                }
                else -> {
                    Log.w(TAG, "Gemini Nano not available on this device (status=$status)")
                    false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gemini Nano init failed: ${e.message}")
            false
        }
    }

    fun isReady(): Boolean = isAvailable

    /**
     * カメラフレームから生物種を同定する。
     */
    suspend fun classifyFrame(bitmap: Bitmap): VisionResult? {
        val model = generativeModel ?: return null
        if (!isAvailable) return null

        return try {
            val request = generateContentRequest(ImagePart(bitmap), TextPart(SPECIES_PROMPT)) {
                temperature = 0.1f
                topK = 5
            }

            val response = model.generateContent(request)
            val resultText = response.candidates.firstOrNull()?.text?.trim() ?: return null
            parseSpeciesResponse(resultText)
        } catch (e: Exception) {
            Log.e(TAG, "Vision classification failed: ${e.message}")
            null
        }
    }

    /**
     * カメラフレームから環境タイプを推定する。
     */
    suspend fun analyzeEnvironment(bitmap: Bitmap): EnvironmentResult? {
        val model = generativeModel ?: return null
        if (!isAvailable) return null

        return try {
            val request = generateContentRequest(ImagePart(bitmap), TextPart(ENVIRONMENT_PROMPT)) {
                temperature = 0.1f
                topK = 5
            }

            val response = model.generateContent(request)
            val resultText = response.candidates.firstOrNull()?.text?.trim() ?: return null
            parseEnvironmentResponse(resultText)
        } catch (e: Exception) {
            Log.e(TAG, "Environment analysis failed: ${e.message}")
            null
        }
    }

    private fun parseSpeciesResponse(text: String): VisionResult? {
        return try {
            val jsonStr = text.substringAfter("{").substringBeforeLast("}").let { "{$it}" }
            val json = JSONObject(jsonStr)
            val species = json.optString("species", "")
            if (species.isEmpty() || species == "null") return null

            VisionResult(
                scientificName = species,
                commonName = json.optString("common_name", ""),
                confidence = json.optDouble("confidence", 0.5).toFloat(),
                taxonomicClass = json.optString("class", ""),
                order = json.optString("order", ""),
                habitat = json.optString("habitat", ""),
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse species response: $text")
            null
        }
    }

    private fun parseEnvironmentResponse(text: String): EnvironmentResult? {
        return try {
            val jsonStr = text.substringAfter("{").substringBeforeLast("}").let { "{$it}" }
            val json = JSONObject(jsonStr)
            EnvironmentResult(
                habitat = json.optString("habitat", "unknown"),
                vegetation = json.optString("vegetation", ""),
                ground = json.optString("ground", ""),
                water = json.optString("water", "none"),
                canopyCoverPct = json.optInt("canopy_cover_pct", 0),
                disturbance = json.optString("disturbance", "unknown"),
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse environment response: $text")
            null
        }
    }

    fun close() {
        generativeModel?.close()
    }
}
