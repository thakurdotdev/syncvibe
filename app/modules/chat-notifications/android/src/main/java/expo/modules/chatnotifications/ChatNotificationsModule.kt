package expo.modules.chatnotifications

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

private const val TAG = "ChatNotifications"
/** expo-notifications posts each notification under its identifier as the tag, always with id 0. */
private const val EXPO_NOTIFY_ID = 0
private const val TIMEOUT_MS = 8000
/** The notification is posted by a service, slightly after scheduleNotificationAsync resolves. */
private const val FIND_ATTEMPTS = 15
private const val FIND_INTERVAL_MS = 200L

/**
 * Adds a photo to a message notification that expo-notifications has already posted. Its own
 * builder can't show one. The notification is rebuilt from itself, so its tap, Reply and Mark as
 * read keep working exactly as expo-notifications set them up.
 */
class ChatNotificationsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ChatNotifications")

    // Resolves to whether the photo was added.
    AsyncFunction("showPicture") Coroutine { tag: String, imageUrl: String, text: String, summary: String ->
      showPicture(tag, imageUrl, text, summary)
    }
  }

  private suspend fun showPicture(tag: String, imageUrl: String, text: String, summary: String): Boolean {
    if (!imageUrl.startsWith("https://")) return false
    val bitmap = withContext(Dispatchers.IO) { download(imageUrl) } ?: return false
    val manager = context.getSystemService(NotificationManager::class.java) ?: return false
    val posted = findPosted(manager, tag, text) ?: return false

    return try {
      val builder = Notification.Builder.recoverBuilder(context, posted)
      val style = Notification.BigPictureStyle().bigPicture(bitmap).setSummaryText(summary)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        style.showBigPictureWhenCollapsed(true)
      } else {
        // Before Android 12 the collapsed notification shows the photo as its icon instead.
        builder.setLargeIcon(bitmap)
        style.bigLargeIcon(null as Bitmap?)
      }
      // It already sounded when it was posted.
      builder.setStyle(style).setOnlyAlertOnce(true)
      manager.notify(tag, EXPO_NOTIFY_ID, builder.build())
      true
    } catch (error: Exception) {
      Log.w(TAG, "Adding the photo to a notification failed", error)
      false
    }
  }

  /**
   * The posted notification, once it shows `text`. Waiting for that text also means a newer
   * message that replaced it while the photo downloaded is left alone.
   */
  private suspend fun findPosted(manager: NotificationManager, tag: String, text: String): Notification? {
    repeat(FIND_ATTEMPTS) {
      val match = manager.activeNotifications.firstOrNull {
        it.tag == tag &&
          it.id == EXPO_NOTIFY_ID &&
          it.notification.extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() == text
      }
      if (match != null) return match.notification
      delay(FIND_INTERVAL_MS)
    }
    return null
  }

  private fun download(url: String): Bitmap? {
    var connection: HttpURLConnection? = null
    return try {
      connection = URL(url).openConnection() as HttpURLConnection
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      if (connection.responseCode !in 200..299) null
      else connection.inputStream.use { BitmapFactory.decodeStream(it) }
    } catch (error: Exception) {
      Log.w(TAG, "Downloading a notification photo failed", error)
      null
    } finally {
      connection?.disconnect()
    }
  }
}
