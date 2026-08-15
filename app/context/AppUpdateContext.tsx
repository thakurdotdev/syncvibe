import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import { Linking, Platform } from "react-native"
import useApi from "@/utils/hooks/useApi"
import Constants from "expo-constants"
import { toast } from "@/context/ToastContext"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system/legacy"
import * as IntentLauncher from "expo-intent-launcher"

export interface AppUpdate {
  id: number
  version: string
  releaseNotes: string | null
  downloadUrl: string | null
  critical: boolean
  createdAt: string
  sha256?: string | null
  fileSize?: number | null
}

export type DownloadStatus =
  | "idle"
  | "downloading"
  | "verifying"
  | "ready"
  | "installing"
  | "error"
  | "cancelled"

interface AppUpdateContextType {
  updateInfo: AppUpdate | null
  isUpdateAvailable: boolean
  currentVersion: string
  checkUpdates: () => Promise<void>
  loading: boolean
  downloadStatus: DownloadStatus
  downloadProgress: number
  downloadSpeed: string
  bytesDownloaded: number
  totalBytes: number
  error: string | null
  isModalVisible: boolean
  showUpdateModal: () => void
  hideUpdateModal: () => void
  downloadAndInstall: () => Promise<void>
  cancelDownload: () => Promise<void>
  installDownloadedApk: () => Promise<void>
  openInstallPermissionSettings: () => Promise<void>
  openManualDownloadUrl: () => Promise<void>
}

const AppUpdateContext = createContext<AppUpdateContextType | null>(null)

export const useAppUpdate = () => {
  const context = useContext(AppUpdateContext)
  if (!context) {
    throw new Error("useAppUpdate must be used within an AppUpdateProvider")
  }
  return context
}

const isNewerVersion = (current: string, latest: string): boolean => {
  const currentParts = current.split(".").map(Number)
  const latestParts = latest.split(".").map(Number)
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0
    const lat = latestParts[i] || 0
    if (lat > curr) return true
    if (curr > lat) return false
  }
  return false
}

const formatSpeed = (bytesPerSec: number): string => {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s"
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

const getApkDirectory = (): string => {
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || ""
  return `${baseDir}updates/`
}

const getApkPath = (version: string): string => {
  return `${getApkDirectory()}SyncVibe-v${version}.apk`
}

export const AppUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useApi()
  const [updateInfo, setUpdateInfo] = useState<AppUpdate | null>(null)
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle")
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [downloadSpeed, setDownloadSpeed] = useState<string>("0 KB/s")
  const [bytesDownloaded, setBytesDownloaded] = useState<number>(0)
  const [totalBytes, setTotalBytes] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false)

  const downloadTaskRef = useRef<FileSystem.DownloadResumable | null>(null)
  const lastTimeRef = useRef<number>(Date.now())
  const lastBytesRef = useRef<number>(0)

  const currentVersion = Constants.expoConfig?.version || "1.0.0"

  const showUpdateModal = () => setIsModalVisible(true)
  const hideUpdateModal = () => {
    if (updateInfo?.critical && isUpdateAvailable) {
      return
    }
    setIsModalVisible(false)
  }

  const checkUpdates = async () => {
    setLoading(true)
    try {
      const response = await api.get("/api/app-update/latest")
      if (response.status === 200 && response.data.success && response.data.latest) {
        const latest: AppUpdate = response.data.latest
        setUpdateInfo(latest)
        const hasUpdate = isNewerVersion(currentVersion, latest.version)
        setIsUpdateAvailable(hasUpdate)

        if (hasUpdate) {
          if (latest.critical) {
            setIsModalVisible(true)
          }

          const localPath = getApkPath(latest.version)
          const fileInfo = await FileSystem.getInfoAsync(localPath).catch(() => ({ exists: false, size: 0 }))
          if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
            setDownloadStatus("ready")
            setDownloadProgress(1)
            setBytesDownloaded(fileInfo.size)
            setTotalBytes(latest.fileSize || fileInfo.size)
          }

          const lastNotifiedVersion = await AsyncStorage.getItem("last-notified-update-version")
          if (lastNotifiedVersion !== latest.version) {
            await AsyncStorage.setItem("last-notified-update-version", latest.version)
            toast(`SyncVibe v${latest.version} is available!`, {
              type: "info",
              duration: 6000,
            })
          }
        }
      }
    } catch (err) {
      console.error("Failed to check for updates:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      checkUpdates()
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const installDownloadedApk = async () => {
    if (!updateInfo) return
    if (Platform.OS !== "android") {
      toast("In-app APK installation is supported on Android devices only.", { type: "info" })
      return
    }

    const localPath = getApkPath(updateInfo.version)
    try {
      setDownloadStatus("installing")
      setError(null)

      const fileInfo = await FileSystem.getInfoAsync(localPath)
      if (!fileInfo.exists) {
        throw new Error("Downloaded package file does not exist on disk.")
      }

      const contentUri = await FileSystem.getContentUriAsync(localPath)
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: "application/vnd.android.package-archive",
        flags: 1,
      })
    } catch (err: any) {
      console.error("Failed to launch package installer:", err)
      setDownloadStatus("error")
      setError(
        "Could not launch package installer. Please enable 'Install unknown apps' for SyncVibe in Android settings."
      )
    }
  }

  const openInstallPermissionSettings = async () => {
    if (Platform.OS !== "android") return
    try {
      const packageName = Constants.expoConfig?.android?.package || "com.syncvibe.app"
      await IntentLauncher.startActivityAsync("android.settings.MANAGE_UNKNOWN_APP_SOURCES", {
        data: `package:${packageName}`,
      })
    } catch (err) {
      try {
        await IntentLauncher.startActivityAsync("android.settings.SECURITY_SETTINGS")
      } catch (e) {
        toast("Open System Settings > Apps > Special app access > Install unknown apps", {
          type: "info",
        })
      }
    }
  }

  const openManualDownloadUrl = async () => {
    if (!updateInfo?.downloadUrl) {
      toast("No download URL available.", { type: "error" })
      return
    }
    try {
      await Linking.openURL(updateInfo.downloadUrl)
    } catch (err) {
      console.error("Failed to open manual download URL:", err)
      toast("Failed to open browser download link.", { type: "error" })
    }
  }

  const cancelDownload = async () => {
    try {
      if (downloadTaskRef.current) {
        await downloadTaskRef.current.cancelAsync()
        downloadTaskRef.current = null
      }
      if (updateInfo) {
        const localPath = getApkPath(updateInfo.version)
        await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {})
      }
    } catch (err) {
      console.error("Failed to cancel download:", err)
    } finally {
      setDownloadStatus("cancelled")
      setDownloadProgress(0)
      setBytesDownloaded(0)
      setDownloadSpeed("0 KB/s")
      setError(null)
    }
  }

  const downloadAndInstall = async () => {
    if (Platform.OS !== "android") {
      toast("Direct APK download is only supported on Android.", { type: "info" })
      return
    }

    if (!updateInfo || !updateInfo.downloadUrl) {
      setError("No valid download URL available for this update.")
      setDownloadStatus("error")
      return
    }

    const updatesDir = getApkDirectory()
    const localPath = getApkPath(updateInfo.version)

    try {
      const dirInfo = await FileSystem.getInfoAsync(updatesDir)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(updatesDir, { intermediates: true })
      }

      // Reuse existing complete download if size matches
      const existingFile = await FileSystem.getInfoAsync(localPath)
      if (existingFile.exists && existingFile.size && existingFile.size > 0) {
        if (!updateInfo.fileSize || existingFile.size === updateInfo.fileSize) {
          setDownloadStatus("ready")
          setDownloadProgress(1)
          setBytesDownloaded(existingFile.size)
          setTotalBytes(existingFile.size)
          await installDownloadedApk()
          return
        } else {
          await FileSystem.deleteAsync(localPath, { idempotent: true })
        }
      }

      setDownloadStatus("downloading")
      setDownloadProgress(0)
      setBytesDownloaded(0)
      setError(null)
      lastTimeRef.current = Date.now()
      lastBytesRef.current = 0

      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        localPath,
        {},
        (downloadData) => {
          const { totalBytesWritten, totalBytesExpectedToWrite } = downloadData
          const now = Date.now()
          const timeDiff = (now - lastTimeRef.current) / 1000
          const bytesDiff = totalBytesWritten - lastBytesRef.current

          if (timeDiff >= 0.4) {
            const speed = bytesDiff / timeDiff
            setDownloadSpeed(formatSpeed(speed))
            lastTimeRef.current = now
            lastBytesRef.current = totalBytesWritten
          }

          const progress =
            totalBytesExpectedToWrite > 0
              ? totalBytesWritten / totalBytesExpectedToWrite
              : 0

          setDownloadProgress(progress)
          setBytesDownloaded(totalBytesWritten)
          setTotalBytes(totalBytesExpectedToWrite || updateInfo.fileSize || 0)
        }
      )

      downloadTaskRef.current = downloadResumable
      const downloadResult = await downloadResumable.downloadAsync()

      if (!downloadResult || !downloadResult.uri) {
        if (downloadStatus !== "cancelled") {
          throw new Error("Download stopped unexpectedly.")
        }
        return
      }

      const verifiedFile = await FileSystem.getInfoAsync(downloadResult.uri)
      if (!verifiedFile.exists || !verifiedFile.size || verifiedFile.size === 0) {
        throw new Error("Downloaded package file is corrupted or incomplete.")
      }

      if (updateInfo.fileSize && verifiedFile.size !== updateInfo.fileSize) {
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true })
        throw new Error("Downloaded file size does not match package specification.")
      }

      setDownloadStatus("ready")
      setDownloadProgress(1)
      await installDownloadedApk()
    } catch (err: any) {
      if (downloadStatus === "cancelled") return
      console.error("Update download error:", err)
      setDownloadStatus("error")
      setError(err?.message || "Failed to download update package. Please try again.")
    } finally {
      downloadTaskRef.current = null
    }
  }

  return (
    <AppUpdateContext.Provider
      value={{
        updateInfo,
        isUpdateAvailable,
        currentVersion,
        checkUpdates,
        loading,
        downloadStatus,
        downloadProgress,
        downloadSpeed,
        bytesDownloaded,
        totalBytes,
        error,
        isModalVisible,
        showUpdateModal,
        hideUpdateModal,
        downloadAndInstall,
        cancelDownload,
        installDownloadedApk,
        openInstallPermissionSettings,
        openManualDownloadUrl,
      }}
    >
      {children}
    </AppUpdateContext.Provider>
  )
}

