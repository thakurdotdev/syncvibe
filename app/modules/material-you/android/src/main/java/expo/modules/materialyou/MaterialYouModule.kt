package expo.modules.materialyou

import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The wallpaper colours Android 12+ hands every app ("Material You"): five tonal palettes of 13
 * shades each, from shade 0 (white) to 1000 (black). The app turns them into its own colour
 * roles in theme/materialYou.ts.
 */
class MaterialYouModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MaterialYou")

    // Null before Android 12. Read again whenever the app comes back to the front, because the
    // user may have changed the wallpaper meanwhile.
    Function("getPalettes") { readPalettes() }
  }

  private fun readPalettes(): Map<String, List<String>>? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
    // The activity's resources are the ones Android refreshes when the wallpaper changes.
    val context: Context = appContext.currentActivity ?: appContext.reactContext ?: return null
    val palettes = mapOf(
      "accent1" to intArrayOf(
        android.R.color.system_accent1_0, android.R.color.system_accent1_10,
        android.R.color.system_accent1_50, android.R.color.system_accent1_100,
        android.R.color.system_accent1_200, android.R.color.system_accent1_300,
        android.R.color.system_accent1_400, android.R.color.system_accent1_500,
        android.R.color.system_accent1_600, android.R.color.system_accent1_700,
        android.R.color.system_accent1_800, android.R.color.system_accent1_900,
        android.R.color.system_accent1_1000,
      ),
      "accent2" to intArrayOf(
        android.R.color.system_accent2_0, android.R.color.system_accent2_10,
        android.R.color.system_accent2_50, android.R.color.system_accent2_100,
        android.R.color.system_accent2_200, android.R.color.system_accent2_300,
        android.R.color.system_accent2_400, android.R.color.system_accent2_500,
        android.R.color.system_accent2_600, android.R.color.system_accent2_700,
        android.R.color.system_accent2_800, android.R.color.system_accent2_900,
        android.R.color.system_accent2_1000,
      ),
      "accent3" to intArrayOf(
        android.R.color.system_accent3_0, android.R.color.system_accent3_10,
        android.R.color.system_accent3_50, android.R.color.system_accent3_100,
        android.R.color.system_accent3_200, android.R.color.system_accent3_300,
        android.R.color.system_accent3_400, android.R.color.system_accent3_500,
        android.R.color.system_accent3_600, android.R.color.system_accent3_700,
        android.R.color.system_accent3_800, android.R.color.system_accent3_900,
        android.R.color.system_accent3_1000,
      ),
      "neutral1" to intArrayOf(
        android.R.color.system_neutral1_0, android.R.color.system_neutral1_10,
        android.R.color.system_neutral1_50, android.R.color.system_neutral1_100,
        android.R.color.system_neutral1_200, android.R.color.system_neutral1_300,
        android.R.color.system_neutral1_400, android.R.color.system_neutral1_500,
        android.R.color.system_neutral1_600, android.R.color.system_neutral1_700,
        android.R.color.system_neutral1_800, android.R.color.system_neutral1_900,
        android.R.color.system_neutral1_1000,
      ),
      "neutral2" to intArrayOf(
        android.R.color.system_neutral2_0, android.R.color.system_neutral2_10,
        android.R.color.system_neutral2_50, android.R.color.system_neutral2_100,
        android.R.color.system_neutral2_200, android.R.color.system_neutral2_300,
        android.R.color.system_neutral2_400, android.R.color.system_neutral2_500,
        android.R.color.system_neutral2_600, android.R.color.system_neutral2_700,
        android.R.color.system_neutral2_800, android.R.color.system_neutral2_900,
        android.R.color.system_neutral2_1000,
      ),
    )
    return palettes.mapValues { (_, ids) ->
      ids.map { id -> String.format("#%06X", context.getColor(id) and 0xFFFFFF) }
    }
  }
}
