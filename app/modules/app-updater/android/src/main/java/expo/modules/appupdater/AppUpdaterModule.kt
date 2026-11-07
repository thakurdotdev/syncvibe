package expo.modules.appupdater

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
private const val UPDATES_DIR = "updates"
private const val HASH_BUFFER_BYTES = 64 * 1024

private class UpdateStorageUnavailableException :
  CodedException(message = "External app storage is not available")

private class UpdateFileMissingException :
  CodedException(message = "The downloaded update is no longer on this device")

/**
 * Downloads the update through the system DownloadManager and hands it to the system installer.
 *
 * The download runs in the system's own process, so a 150 MB APK costs this app no memory, keeps
 * going when the app is closed, and shows the system's progress notification. Hashing reads the
 * file through one small buffer. Nothing here loads the APK into memory.
 */
class AppUpdaterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val downloadManager: DownloadManager
    get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  override fun definition() = ModuleDefinition {
    Name("AppUpdater")

    AsyncFunction("startDownload") { url: String, version: String, title: String ->
      enqueueDownload(url, version, title)
    }

    AsyncFunction("getDownload") { id: Long ->
      queryDownload(id)
    }

    AsyncFunction("removeDownload") { id: Long ->
      downloadManager.remove(id)
      Unit
    }

    AsyncFunction("verify") Coroutine { version: String, sha256: String?, size: Long? ->
      withContext(Dispatchers.IO) { verifyApk(version, sha256, size) }
    }

    AsyncFunction("canInstall") { ->
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()
    }

    AsyncFunction("openInstallSettings") { ->
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
      } else {
        Intent(Settings.ACTION_SECURITY_SETTINGS)
      }
      appContext.throwingActivity.startActivity(intent)
    }

    AsyncFunction("install") { version: String ->
      val file = apkFile(version)
      if (!file.isFile) throw UpdateFileMissingException()
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.appupdater.provider", file)
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri, APK_MIME_TYPE)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      // Not for result: nothing waits on the installer, and it may kill this process on success.
      appContext.throwingActivity.startActivity(intent)
    }

    AsyncFunction("cleanup") Coroutine { ->
      withContext(Dispatchers.IO) {
        updatesDir().listFiles()?.forEach { it.delete() }
        // Where versions before this module kept their APKs. Nothing else ever removed those.
        File(context.filesDir, UPDATES_DIR).deleteRecursively()
      }
      Unit
    }
  }

  private fun updatesDir(): File =
    context.getExternalFilesDir(UPDATES_DIR) ?: throw UpdateStorageUnavailableException()

  private fun apkName(version: String) =
    "SyncVibe-${version.replace(Regex("[^0-9A-Za-z._-]"), "_")}.apk"

  private fun apkFile(version: String) = File(updatesDir(), apkName(version))

  private fun enqueueDownload(url: String, version: String, title: String): Long {
    // DownloadManager writes to "name-1.apk" when the name is taken, and installs look for the name.
    updatesDir().listFiles()?.forEach { it.delete() }
    val request = DownloadManager.Request(Uri.parse(url))
      .setTitle(title)
      .setMimeType(APK_MIME_TYPE)
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
      .setAllowedOverMetered(true)
      .setAllowedOverRoaming(true)
      .setDestinationInExternalFilesDir(context, UPDATES_DIR, apkName(version))
    return downloadManager.enqueue(request)
  }

  private fun queryDownload(id: Long): Bundle? {
    val cursor = downloadManager.query(DownloadManager.Query().setFilterById(id)) ?: return null
    return cursor.use {
      if (!it.moveToFirst()) return@use null
      val status = when (it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
        DownloadManager.STATUS_RUNNING -> "running"
        DownloadManager.STATUS_PAUSED -> "paused"
        DownloadManager.STATUS_SUCCESSFUL -> "successful"
        DownloadManager.STATUS_FAILED -> "failed"
        else -> "pending"
      }
      Bundle().apply {
        putString("status", status)
        putDouble(
          "bytesDownloaded",
          it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).toDouble()
        )
        putDouble(
          "totalBytes",
          it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).toDouble()
        )
        putInt("reason", it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)))
      }
    }
  }

  private fun verifyApk(version: String, sha256: String?, size: Long?): String {
    val file = apkFile(version)
    if (!file.isFile) return "missing"
    if (size != null && file.length() != size) return "size"
    if (!sha256.isNullOrBlank() && !sha256Of(file).equals(sha256.trim(), ignoreCase = true)) {
      return "checksum"
    }
    return checkInstallable(file)
  }

  private fun sha256Of(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(HASH_BUFFER_BYTES)
    file.inputStream().use { input ->
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { (it.toInt() and 0xff).toString(16).padStart(2, '0') }
  }

  /**
   * The cases where Android's installer would only say "App not installed", found early so the app
   * can say why. A device that can't report something is let through: the installer still enforces it.
   */
  @Suppress("DEPRECATION")
  private fun checkInstallable(file: File): String {
    val packageManager = context.packageManager
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      PackageManager.GET_SIGNING_CERTIFICATES
    } else {
      PackageManager.GET_SIGNATURES
    }
    val archive = packageManager.getPackageArchiveInfo(file.absolutePath, flags) ?: return "corrupt"
    if (archive.packageName != context.packageName) return "wrong-package"

    val installed = packageManager.getPackageInfo(context.packageName, flags)
    if (versionCodeOf(archive) < versionCodeOf(installed)) return "downgrade"

    val archiveSigners = signersOf(archive)
    val installedSigners = signersOf(installed)
    if (!archiveSigners.isNullOrEmpty() && !installedSigners.isNullOrEmpty() &&
      archiveSigners.intersect(installedSigners).isEmpty()
    ) {
      return "wrong-signature"
    }
    return "ok"
  }

  @Suppress("DEPRECATION")
  private fun versionCodeOf(info: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

  @Suppress("DEPRECATION")
  private fun signersOf(info: PackageInfo): Set<String>? {
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signing = info.signingInfo ?: return null
      if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
    } else {
      info.signatures
    }
    return signatures?.map { it.toCharsString() }?.toSet()
  }
}
