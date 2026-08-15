import React from "react"
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native"
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons"
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
    openManualDownloadUrl,
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
                  { backgroundColor: `${colors.primary}18` },
                ]}
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {isCritical ? "Mandatory App Update" : "Update Available"}
                </Text>
                <Text style={[styles.versionSubtitle, { color: colors.mutedForeground }]}>
                  v{currentVersion} → <Text style={{ color: colors.primary, fontWeight: "600" }}>v{updateInfo.version}</Text>
                </Text>
              </View>
            </View>

            {isCritical ? (
              <View style={[styles.criticalBadge, { backgroundColor: `${colors.destructive}20` }]}>
                <Text style={[styles.criticalText, { color: colors.destructive }]}>CRITICAL</Text>
              </View>
            ) : !isDownloading && !isVerifying ? (
              <TouchableOpacity
                onPress={hideUpdateModal}
                style={[styles.closeIconBtn, { backgroundColor: colors.secondary }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Release Notes */}
          {updateInfo.releaseNotes && !isDownloading && !isVerifying && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesHeader, { color: colors.foreground }]}>
                What's New:
              </Text>
              <View
                style={[
                  styles.notesCard,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
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
            <View style={[styles.statusBox, { backgroundColor: colors.secondary }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.statusBoxText, { color: colors.foreground }]}>
                Verifying update package…
              </Text>
            </View>
          )}

          {(isReady || isInstalling) && (
            <View style={[styles.statusBox, { backgroundColor: colors.secondary }]}>
              <Feather name="check-circle" size={22} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBoxTitle, { color: colors.foreground }]}>
                  Update Ready to Install
                </Text>
                <Text style={[styles.statusBoxText, { color: colors.mutedForeground }]}>
                  {isInstalling
                    ? "Launching Android Package Installer…"
                    : "Tap Install to apply the latest version."}
                </Text>
              </View>
            </View>
          )}

          {isError && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: `${colors.destructive}10`, borderColor: `${colors.destructive}30` },
              ]}
            >
              <Feather name="alert-circle" size={20} color={colors.destructive} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.errorBoxTitle, { color: colors.destructive }]}>
                  Installation Notice
                </Text>
                <Text style={[styles.errorBoxText, { color: colors.mutedForeground }]}>
                  {error || "Could not complete direct installation."}
                </Text>
                <Text style={[styles.errorHintText, { color: colors.mutedForeground }]}>
                  Tip: If your device disables in-app installs, you can download the APK directly with your browser.
                </Text>
              </View>
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
                <TouchableOpacity
                  onPress={openManualDownloadUrl}
                  style={[
                    styles.manualDownloadButton,
                    { borderColor: colors.border, backgroundColor: colors.secondary },
                  ]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="open-in-new" size={16} color={colors.primary} />
                  <Text style={[styles.manualDownloadText, { color: colors.foreground }]}>
                    Download via Browser (Direct Link)
                  </Text>
                </TouchableOpacity>
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
              <>
                <Button
                  title="Cancel Download"
                  onPress={cancelDownload}
                  variant="outline"
                  size="default"
                  style={styles.fullWidthButton}
                />
                <TouchableOpacity
                  onPress={openManualDownloadUrl}
                  style={[
                    styles.manualDownloadButton,
                    { borderColor: colors.border, backgroundColor: colors.secondary },
                  ]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="open-in-new" size={16} color={colors.primary} />
                  <Text style={[styles.manualDownloadText, { color: colors.foreground }]}>
                    Download in Browser Instead
                  </Text>
                </TouchableOpacity>
              </>
            ) : isReady || isInstalling ? (
              <>
                <Button
                  title="Install Update Now"
                  onPress={installDownloadedApk}
                  isLoading={isInstalling}
                  variant="default"
                  size="lg"
                  style={styles.fullWidthButton}
                />
                <TouchableOpacity
                  onPress={openManualDownloadUrl}
                  style={[
                    styles.manualDownloadButton,
                    { borderColor: colors.border, backgroundColor: colors.secondary },
                  ]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="open-in-new" size={16} color={colors.primary} />
                  <Text style={[styles.manualDownloadText, { color: colors.foreground }]}>
                    Download APK in Browser
                  </Text>
                </TouchableOpacity>
              </>
            ) : isError ? (
              <View style={{ width: "100%", gap: 8 }}>
                <Button
                  title="Download in Browser (Manual APK)"
                  onPress={openManualDownloadUrl}
                  variant="default"
                  size="default"
                  style={styles.fullWidthButton}
                />
                <Button
                  title="Retry In-App Download"
                  onPress={downloadAndInstall}
                  variant="outline"
                  size="sm"
                  style={styles.fullWidthButton}
                />
                <Button
                  title="Grant Installer Permission"
                  onPress={openInstallPermissionSettings}
                  variant="ghost"
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dialogContainer: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
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
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
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
    marginBottom: 16,
  },
  notesHeader: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  notesCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    maxHeight: 150,
  },
  notesScrollView: {
    maxHeight: 126,
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
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
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
    borderRadius: 14,
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
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 12,
  },
  errorBoxTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorBoxText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  errorHintText: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 4,
    opacity: 0.85,
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
  },
  manualDownloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  manualDownloadText: {
    fontSize: 13,
    fontWeight: "600",
  },
})

export default AppUpdateModal

