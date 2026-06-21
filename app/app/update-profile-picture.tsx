import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, ActivityIndicator, Alert, Animated } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, Image as ImageIcon, Check } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import useApi from '@/utils/hooks/useApi';
import { Button } from '@/components/ui/button';
import { getOptimizedImageUrl, uploadToCloudinary } from '@/utils/Cloudinary';

export default function UpdateProfilePictureScreen() {
  const { user, setUser } = useUser();
  const { colors } = useTheme();
  const { toast } = useToast();
  const api = useApi();

  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const imageScale = React.useRef(new Animated.Value(0.9)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selectedUri]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow gallery access to select a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedUri(asset.uri);
        setFileDetails({
          name: asset.fileName || 'profile.jpg',
          type: asset.mimeType || 'image/jpeg',
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error(error);
      toast('Failed to open gallery', { type: 'error' });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow camera access to take a profile picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedUri(asset.uri);
        setFileDetails({
          name: asset.fileName || 'camera.jpg',
          type: asset.mimeType || 'image/jpeg',
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error(error);
      toast('Failed to open camera', { type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!selectedUri || !fileDetails) return;

    setIsUploading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      const secureUrl = await uploadToCloudinary(
        api,
        selectedUri,
        fileDetails.name,
        fileDetails.type,
        'profile'
      );

      const response = await api.post('/api/update-profilepic', {
        profilepic: secureUrl,
      });

      if (response.status === 200) {
        setUser((prev) => (prev ? { ...prev, profilepic: response.data.profilepic } : null));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast('Profile picture updated!', { type: 'success' });
        router.back();
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Failed to update profile picture';
      toast(message, { type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const imageSourceUri = selectedUri || getOptimizedImageUrl(user?.profilepic);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale: imageScale }] }]}>
        <View style={styles.imageContainer}>
          {imageSourceUri ? (
            <Image
              source={{ uri: imageSourceUri }}
              style={[styles.avatar, { borderColor: colors.border }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.avatarFallbackText, { color: colors.mutedForeground }]}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}

          {isUploading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Update Profile Picture</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Choose a modern photo that represents you.
        </Text>

        <View style={styles.pickerButtons}>
          <Button
            variant="outline"
            style={styles.pickerButton}
            onPress={handlePickImage}
            disabled={isUploading}
            icon={<ImageIcon size={18} color={colors.primary} />}
          >
            Gallery
          </Button>

          <Button
            variant="outline"
            style={styles.pickerButton}
            onPress={handleTakePhoto}
            disabled={isUploading}
            icon={<Camera size={18} color={colors.primary} />}
          >
            Camera
          </Button>
        </View>

        <View style={styles.actionContainer}>
          <Button
            variant="default"
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={!selectedUri || isUploading}
            isLoading={isUploading}
            icon={<Check size={18} color={colors.primaryForeground} />}
          >
            Save Changes
          </Button>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  avatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
  },
  avatarFallback: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 72,
    fontWeight: '700',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    marginBottom: 32,
  },
  pickerButton: {
    flex: 1,
    borderRadius: 14,
    height: 48,
  },
  actionContainer: {
    width: '100%',
  },
  saveButton: {
    width: '100%',
    borderRadius: 14,
    height: 52,
  },
});
