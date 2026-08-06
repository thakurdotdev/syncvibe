import React from "react"
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native"
import { Ionicons, Feather } from "@expo/vector-icons"
import { useTheme } from "@/context/ThemeContext"
import { useAppUpdate } from "@/context/AppUpdateContext"
import Button from "@/components/ui/button"

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "0 MB"
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export const AppUpdateModal: React.FC = () => {
  const { colors, theme } = useTheme()
  const {
    updateInfo,
    currentVersion,
    isModalVisible,
    hideUpdateModal,
    downloadStatus,
    downloadProgress,
    downloadSpeed,
    bytesDownloaded,
    totalBytes,
    error,
    downloadAndInstall,
    cancelDownload,
    installDownloadedApk,
    openInstallPermissionSettings,
  } = useAppUpdate()

  if (!isModalVisible || !updateInfo) {
    return null
  }

  const isDownloading = downloadStatus === "downloading"
  const isVerifying = downloadStatus === "verifying"
  const isReady = downloadStatus === "ready"
  const isInstalling = downloadStatus === "installing"
  const isError = downloadStatus === "error"
  const isCritical = updateInfo.critical

  const percentText = `${Math.round(downloadProgress * 100)}%`

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isCritical && !isDownloading && !isVerifying) {
          hideUpdateModal()
        }
      }}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: `${colors.primary}1A` },
                ]}
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {isCritical ? "Critical Update Required" : "Update SyncVibe"}
                </Text>
                <Text style={[styles.versionSubtitle, { color: colors.mutedForeground }]}>
                  v{currentVersion} → v{updateInfo.version}
                </Text>
              </View>
            </View>

            {isCritical && (
              <View style={[styles.criticalBadge, { backgroundColor: `${colors.destructive}20` }]}>
                <Text style={[styles.criticalText, { color: colors.destructive }]}>REQUIRED</Text>
              </View>
            )}
          </View>

          {/* Release Notes */}
          {updateInfo.releaseNotes && !isDownloading && !isVerifying && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesHeader, { color: colors.foreground }]}>
                What's New in v{updateInfo.version}:
              </Text>
              <ScrollView
                style={styles.notesScrollView}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {updateInfo.releaseNotes
                  .split("\n")
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0)
                  .map((line, idx) => (
                    <View key={idx} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>
                        {line.replace(/^[-\*•\s]+/, "")}
                      </Text>
                    </View>
                  ))}
              </ScrollView>
            </View>
          )}

          {/* Progress / Status Area */}
          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressStatusText, { color: colors.foreground }]}>
                  Downloading update…
                </Text>
                <Text style={[styles.progressPercentText, { color: colors.primary }]}>
                  {percentText}
                </Text>
              </View>

              <View
                style={[
                  styles.progressBarTrack,
                  { backgroundColor: theme === "dark" ? "#ffffff15" : "#00000010" },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.max(5, Math.min(100, downloadProgress * 100))}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressDetailsRow}>
                <Text style={[styles.progressMetaText, { color: colors.mutedForeground }]}>
                  {formatBytes(bytesDownloaded)} / {formatBytes(totalBytes)}
                </Text>
                <Text style={[styles.progressMetaText, { color: colors.primary }]}>
                  {downloadSpeed}
                </Text>
              </View>
            </View>
          )}

          {isVerifying && (
            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.statusBoxText, { color: colors.foreground }]}>
                Verifying package integrity (SHA-256)...
              </Text>
            </View>
          )}

          {(isReady || isInstalling) && (
            <View style={styles.statusBox}>
              <Feather name="check-circle" size={24} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBoxTitle, { color: colors.foreground }]}>
                  Package Downloaded Successfully
                </Text>
                <Text style={[styles.statusBoxText, { color: colors.mutedForeground }]}>
                  {isInstalling
                    ? "Opening Package Installer..."
                    : "Tap below to launch Android installation prompt."}
                </Text>
              </View>
            </View>
          )}

          {isError && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: `${colors.destructive}12`, borderColor: `${colors.destructive}30` },
              ]}
            >
              <Feather name="alert-triangle" size={20} color={colors.destructive} />
              <Text style={[styles.errorBoxText, { color: colors.destructive }]}>
                {error || "An error occurred during update download."}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {downloadStatus === "idle" || downloadStatus === "cancelled" ? (
              <>
                <Button
                  title="Download & Install Update"
                  onPress={downloadAndInstall}
                  variant="default"
                  size="lg"
                  style={styles.fullWidthButton}
                />
                {!isCritical && (
                  <Button
                    title="Later"
                    onPress={hideUpdateModal}
                    variant="ghost"
                    size="sm"
                    style={styles.secondaryButton}
                  />
                )}
              </>
            ) : isDownloading ? (
              <Button
                title="Cancel Download"
                onPress={cancelDownload}
                variant="outline"
                size="default"
                style={styles.fullWidthButton}
              />
            ) : isReady || isInstalling ? (
              <Button
                title="Install Update Now"
                onPress={installDownloadedApk}
                isLoading={isInstalling}
                variant="default"
                size="lg"
                style={styles.fullWidthButton}
              />
            ) : isError ? (
              <View style={{ width: "100%", gap: 8 }}>
                <Button
                  title="Retry Download"
                  onPress={downloadAndInstall}
                  variant="default"
                  size="default"
                  style={styles.fullWidthButton}
                />
                <Button
                  title="Grant Installer Permission"
                  onPress={openInstallPermissionSettings}
                  variant="outline"
                  size="sm"
                  style={styles.fullWidthButton}
                />
                {!isCritical && (
                  <Button
                    title="Close"
                    onPress={hideUpdateModal}
                    variant="ghost"
                    size="sm"
                    style={styles.secondaryButton}
                  />
                )}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dialogContainer: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  versionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  criticalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  criticalText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  notesSection: {
    marginBottom: 18,
    maxHeight: 180,
  },
  notesHeader: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  notesScrollView: {
    maxHeight: 140,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  progressContainer: {
    marginVertical: 14,
    gap: 8,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  progressDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginVertical: 12,
  },
  statusBoxTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusBoxText: {
    fontSize: 13,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 12,
  },
  errorBoxText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  actionsContainer: {
    marginTop: 14,
    alignItems: "center",
    gap: 10,
  },
  fullWidthButton: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
    marginTop: 2,
  },
})

export default AppUpdateModal
