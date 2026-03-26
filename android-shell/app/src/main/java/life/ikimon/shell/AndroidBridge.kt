package life.ikimon.shell

import android.webkit.JavascriptInterface

class AndroidBridge(
    private val activity: MainActivity
) {
    @JavascriptInterface
    fun pickImages(optionsJson: String) {
        activity.runOnUiThread {
            activity.openImagePicker(optionsJson)
        }
    }

    @JavascriptInterface
    fun startFieldTracking(optionsJson: String) {
        activity.runOnUiThread {
            activity.startFieldTracking(optionsJson)
        }
    }

    @JavascriptInterface
    fun stopFieldTracking(optionsJson: String) {
        activity.runOnUiThread {
            activity.stopFieldTracking(optionsJson)
        }
    }

    @JavascriptInterface
    fun getTrackingState() {
        activity.runOnUiThread {
            activity.pushTrackingState()
        }
    }

    @JavascriptInterface
    fun launchOAuth(provider: String) {
        activity.runOnUiThread {
            activity.launchOAuth(provider)
        }
    }
}
