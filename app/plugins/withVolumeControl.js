const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Kotlin source files that get written into the android project during prebuild
// ---------------------------------------------------------------------------

const VOLUME_CONTROL_SERVICE_KT = `package {{PACKAGE_NAME}}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.content.pm.ServiceInfo
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat

class VolumeControlService : Service() {

    companion object {
        const val CHANNEL_ID = "syncvibe_volume_control"
        const val NOTIFICATION_ID = 9001
        const val ACTION_VOLUME_UP = "{{PACKAGE_NAME}}.VOLUME_UP"
        const val ACTION_VOLUME_DOWN = "{{PACKAGE_NAME}}.VOLUME_DOWN"
        const val ACTION_MUTE_TOGGLE = "{{PACKAGE_NAME}}.MUTE_TOGGLE"
        const val ACTION_STOP_SERVICE = "{{PACKAGE_NAME}}.STOP_VOLUME_SERVICE"
        const val ACTION_STATE_CHANGED = "{{PACKAGE_NAME}}.VOLUME_STATE_CHANGED"
        const val EXTRA_IS_RUNNING = "is_running"
        const val PREFS_NAME = "volume_control"
        const val PREF_USER_STOPPED = "user_stopped"

        @Volatile
        var isRunning = false
            private set
    }

    private lateinit var audioManager: AudioManager
    private lateinit var notificationManager: NotificationManager
    private var volumeReceiver: BroadcastReceiver? = null
    private var actionReceiver: BroadcastReceiver? = null

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
        registerVolumeReceiver()
        registerActionReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        isRunning = true
        notifyStateChanged(true)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isRunning = false
        unregisterReceivers()
        notifyStateChanged(false)
        super.onDestroy()
    }

    private fun notifyStateChanged(running: Boolean) {
        sendBroadcast(
            Intent(ACTION_STATE_CHANGED)
                .setPackage(packageName)
                .putExtra(EXTRA_IS_RUNNING, running)
        )
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Volume Control",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Persistent volume control notification"
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        notificationManager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val mediaVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val percent = if (maxVolume > 0) (mediaVolume * 100) / maxVolume else 0
        val isMuted = audioManager.isStreamMute(AudioManager.STREAM_MUSIC)

        val volumeUpIntent = PendingIntent.getBroadcast(
            this, 1,
            Intent(ACTION_VOLUME_UP).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val volumeDownIntent = PendingIntent.getBroadcast(
            this, 2,
            Intent(ACTION_VOLUME_DOWN).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val muteIntent = PendingIntent.getBroadcast(
            this, 3,
            Intent(ACTION_MUTE_TOGGLE).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getBroadcast(
            this, 4,
            Intent(ACTION_STOP_SERVICE).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val muteLabel = if (isMuted) "Unmute" else "Mute"
        val muteIcon = if (isMuted) android.R.drawable.ic_lock_silent_mode_off
            else android.R.drawable.ic_lock_silent_mode

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
            .setContentTitle("Media Volume: ${'$'}percent%")
            .setContentText("Tap actions to adjust volume")
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(android.R.drawable.ic_media_previous, "Vol\\u2212", volumeDownIntent)
            .addAction(muteIcon, muteLabel, muteIntent)
            .addAction(android.R.drawable.ic_media_next, "Vol+", volumeUpIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .build()
    }

    private fun updateNotification() {
        if (isRunning) {
            notificationManager.notify(NOTIFICATION_ID, buildNotification())
        }
    }

    private fun registerVolumeReceiver() {
        volumeReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == "android.media.VOLUME_CHANGED_ACTION") {
                    updateNotification()
                }
            }
        }
        val filter = IntentFilter("android.media.VOLUME_CHANGED_ACTION")
        ContextCompat.registerReceiver(
            this,
            volumeReceiver,
            filter,
            ContextCompat.RECEIVER_EXPORTED
        )
    }

    private fun registerActionReceiver() {
        actionReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    ACTION_VOLUME_UP -> {
                        audioManager.adjustStreamVolume(
                            AudioManager.STREAM_MUSIC,
                            AudioManager.ADJUST_RAISE,
                            0
                        )
                        updateNotification()
                    }
                    ACTION_VOLUME_DOWN -> {
                        audioManager.adjustStreamVolume(
                            AudioManager.STREAM_MUSIC,
                            AudioManager.ADJUST_LOWER,
                            0
                        )
                        updateNotification()
                    }
                    ACTION_MUTE_TOGGLE -> {
                        audioManager.adjustStreamVolume(
                            AudioManager.STREAM_MUSIC,
                            AudioManager.ADJUST_TOGGLE_MUTE,
                            0
                        )
                        updateNotification()
                    }
                    ACTION_STOP_SERVICE -> {
                        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            .edit()
                            .putBoolean(PREF_USER_STOPPED, true)
                            .apply()
                        stopForeground(STOP_FOREGROUND_REMOVE)
                        stopSelf()
                    }
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(ACTION_VOLUME_UP)
            addAction(ACTION_VOLUME_DOWN)
            addAction(ACTION_MUTE_TOGGLE)
            addAction(ACTION_STOP_SERVICE)
        }
        ContextCompat.registerReceiver(
            this,
            actionReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    private fun unregisterReceivers() {
        volumeReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        actionReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        volumeReceiver = null
        actionReceiver = null
    }
}
`;

const VOLUME_CONTROL_MODULE_KT = `package {{PACKAGE_NAME}}

import android.content.Intent
import android.os.Build
import android.content.Context
import android.content.BroadcastReceiver
import android.content.IntentFilter
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import androidx.core.content.ContextCompat

class VolumeControlModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == VolumeControlService.ACTION_STATE_CHANGED) {
                try {
                    reactApplicationContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit(
                            "VolumeControlStateChanged",
                            intent.getBooleanExtra(VolumeControlService.EXTRA_IS_RUNNING, false)
                        )
                } catch (_: Exception) {
                    // React may not be active while the service changes state.
                }
            }
        }
    }

    override fun initialize() {
        super.initialize()
        val filter = IntentFilter(VolumeControlService.ACTION_STATE_CHANGED)
        ContextCompat.registerReceiver(
            reactApplicationContext,
            stateReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun invalidate() {
        try {
            reactApplicationContext.unregisterReceiver(stateReceiver)
        } catch (_: Exception) {
        }
        super.invalidate()
    }

    override fun getName(): String = "VolumeControlModule"

    @ReactMethod
    fun startVolumeControl(promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences(VolumeControlService.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(VolumeControlService.PREF_USER_STOPPED, false)
                .apply()
            val intent = Intent(reactApplicationContext, VolumeControlService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VOLUME_CONTROL_ERROR", "Failed to start volume control service", e)
        }
    }

    @ReactMethod
    fun stopVolumeControl(promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences(VolumeControlService.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(VolumeControlService.PREF_USER_STOPPED, false)
                .apply()
            val intent = Intent(reactApplicationContext, VolumeControlService::class.java)
            reactApplicationContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VOLUME_CONTROL_ERROR", "Failed to stop volume control service", e)
        }
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(VolumeControlService.isRunning)
    }

    @ReactMethod
    fun consumeUserStop(promise: Promise) {
        val preferences = reactApplicationContext.getSharedPreferences(
            VolumeControlService.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        val stoppedByUser = preferences.getBoolean(VolumeControlService.PREF_USER_STOPPED, false)
        if (stoppedByUser) {
            preferences.edit().putBoolean(VolumeControlService.PREF_USER_STOPPED, false).apply()
        }
        promise.resolve(stoppedByUser)
    }
}
`;

const VOLUME_CONTROL_PACKAGE_KT = `package {{PACKAGE_NAME}}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class VolumeControlPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(VolumeControlModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

// ---------------------------------------------------------------------------
// Plugin: write Kotlin source files into the generated android project
// ---------------------------------------------------------------------------
function withVolumeControlKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const androidPackage = modConfig.android?.package;
      if (!androidPackage) {
        throw new Error('withVolumeControl: android.package is not set in app config');
      }

      const packageDir = androidPackage.replace(/\./g, '/');
      const srcDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packageDir
      );

      fs.mkdirSync(srcDir, { recursive: true });

      const files = {
        'VolumeControlService.kt': VOLUME_CONTROL_SERVICE_KT,
        'VolumeControlModule.kt': VOLUME_CONTROL_MODULE_KT,
        'VolumeControlPackage.kt': VOLUME_CONTROL_PACKAGE_KT,
      };

      for (const [filename, template] of Object.entries(files)) {
        const content = template.replace(/\{\{PACKAGE_NAME\}\}/g, androidPackage);
        fs.writeFileSync(path.join(srcDir, filename), content, 'utf-8');
      }

      return modConfig;
    },
  ]);
}

// ---------------------------------------------------------------------------
// Plugin: add permissions and service declaration to AndroidManifest.xml
// ---------------------------------------------------------------------------
function withVolumeControlManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    // Add permissions if not already present
    const existingPerms = (manifest['uses-permission'] || []).map((p) => p.$?.['android:name']);

    const requiredPerms = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    ];

    for (const perm of requiredPerms) {
      if (!existingPerms.includes(perm)) {
        manifest['uses-permission'] = manifest['uses-permission'] || [];
        manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // Add service declaration
    const application = manifest.application?.[0];
    if (application) {
      application.service = application.service || [];

      const serviceExists = application.service.some(
        (s) => s.$?.['android:name'] === '.VolumeControlService'
      );

      if (!serviceExists) {
        application.service.push({
          $: {
            'android:name': '.VolumeControlService',
            'android:exported': 'false',
            'android:foregroundServiceType': 'specialUse',
          },
          property: [
            {
              $: {
                'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
                'android:value': 'persistent_user_invoked_media_volume_controls',
              },
            },
          ],
        });
      }
    }

    return modConfig;
  });
}

// ---------------------------------------------------------------------------
// Plugin: register VolumeControlPackage in MainApplication
// ---------------------------------------------------------------------------
function withVolumeControlMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // Add the import if missing
    if (!contents.includes('import com.thakurdotdev.syncvibe')) {
      // The import is within the same package, so no import needed for
      // same-package classes in Kotlin. But we need to add the package
      // registration line.
    }

    // Add VolumeControlPackage() to the packages list
    if (!contents.includes('VolumeControlPackage()')) {
      contents = contents.replace(/PackageList\(this\)\.packages\.apply\s*\{[^}]*\}/, (match) => {
        // Replace the comment placeholder or just add before the closing brace
        if (match.includes('// add(MyReactNativePackage())')) {
          return match.replace('// add(MyReactNativePackage())', 'add(VolumeControlPackage())');
        }
        // If no placeholder comment, add before closing brace
        return match.replace(/\}$/, '          add(VolumeControlPackage())\n        }');
      });
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

// ---------------------------------------------------------------------------
// Main plugin export — composes all three sub-plugins
// ---------------------------------------------------------------------------
function withVolumeControl(config) {
  config = withVolumeControlKotlinFiles(config);
  config = withVolumeControlManifest(config);
  config = withVolumeControlMainApplication(config);
  return config;
}

module.exports = withVolumeControl;
