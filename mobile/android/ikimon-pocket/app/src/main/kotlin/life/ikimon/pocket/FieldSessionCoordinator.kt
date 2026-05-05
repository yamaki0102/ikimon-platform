package life.ikimon.pocket

import android.content.Context
import android.content.Intent
import android.location.Location
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import life.ikimon.api.AppAuthManager
import life.ikimon.api.InstallIdentityManager
import life.ikimon.api.MobileFieldSessionClient
import life.ikimon.data.DetectionEvent
import life.ikimon.data.EventBuffer
import life.ikimon.ui.MainActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object FieldSessionCoordinator {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var eventBuffer = EventBuffer()
    private var sessionId: String = ""
    private var movementMode: String = "walk"
    private var sessionIntent: String = "official"
    private var officialRecord: Boolean = true
    private var testProfile: String = "field"
    private var latestLat: Double? = null
    private var latestLng: Double? = null
    private var latestAlt: Double? = null

    @Synchronized
    fun start(
        context: Context,
        sessionId: String,
        sessionIntent: String,
        officialRecord: Boolean,
        testProfile: String,
        movementMode: String,
    ) {
        this.eventBuffer = EventBuffer()
        this.sessionId = sessionId
        this.sessionIntent = if (sessionIntent == "test") "test" else "official"
        this.officialRecord = officialRecord
        this.testProfile = if (this.sessionIntent == "test") testProfile else "field"
        this.movementMode = movementMode
        eventBuffer.setSessionMode(this.sessionIntent, officialRecord, this.testProfile)
        scope.launch { MobileFieldSessionClient.start(context, sessionId, movementMode) }
    }

    @Synchronized
    fun updateLocation(location: Location) {
        latestLat = location.latitude
        latestLng = location.longitude
        latestAlt = location.altitude
        eventBuffer.updateLocation(location.latitude, location.longitude, location.altitude)
    }

    fun currentLocation(): Pair<Double?, Double?> = synchronized(this) { latestLat to latestLng }
    fun currentSessionId(): String = synchronized(this) { sessionId }

    fun addEvent(context: Context, raw: DetectionEvent, isFused: Boolean = false): DetectionEvent {
        val normalized = withSessionIdentity(context, raw)
        synchronized(this) { eventBuffer.add(normalized) }
        publish(context, normalized, isFused)
        scope.launch {
            if (normalized.type == "audio") {
                MobileFieldSessionClient.sendAudioEvents(context, sessionId, listOf(normalized))
            }
            if (!normalized.sceneDigest.isNullOrBlank()) {
                MobileFieldSessionClient.sendSceneDigest(context, sessionId, normalized)
            }
        }
        return normalized
    }

    fun summary(): EventBuffer.Summary = synchronized(this) { eventBuffer.getSummary() }

    fun persistSessionLog(context: Context, mode: String, metadata: Map<String, Any?>): File {
        return synchronized(this) {
            eventBuffer.persistSessionLog(context, sessionId, mode, metadata)
        }
    }

    fun finish(context: Context) {
        scope.launch { MobileFieldSessionClient.end(context, sessionId) }
    }

    private fun withSessionIdentity(context: Context, event: DetectionEvent): DetectionEvent {
        val login = AppAuthManager.currentState(context)
        val installId = InstallIdentityManager.getOrCreateInstallId(context)
        val (lat, lng) = synchronized(this) { latestLat to latestLng }
        val authState = if (login.isLoggedIn) "logged_in" else "anonymous"
        val normalizedMode = movementMode.takeIf { it == "vehicle" || it == "focus" } ?: "walk"
        val modelBaseName = event.onDeviceModelBaseName ?: event.model
        return event.copy(
            lat = event.lat ?: lat,
            lng = event.lng ?: lng,
            ikimonUserId = login.userId.takeIf { login.isLoggedIn && it.isNotBlank() },
            installId = installId,
            userAuthState = authState,
            movementMode = normalizedMode,
            monitoringContext = event.monitoringContext ?: buildMonitoringContext(
                event = event,
                movementMode = normalizedMode,
                userAuthState = authState,
                modelBaseName = modelBaseName,
            ),
        )
    }

    private fun buildMonitoringContext(
        event: DetectionEvent,
        movementMode: String,
        userAuthState: String,
        modelBaseName: String,
    ): JSONObject {
        val method = when (movementMode) {
            "vehicle" -> "vehicle_transect"
            "focus" -> "stationary_focus"
            else -> "walk_transect"
        }
        val evidenceType = when {
            event.type == "audio" -> "audio_ai"
            event.scientificName == "environment_context" -> "environment_digest"
            event.type == "visual" -> "image_ai"
            else -> "field_signal"
        }
        val textForTheme = listOfNotNull(
            event.sceneDigest,
            event.order,
            event.taxonName,
            event.scientificName,
            event.areaResolutionSignals.joinToString(" "),
        ).joinToString(" ").lowercase()
        val themes = mutableListOf("Terrestrial", "Data Management", "Mass Monitoring")
        if (listOf("water", "river", "stream", "pond", "lake", "wetland", "水", "川", "沢", "池", "湖", "湿地").any { textForTheme.contains(it) }) {
            themes.add("Freshwater")
        }
        return JSONObject().apply {
            put("method", method)
            put("effort", JSONObject().apply {
                put("unit", "opportunistic_scene")
                put("movement_mode", movementMode)
                put("foreground_ai", event.foregroundAiAvailable ?: false)
            })
            put("survey_period", "mobile_session")
            put("evidence_type", evidenceType)
            put("confidence", event.confidence.toDouble())
            put("observer_role", if (userAuthState == "logged_in") "registered_citizen" else "anonymous_field_user")
            put("themes", JSONArray(themes))
            put("quality", JSONObject().apply {
                put("ai_basis", JSONArray(listOf(event.type, evidenceType, modelBaseName)))
                put("ai_confidence", event.confidence.toDouble())
                put("human_review", "not_reviewed")
                put("raw_media_stored", false)
                put("fair_reuse", "digest_and_features_only")
            })
            put("report_axes", JSONArray(listOf(
                "monitoring_readiness",
                "data_gap",
                "policy_ready_evidence",
                "recommended_next_survey",
                "local_knowledge_governance",
            )))
        }
    }

    private fun publish(context: Context, event: DetectionEvent, isFused: Boolean) {
        context.sendBroadcast(Intent(MainActivity.ACTION_DETECTION).apply {
            putExtra("taxon_name", event.taxonName)
            putExtra("scientific_name", event.scientificName)
            putExtra("confidence", event.confidence)
            putExtra("type", event.type)
            putExtra("taxonomic_class", event.taxonomicClass ?: "")
            putExtra("taxon_rank", event.taxonRank)
            putExtra("is_fused", isFused)
            putExtra("scene_digest", event.sceneDigest ?: "")
            putExtra("model_base_name", event.onDeviceModelBaseName ?: event.model)
        })
    }
}
