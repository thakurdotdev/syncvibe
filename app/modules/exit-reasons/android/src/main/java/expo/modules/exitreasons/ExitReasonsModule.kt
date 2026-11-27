package expo.modules.exitreasons

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PREFS = "syncvibe.exit-reasons"
private const val JS_ERROR = "js-error"
/** Enough of an ANR's thread dump to see where the main thread was stuck. */
private const val MAX_TRACE_CHARS = 12_000

/**
 * Why the app's process last ended, from Android's own records (API 30+): a crash, a native
 * crash, an ANR, a low-memory kill. Plus a fatal JS error, kept synchronously as the app goes
 * down (there's no time for anything async then). Read on the next launch and sent to the server.
 */
class ExitReasonsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExitReasons")

    AsyncFunction("recent") { since: Double ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return@AsyncFunction emptyList<Map<String, Any?>>()
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
      val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      manager.getHistoricalProcessExitReasons(context.packageName, 0, 16)
        .filter { it.timestamp > since.toLong() }
        .map { info ->
          mapOf(
            "reason" to reasonName(info.reason),
            "description" to info.description,
            "at" to info.timestamp.toDouble(),
            "importance" to info.importance,
            "pssKb" to info.pss.toDouble(),
            "rssKb" to info.rss.toDouble(),
            "trace" to anrTrace(info),
          )
        }
    }

    Function("rememberJsError") { json: String ->
      prefs()?.edit()?.putString(JS_ERROR, json)?.commit()
      Unit
    }

    AsyncFunction("takeJsError") {
      val prefs = prefs() ?: return@AsyncFunction null
      val json = prefs.getString(JS_ERROR, null)
      if (json != null) prefs.edit().remove(JS_ERROR).apply()
      json
    }
  }

  private fun prefs() = appContext.reactContext?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** An ANR comes with a text thread dump; a native crash's trace is binary, so it's left out. */
  private fun anrTrace(info: ApplicationExitInfo): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || info.reason != ApplicationExitInfo.REASON_ANR) {
      return null
    }
    return try {
      info.traceInputStream?.bufferedReader()?.use { reader ->
        val buffer = CharArray(MAX_TRACE_CHARS)
        val read = reader.read(buffer)
        if (read > 0) String(buffer, 0, read) else null
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun reasonName(reason: Int) = when (reason) {
    1 -> "exit-self"
    2 -> "signaled"
    3 -> "low-memory"
    4 -> "crash"
    5 -> "crash-native"
    6 -> "anr"
    7 -> "initialization-failure"
    8 -> "permission-change"
    9 -> "excessive-resource-usage"
    10 -> "user-requested"
    11 -> "user-stopped"
    12 -> "dependency-died"
    13 -> "other"
    14 -> "freezer"
    15 -> "package-state-change"
    16 -> "package-updated"
    else -> "unknown"
  }
}
