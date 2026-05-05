package life.ikimon.pocket

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.ModelPreference
import com.google.mlkit.genai.prompt.ModelReleaseStage
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import com.google.mlkit.genai.prompt.generationConfig
import com.google.mlkit.genai.prompt.modelConfig
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * AICore / Gemini Nano model selection for field use.
 *
 * Official ML Kit Prompt API guidance is to request PREVIEW+FAST or PREVIEW+FULL
 * explicitly, then fall back through checkStatus() when a device cannot serve it.
 */
class OnDeviceFieldAiEngine {

    enum class Profile(
        val releaseStageLabel: String,
        val preferenceLabel: String,
    ) {
        FAST("PREVIEW", "FAST"),
        FULL("PREVIEW", "FULL"),
        STABLE_FULL("STABLE", "FULL"),
        DEFAULT("DEFAULT", "DEFAULT"),
    }

    data class ModelSnapshot(
        val baseModelName: String,
        val releaseStage: String,
        val preference: String,
        val foregroundAiAvailable: Boolean,
        val fallbackReason: String? = null,
    ) {
        companion object {
            fun unavailable(reason: String): ModelSnapshot = ModelSnapshot(
                baseModelName = "unavailable",
                releaseStage = "UNAVAILABLE",
                preference = "UNAVAILABLE",
                foregroundAiAvailable = false,
                fallbackReason = reason,
            )
        }
    }

    data class FieldAiResponse(
        val text: String,
        val modelSnapshot: ModelSnapshot,
    )

    private data class ModelHandle(
        val model: GenerativeModel,
        val snapshot: ModelSnapshot,
    )

    companion object {
        private const val TAG = "OnDeviceFieldAiEngine"
        private const val FEATURE_AVAILABLE = 1
        private const val FEATURE_DOWNLOADABLE = 3
    }

    private val mutex = Mutex()
    private val handles = mutableMapOf<Profile, ModelHandle>()

    suspend fun snapshotFor(profile: Profile): ModelSnapshot {
        return prepare(profile).snapshot
    }

    suspend fun generateImageJson(
        bitmap: Bitmap,
        prompt: String,
        profile: Profile,
        temperature: Float = 0.1f,
        topK: Int = 5,
    ): FieldAiResponse {
        val handle = prepare(profile)
        if (!handle.snapshot.foregroundAiAvailable) {
            return FieldAiResponse("", handle.snapshot)
        }

        val request = generateContentRequest(ImagePart(bitmap), TextPart(prompt)) {
            this.temperature = temperature
            this.topK = topK
            candidateCount = 1
        }
        val response = handle.model.generateContent(request)
        return FieldAiResponse(
            text = response.candidates.firstOrNull()?.text?.trim().orEmpty(),
            modelSnapshot = handle.snapshot,
        )
    }

    suspend fun generateText(
        prompt: String,
        profile: Profile,
        temperature: Float = 0.2f,
        topK: Int = 10,
    ): FieldAiResponse {
        val handle = prepare(profile)
        if (!handle.snapshot.foregroundAiAvailable) {
            return FieldAiResponse("", handle.snapshot)
        }

        val request = generateContentRequest(TextPart(prompt)) {
            this.temperature = temperature
            this.topK = topK
            candidateCount = 1
            maxOutputTokens = 256
        }
        val response = handle.model.generateContent(request)
        return FieldAiResponse(
            text = response.candidates.firstOrNull()?.text?.trim().orEmpty(),
            modelSnapshot = handle.snapshot,
        )
    }

    fun close() {
        handles.values.forEach { handle -> runCatching { handle.model.close() } }
        handles.clear()
    }

    private suspend fun prepare(requested: Profile): ModelHandle = mutex.withLock {
        handles[requested]?.let { return@withLock it }

        val candidates = when (requested) {
            Profile.FAST -> listOf(Profile.FAST, Profile.STABLE_FULL, Profile.DEFAULT)
            Profile.FULL -> listOf(Profile.FULL, Profile.STABLE_FULL, Profile.DEFAULT)
            Profile.STABLE_FULL -> listOf(Profile.STABLE_FULL, Profile.DEFAULT)
            Profile.DEFAULT -> listOf(Profile.DEFAULT)
        }

        var lastReason = "model_not_checked"
        for (candidate in candidates) {
            val model = createModel(candidate)
            val status = try {
                model.checkStatus()
            } catch (error: Exception) {
                lastReason = "${candidate.name}:check_failed:${error.javaClass.simpleName}"
                Log.w(TAG, "checkStatus failed for ${candidate.name}: ${error.message}")
                runCatching { model.close() }
                continue
            }

            if (status == FEATURE_DOWNLOADABLE) {
                runCatching { model.download().collect { Log.d(TAG, "${candidate.name} download: $it") } }
                    .onFailure { error -> Log.w(TAG, "${candidate.name} download failed: ${error.message}") }
            }

            val ready = status == FEATURE_AVAILABLE || status == FEATURE_DOWNLOADABLE
            if (ready) {
                val snapshot = ModelSnapshot(
                    baseModelName = resolveBaseModelName(model),
                    releaseStage = candidate.releaseStageLabel,
                    preference = candidate.preferenceLabel,
                    foregroundAiAvailable = true,
                    fallbackReason = if (candidate == requested) null else "fallback_from_${requested.name.lowercase()}",
                )
                val handle = ModelHandle(model, snapshot)
                handles[requested] = handle
                return@withLock handle
            }

            lastReason = "${candidate.name}:status_$status"
            runCatching { model.close() }
        }

        val fallback = ModelHandle(
            model = Generation.getClient(),
            snapshot = ModelSnapshot.unavailable(lastReason),
        )
        handles[requested] = fallback
        fallback
    }

    private fun createModel(profile: Profile): GenerativeModel {
        return when (profile) {
            Profile.FAST -> Generation.getClient(generationConfig {
                modelConfig = modelConfig {
                    releaseStage = ModelReleaseStage.PREVIEW
                    preference = ModelPreference.FAST
                }
            })
            Profile.FULL -> Generation.getClient(generationConfig {
                modelConfig = modelConfig {
                    releaseStage = ModelReleaseStage.PREVIEW
                    preference = ModelPreference.FULL
                }
            })
            Profile.STABLE_FULL -> Generation.getClient(generationConfig {
                modelConfig = modelConfig {
                    releaseStage = ModelReleaseStage.STABLE
                    preference = ModelPreference.FULL
                }
            })
            Profile.DEFAULT -> Generation.getClient()
        }
    }

    private fun resolveBaseModelName(model: GenerativeModel): String {
        return runCatching {
            val method = model.javaClass.methods.firstOrNull { it.name == "getBaseModelName" }
            method?.invoke(model)?.toString()
        }.getOrNull()?.takeIf { it.isNotBlank() } ?: "unknown"
    }
}
