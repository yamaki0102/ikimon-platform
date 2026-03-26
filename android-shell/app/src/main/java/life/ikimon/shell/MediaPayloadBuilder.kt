package life.ikimon.shell

import android.content.ContentResolver
import android.database.Cursor
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object MediaPayloadBuilder {

    fun build(contentResolver: ContentResolver, uri: Uri): JSONObject {
        val originalUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.setRequireOriginal(uri)
        } else {
            uri
        }

        val item = JSONObject()
        val name = queryDisplayName(contentResolver, uri) ?: "photo_${System.currentTimeMillis()}.jpg"
        val mimeType = contentResolver.getType(uri) ?: "image/jpeg"

        item.put("name", name)
        item.put("mimeType", mimeType)
        item.put("dataUrl", toDataUrl(contentResolver, uri, mimeType))

        try {
            contentResolver.openInputStream(originalUri)?.use { input ->
                val exif = ExifInterface(input)
                val latLong = FloatArray(2)
                if (exif.getLatLong(latLong)) {
                    item.put("lat", latLong[0].toDouble())
                    item.put("lng", latLong[1].toDouble())
                }

                val observedAt = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)
                    ?: exif.getAttribute(ExifInterface.TAG_DATETIME)
                if (!observedAt.isNullOrBlank()) {
                    item.put("observedAt", normalizeExifDate(observedAt))
                }
            }
        } catch (_: Exception) {
            // Web 側で現在地フォールバックできるので無理に失敗にしない。
        }

        return item
    }

    private fun queryDisplayName(contentResolver: ContentResolver, uri: Uri): String? {
        val projection = arrayOf(MediaStore.MediaColumns.DISPLAY_NAME)
        val cursor: Cursor = contentResolver.query(uri, projection, null, null, null) ?: return null
        cursor.use {
            if (!it.moveToFirst()) return null
            return it.getString(0)
        }
    }

    private fun toDataUrl(contentResolver: ContentResolver, uri: Uri, mimeType: String): String {
        val bytes = contentResolver.openInputStream(uri)?.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                output.write(buffer, 0, read)
            }
            output.toByteArray()
        } ?: ByteArray(0)

        return "data:$mimeType;base64,${android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)}"
    }

    private fun normalizeExifDate(value: String): String {
        return try {
            val formatter = DateTimeFormatter.ofPattern("yyyy:MM:dd HH:mm:ss")
            val local = java.time.LocalDateTime.parse(value, formatter)
            local.atZone(ZoneId.systemDefault()).toOffsetDateTime().toString()
        } catch (_: Exception) {
            value
        }
    }
}
