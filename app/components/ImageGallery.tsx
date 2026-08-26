import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, XIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import * as Notifications from 'expo-notifications';

const { width, height } = Dimensions.get('window');

const ImageGallery = ({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) => {
  if (!images || images.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState(false);

  // Hide status bar when gallery opens
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => StatusBar.setHidden(false);
  }, []);

  // Initialize notifications
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    })();
  }, []);

  // Request media library permissions
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermissions(status === 'granted');
    })();
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsLoading(true);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsLoading(true);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, images.length]);

  const handleDownload = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (!hasPermissions) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'This app needs permission to save images to your gallery.',
            [{ text: 'OK' }]
          );
          return;
        }
        setHasPermissions(true);
      }

      const fileUri = FileSystem.documentDirectory + `image-${Date.now()}.jpg`;

      const downloadResumable = FileSystem.createDownloadResumable(
        images[currentIndex],
        fileUri,
        {}
      );

      const uri = await downloadResumable.downloadAsync();

      if (!uri) {
        throw new Error('Download failed');
      }

      await MediaLibrary.createAssetAsync(uri.uri);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Download Complete', 'Image has been saved to your gallery.', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Download failed:', error);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Alert.alert('Download Failed', 'An error occurred while downloading the image.', [
        { text: 'OK' },
      ]);
    }
  }, [currentIndex, images, hasPermissions]);

  const handleClose = useCallback(() => {
    StatusBar.setHidden(false);
    onClose();
  }, [onClose]);

  return (
    <View style={styles.container}>
      {/* Background blur */}
      <BlurView intensity={90} style={StyleSheet.absoluteFill} tint='dark' />

      <SafeAreaView style={styles.safeAreaContainer}>
        {/* Top gradient */}
        <View style={styles.topGradient} />

        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
          <XIcon color='white' size={24} />
        </TouchableOpacity>

        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.leftButton,
                currentIndex === 0 && styles.disabledButton,
              ]}
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              activeOpacity={0.7}
            >
              <ChevronLeftIcon color='white' size={28} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navButton,
                styles.rightButton,
                currentIndex === images.length - 1 && styles.disabledButton,
              ]}
              onPress={handleNext}
              disabled={currentIndex === images.length - 1}
              activeOpacity={0.7}
            >
              <ChevronRightIcon color='white' size={28} />
            </TouchableOpacity>
          </>
        )}

        {/* Main image */}
        <View style={styles.imageContainer}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size='large' color='white' />
            </View>
          )}
          <Image
            source={{ uri: images[currentIndex] }}
            style={styles.image}
            resizeMode='contain'
            onLoad={handleImageLoad}
          />
        </View>

        {/* Bottom gradient */}
        <View style={styles.bottomGradient} />

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {/* Image counter */}
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>

          {/* Download button */}
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownload}
            activeOpacity={0.7}
          >
            <DownloadIcon color='white' size={22} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  safeAreaContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: width,
    height: height * 0.85,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    zIndex: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  leftButton: {
    left: 20,
  },
  rightButton: {
    right: 20,
  },
  disabledButton: {
    opacity: 0.4,
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 5,
  },
  counter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  counterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadButton: {
    position: 'absolute',
    right: 20,
    bottom: 0,
    zIndex: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 120 : 100,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});

export default ImageGallery;
