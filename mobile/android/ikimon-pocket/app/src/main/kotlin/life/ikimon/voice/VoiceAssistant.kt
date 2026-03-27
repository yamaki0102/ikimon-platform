package life.ikimon.voice

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * AI 会話型フィールドガイド — オーケストレーター
 *
 * PTT (Push-to-Talk) フロー:
 * 1. ユーザーがマイクボタンを押す → SpeechInputManager で音声認識開始
 * 2. 発話完了 → テキスト化
 * 3. ConversationContext + テキストを field_assistant API に送信
 * 4. AI 応答テキストを受信
 * 5. SpeechOutputManager で読み上げ
 *
 * ハイブリッド方式: 端末STT → Gemini Flash Lite テキストAPI → 端末TTS
 * コスト: ~¥0.075/回の質問応答
 */
class VoiceAssistant(private val context: Context) {

    private val TAG = "VoiceAssistant"

    private val speechInput = SpeechInputManager(context)
    private val speechOutput = SpeechOutputManager(context)
    val conversationContext = ConversationContext()

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    enum class State { IDLE, LISTENING, THINKING, SPEAKING }

    var state: State = State.IDLE
        private set

    var onStateChanged: ((State) -> Unit)? = null
    var onPartialText: ((String) -> Unit)? = null
    var onReply: ((String) -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    companion object {
        private const val API_URL = "https://ikimon.life/api/v2/field_assistant.php"
    }

    init {
        speechInput.onStateChanged = { inputState ->
            when (inputState) {
                SpeechInputManager.State.LISTENING -> updateState(State.LISTENING)
                SpeechInputManager.State.PROCESSING -> updateState(State.THINKING)
                else -> {}
            }
        }

        speechOutput.onSpeakingChanged = { isSpeaking ->
            if (!isSpeaking && state == State.SPEAKING) {
                updateState(State.IDLE)
            }
        }
    }

    fun isAvailable(): Boolean = speechInput.isAvailable()

    /**
     * PTT: マイクボタンを押したときに呼ぶ
     */
    fun startListening() {
        if (state != State.IDLE) return

        speechOutput.stop()

        speechInput.startListening { result ->
            if (result.isPartial) {
                onPartialText?.invoke(result.text)
                return@startListening
            }

            if (result.text.isBlank()) {
                updateState(State.IDLE)
                return@startListening
            }

            processUserMessage(result.text)
        }
    }

    /**
     * テキスト入力（フォールバック or 補助）
     */
    fun sendTextMessage(text: String) {
        if (text.isBlank()) return
        processUserMessage(text)
    }

    fun stopSpeaking() {
        speechOutput.stop()
        updateState(State.IDLE)
    }

    fun cancel() {
        speechInput.stopListening()
        speechOutput.stop()
        updateState(State.IDLE)
    }

    fun destroy() {
        cancel()
        speechInput.destroy()
        speechOutput.destroy()
        scope.cancel()
    }

    private fun processUserMessage(text: String) {
        updateState(State.THINKING)
        conversationContext.addUserMessage(text)

        scope.launch {
            try {
                val reply = callFieldAssistantApi(text)
                if (reply != null) {
                    conversationContext.addAssistantMessage(reply)
                    onReply?.invoke(reply)
                    updateState(State.SPEAKING)
                    speechOutput.speak(reply)
                } else {
                    updateState(State.IDLE)
                    onError?.invoke("応答を取得できませんでした")
                }
            } catch (e: Exception) {
                Log.e(TAG, "API error", e)
                updateState(State.IDLE)
                onError?.invoke("通信エラー: ${e.message}")
            }
        }
    }

    private suspend fun callFieldAssistantApi(userMessage: String): String? =
        withContext(Dispatchers.IO) {
            val requestBody = conversationContext.buildRequestBody(userMessage)

            val request = Request.Builder()
                .url(API_URL)
                .post(requestBody.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.w(TAG, "API returned ${response.code}")
                return@withContext null
            }

            val body = response.body?.string() ?: return@withContext null
            val json = JSONObject(body)

            if (json.optBoolean("success", false)) {
                json.optJSONObject("data")?.optString("reply", null)
            } else {
                val error = json.optJSONObject("error")?.optString("message", "unknown")
                Log.w(TAG, "API error: $error")
                null
            }
        }

    private fun updateState(newState: State) {
        state = newState
        onStateChanged?.invoke(newState)
        Log.d(TAG, "State: $newState")
    }
}
