import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera as ExpoCamera, FlashMode, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const QRScannerScreen = ({
  onScanComplete,
  onClose,
}: {
  onScanComplete: (data: string) => void;
  onClose: () => void;
}) => {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState<null | boolean>(null);
  const [scanned, setScanned] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();

  const scanLinePosition = useSharedValue(0);
  const scanLineOpacity = useSharedValue(1);
  const resultPanelHeight = useSharedValue(0);

  const resultPanelStyle = useAnimatedStyle(() => ({
    height: withSpring(resultPanelHeight.value * 200),
    opacity: withTiming(resultPanelHeight.value),
  }));

  useEffect(() => {
    (async () => {
      const { status } = await requestPermission();
      setHasPermission(status === 'granted');
    })();

    return () => {
      setIsCameraActive(false);
    };
  }, []);

  useEffect(() => {
    if (isCameraActive && !scanned) {
      startScanAnimation();
    }
  }, [isCameraActive, scanned]);

  const startScanAnimation = () => {
    scanLinePosition.value = withSequence(
      withTiming(1, { duration: 2000 }),
      withTiming(0, { duration: 0 })
    );
    scanLineOpacity.value = withSequence(
      withTiming(1, { duration: 1000 }),
      withTiming(0.5, { duration: 1000 })
    );
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionText, { color: colors.foreground }]}>
            We need your permission to access the camera
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={[styles.buttonText, { color: colors.foreground }]}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: colors.secondary }]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanned && isCameraActive) {
      setScanned(true);
      setScannedData(data);
      setIsCameraActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate(100);
      resultPanelHeight.value = withSpring(1);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setScannedData(null);
    setIsCameraActive(true);
    resultPanelHeight.value = withSpring(0);
    startScanAnimation();
  };

  const toggleFlash = () => {
    setFlashMode(flashMode === 'off' ? 'on' : 'off');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClose = () => {
    setIsCameraActive(false);
    onClose();
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.statusText, { color: colors.foreground }]}>
            Requesting camera permission...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <Text style={[styles.statusText, { color: colors.foreground }]}>
            Camera access denied
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={[styles.buttonText, { color: colors.foreground }]}>
              Request Permission
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: colors.secondary }]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (scanned && scannedData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.resultScreen, resultPanelStyle]}>
          <View style={[styles.resultHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>QR Code Scanned</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name='close' size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.resultContent}>
            <Ionicons
              name='checkmark-circle'
              size={60}
              color={colors.primary}
              style={styles.successIcon}
            />
            <Text style={[styles.resultMessage, { color: colors.foreground }]}>
              QR code detected successfully!
            </Text>

            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                onScanComplete(scannedData);
                handleClose();
              }}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Join Group</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.secondary }]}
              onPress={resetScanner}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>QR Scanner</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name='close' size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          enableTorch={flashMode === 'on'}
          facing={'back'}
          flash={flashMode}
        >
          <View style={[styles.overlay, { backgroundColor: `rgba(0,0,0,0.5)` }]}>
            <View style={styles.unfilled} />
            <View style={styles.rowContainer}>
              <View style={styles.unfilled} />
              <View style={styles.scanner}>
                <View style={[styles.cornerTL, styles.corner, { borderColor: colors.primary }]} />
                <View style={[styles.cornerTR, styles.corner, { borderColor: colors.primary }]} />
                <View style={[styles.cornerBL, styles.corner, { borderColor: colors.primary }]} />
                <View style={[styles.cornerBR, styles.corner, { borderColor: colors.primary }]} />
              </View>
              <View style={styles.unfilled} />
            </View>
            <View style={styles.unfilled} />
          </View>
        </CameraView>
      </View>

      <BlurView intensity={20} style={[styles.controlsContainer, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
          <Ionicons
            name={flashMode === 'on' ? 'flash' : 'flash-outline'}
            size={28}
            color={colors.foreground}
          />
          <Text style={[styles.iconText, { color: colors.mutedForeground }]}>
            {flashMode === 'on' ? 'Flash On' : 'Flash Off'}
          </Text>
        </TouchableOpacity>
      </BlurView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 30,
    paddingBottom: 20,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
  },
  scannerContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  rowContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  unfilled: {
    flex: 1,
  },
  scanner: {
    aspectRatio: 1,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderWidth: 4,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    overflow: 'hidden',
  },
  iconButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    width: 100,
  },
  iconText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  cancelButton: {
    marginTop: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  resultScreen: {
    flex: 1,
    padding: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 16,
    borderBottomWidth: 1,
    marginBottom: 30,
  },
  resultContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultMessage: {
    fontSize: 18,
    marginBottom: 40,
    marginTop: 16,
    textAlign: 'center',
  },
  successIcon: {
    marginBottom: 16,
  },
  joinButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default QRScannerScreen;
