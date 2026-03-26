package life.ikimon.shell

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.content.ContextCompat.startForegroundService
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import life.ikimon.shell.databinding.ActivityMainBinding
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var imageBridge: AndroidBridge
    private var pendingMode: String = "gallery"
    private var pendingMultiple: Boolean = true
    private var pendingLimit: Int = 1
    private var cameraOutputUri: Uri? = null
    private var pendingTrackingAction: String? = null
    private var pendingTrackingOptions: JSONObject? = null
    private val backgroundExecutor = Executors.newSingleThreadExecutor()

    private val trackingReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent ?: return
            when (intent.action) {
                FieldTrackingService.ACTION_TRACKING_UPDATE -> {
                    val payload = intent.getStringExtra(FieldTrackingService.EXTRA_PAYLOAD) ?: return
                    dispatchTrackingUpdate(payload)
                }
                FieldTrackingService.ACTION_TRACKING_STATE -> {
                    val payload = intent.getStringExtra(FieldTrackingService.EXTRA_PAYLOAD) ?: return
                    dispatchTrackingState(payload)
                }
            }
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val granted = result.values.all { it }
        if (!granted) {
            if (pendingTrackingAction != null) {
                dispatchError("ライブスキャンを続けるには位置情報の権限が必要です。")
                pendingTrackingAction = null
                pendingTrackingOptions = null
                return@registerForActivityResult
            }
            dispatchError("写真の位置情報を使うには権限が必要です。")
            return@registerForActivityResult
        }
        if (pendingTrackingAction != null) {
            val action = pendingTrackingAction ?: return@registerForActivityResult
            val options = pendingTrackingOptions ?: JSONObject()
            pendingTrackingAction = null
            pendingTrackingOptions = null
            launchTrackingService(action, options)
            return@registerForActivityResult
        }
        launchPicker()
    }

    private val pickGalleryMedia = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK) return@registerForActivityResult
        val data = result.data ?: return@registerForActivityResult
        val uris = mutableListOf<Uri>()
        data.data?.let { uris += it }
        val clipData = data.clipData
        if (clipData != null) {
            for (index in 0 until clipData.itemCount) {
                clipData.getItemAt(index).uri?.let { uris += it }
            }
        }
        if (uris.isEmpty()) {
            dispatchError("画像を受け取れませんでした。")
            return@registerForActivityResult
        }
        handlePickedUris(uris.distinct().take(pendingLimit))
    }

    private val takePicture = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        val uri = cameraOutputUri
        if (!success || uri == null) {
            dispatchError("撮影した画像を受け取れませんでした。")
            return@registerForActivityResult
        }
        handlePickedUris(listOf(uri))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        imageBridge = AndroidBridge(this)
        configureWebView(binding.webView)
        handleIncomingIntent(intent)
        checkForAppUpdate()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        val manager = LocalBroadcastManager.getInstance(this)
        manager.registerReceiver(
            trackingReceiver,
            IntentFilter().apply {
                addAction(FieldTrackingService.ACTION_TRACKING_UPDATE)
                addAction(FieldTrackingService.ACTION_TRACKING_STATE)
            }
        )
    }

    override fun onStop() {
        LocalBroadcastManager.getInstance(this).unregisterReceiver(trackingReceiver)
        super.onStop()
    }

    override fun onDestroy() {
        backgroundExecutor.shutdown()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        CookieManager.setAcceptFileSchemeCookies(false)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            userAgentString = "${userAgentString} ${APP_USER_AGENT}"
        }
        webView.addJavascriptInterface(imageBridge, "AndroidBridge")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (isOAuthLaunchUrl(uri)) {
                    openExternalAuth(uri)
                    return true
                }
                return false
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                dispatchError("このアプリでは標準 file chooser ではなく専用 picker を使います。")
                return true
            }
        }
    }

    private fun handleIncomingIntent(intent: Intent?) {
        val uri = intent?.data
        val token = uri?.getQueryParameter("token")
        if (uri != null && isAuthCompletionUri(uri) && !token.isNullOrBlank()) {
            binding.webView.loadUrl("$BASE_URL/app_auth_redeem.php?token=${Uri.encode(token)}")
            return
        }
        if (binding.webView.url.isNullOrBlank()) {
            binding.webView.loadUrl(DEFAULT_URL)
        }
    }

    private fun checkForAppUpdate() {
        backgroundExecutor.execute {
            try {
                val connection = (URL(RELEASE_INFO_URL).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 5000
                    readTimeout = 5000
                    setRequestProperty("Accept", "application/json")
                }
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()

                val payload = JSONObject(response)
                val latestVersionCode = payload.optInt("versionCode", 0)
                if (latestVersionCode <= BuildConfig.VERSION_CODE) {
                    return@execute
                }

                val prefs = getSharedPreferences("ikimon_shell", Context.MODE_PRIVATE)
                if (prefs.getInt("dismissed_update_version_code", 0) >= latestVersionCode) {
                    return@execute
                }

                val latestVersionName = payload.optString("versionName", "")
                val downloadPageUrl = payload.optString("downloadPageUrl", "$BASE_URL/android-app.php")
                val notes = payload.optJSONArray("notes") ?: JSONArray()
                val message = buildString {
                    append("新しいベータ版 v")
                    append(latestVersionName)
                    append(" があります。\n\n")
                    if (notes.length() > 0) {
                        for (index in 0 until notes.length()) {
                            append("・")
                            append(notes.optString(index))
                            append('\n')
                        }
                    } else {
                        append("更新して最新の修正を受け取ってください。")
                    }
                }.trim()

                runOnUiThread {
                    AlertDialog.Builder(this)
                        .setTitle("更新版があります")
                        .setMessage(message)
                        .setCancelable(true)
                        .setPositiveButton("更新する") { _, _ ->
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(downloadPageUrl)))
                        }
                        .setNegativeButton("あとで") { _, _ ->
                            prefs.edit().putInt("dismissed_update_version_code", latestVersionCode).apply()
                        }
                        .show()
                }
            } catch (_: Exception) {
                // 更新確認失敗は通常利用を妨げない。
            }
        }
    }

    private fun isOAuthLaunchUrl(uri: Uri): Boolean {
        if (uri.host != Uri.parse(BASE_URL).host) {
            return false
        }
        return uri.path?.endsWith("/oauth_login.php") == true
    }

    private fun openExternalAuth(uri: Uri) {
        val externalUri = uri.buildUpon()
            .appendQueryParameter("app", "1")
            .build()
        val intent = Intent(Intent.ACTION_VIEW, externalUri).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
        }
        startActivity(intent)
    }

    fun launchOAuth(provider: String) {
        val normalized = provider.lowercase()
        if (normalized != "google" && normalized != "twitter") {
            dispatchError("未対応のログイン方式です。")
            return
        }
        openExternalAuth(Uri.parse("$BASE_URL/oauth_login.php?provider=$normalized"))
    }

    private fun isAuthCompletionUri(uri: Uri): Boolean {
        return uri.scheme == "https"
            && uri.host == Uri.parse(BASE_URL).host
            && uri.path == "/app_auth_complete.php"
    }

    fun openImagePicker(optionsJson: String) {
        try {
            val options = JSONObject(optionsJson)
            pendingMode = options.optString("mode", "gallery")
            pendingMultiple = options.optBoolean("multiple", pendingMode != "camera")
            pendingLimit = options.optInt("limit", if (pendingMultiple) 5 else 1).coerceIn(1, 5)
        } catch (_: Exception) {
            pendingMode = "gallery"
            pendingMultiple = true
            pendingLimit = 5
        }

        if (hasRequiredPermissions()) {
            launchPicker()
        } else {
            permissionLauncher.launch(requiredPermissions())
        }
    }

    fun startFieldTracking(optionsJson: String) {
        val options = try {
            JSONObject(optionsJson)
        } catch (_: Exception) {
            JSONObject()
        }
        pendingTrackingAction = FieldTrackingService.COMMAND_START
        pendingTrackingOptions = options
        if (hasTrackingPermissions()) {
            launchTrackingService(FieldTrackingService.COMMAND_START, options)
        } else {
            permissionLauncher.launch(trackingPermissions())
        }
    }

    fun stopFieldTracking(optionsJson: String) {
        val options = try {
            JSONObject(optionsJson)
        } catch (_: Exception) {
            JSONObject()
        }
        launchTrackingService(FieldTrackingService.COMMAND_STOP, options)
    }

    fun pushTrackingState() {
        launchTrackingService(FieldTrackingService.COMMAND_STATE, JSONObject())
    }

    private fun launchPicker() {
        if (pendingMode == "camera") {
            launchCameraCapture()
            return
        }

        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, pendingMultiple)
        }
        pickGalleryMedia.launch(Intent.createChooser(intent, "画像を選択"))
    }

    private fun launchCameraCapture() {
        val outputFile = File(cacheDir, "capture_${System.currentTimeMillis()}.jpg")
        val authority = "${packageName}.fileprovider"
        cameraOutputUri = FileProvider.getUriForFile(
            this,
            authority,
            outputFile
        )
        val launchUri = cameraOutputUri ?: run {
            dispatchError("カメラの保存先を作れませんでした。")
            return
        }
        takePicture.launch(launchUri)
    }

    private fun handlePickedUris(uris: List<Uri>) {
        val items = JSONArray()
        uris.forEach { uri ->
            val item = MediaPayloadBuilder.build(contentResolver, uri)
            items.put(item)
        }
        val payload = JSONObject().put("items", items)
        dispatchSelected(payload.toString())
    }

    private fun hasRequiredPermissions(): Boolean {
        return requiredPermissions().all { permission ->
            ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun hasTrackingPermissions(): Boolean {
        val required = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            required += Manifest.permission.ACCESS_BACKGROUND_LOCATION
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            required += Manifest.permission.POST_NOTIFICATIONS
        }
        return required.all { permission ->
            ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requiredPermissions(): Array<String> {
        val permissions = mutableListOf(Manifest.permission.ACCESS_MEDIA_LOCATION)
        if (pendingMode == "camera") {
            permissions += Manifest.permission.CAMERA
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions += Manifest.permission.READ_MEDIA_IMAGES
        } else {
            permissions += Manifest.permission.READ_EXTERNAL_STORAGE
        }
        return permissions.toTypedArray()
    }

    private fun trackingPermissions(): Array<String> {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions += Manifest.permission.ACCESS_BACKGROUND_LOCATION
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions += Manifest.permission.POST_NOTIFICATIONS
        }
        return permissions.toTypedArray()
    }

    private fun dispatchSelected(payloadJson: String) {
        val escaped = JSONObject.quote(payloadJson)
        binding.webView.post {
            binding.webView.evaluateJavascript(
                "window.__IKIMON_ANDROID__ && window.__IKIMON_ANDROID__.onMediaSelected($escaped);",
                null
            )
        }
    }

    private fun dispatchTrackingUpdate(payloadJson: String) {
        val escaped = JSONObject.quote(payloadJson)
        binding.webView.post {
            binding.webView.evaluateJavascript(
                "window.__IKIMON_ANDROID_TRACKING__ && window.__IKIMON_ANDROID_TRACKING__.onTrackingUpdate($escaped);",
                null
            )
        }
    }

    private fun dispatchTrackingState(payloadJson: String) {
        val escaped = JSONObject.quote(payloadJson)
        binding.webView.post {
            binding.webView.evaluateJavascript(
                "window.__IKIMON_ANDROID_TRACKING__ && window.__IKIMON_ANDROID_TRACKING__.onTrackingState($escaped);",
                null
            )
        }
    }

    private fun dispatchError(message: String) {
        val escaped = JSONObject.quote(message)
        binding.webView.post {
            binding.webView.evaluateJavascript(
                "window.__IKIMON_ANDROID__ && window.__IKIMON_ANDROID__.onMediaError($escaped);",
                null
            )
        }
    }

    private fun launchTrackingService(command: String, options: JSONObject) {
        val intent = Intent(this, FieldTrackingService::class.java).apply {
            action = command
            putExtra(FieldTrackingService.EXTRA_OPTIONS, options.toString())
        }
        if (command == FieldTrackingService.COMMAND_START) {
            startForegroundService(this, intent)
            return
        }
        startService(intent)
    }

    companion object {
        private const val BASE_URL = "https://ikimon.life"
        private const val DEFAULT_URL = "https://ikimon.life/post.php"
        private const val APP_USER_AGENT = "ikimon-shell/0.1.0"
        private const val RELEASE_INFO_URL = "https://ikimon.life/api/android_app_release.php"
    }
}
