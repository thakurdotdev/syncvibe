package expo.modules.appupdater

import androidx.core.content.FileProvider

/** Its own subclass so its manifest entry can't collide with another library's FileProvider. */
class AppUpdateFileProvider : FileProvider()
