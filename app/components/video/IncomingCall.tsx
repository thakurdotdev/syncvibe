import { useVideoCall } from '@/context/VideoCallContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { memo, useEffect } from 'react';
import { Image, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const IncomingCallModal = () => {
  const { incomingCall, answerCall, rejectCall } = useVideoCall();
  const insets = useSafeAreaInsets();

  // Animation values
  const scale = useSharedValue(1);
  const slideY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!incomingCall) return;

    // Start pulsing animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite repetition
      true
    );

    // Slide up and fade in animation
    slideY.value = withSpring(0, {
      damping: 15,
      stiffness: 90,
    });

    opacity.value = withTiming(1, { duration: 400 });

    // Cleanup function
    return () => {
      // Reset animation values when component unmounts
      scale.value = 1;
      slideY.value = 100;
      opacity.value = 0;
    };
  }, [incomingCall]);

  const handleAnswer = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Fade out animation before answering
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(answerCall)();
      }
    });
  };

  const handleReject = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // Fade out animation before rejecting
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(rejectCall)();
      }
    });
  };

  // Avatar animation style
  const avatarAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Container animation style
  const containerAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: slideY.value }],
      opacity: opacity.value,
    };
  });

  if (!incomingCall) return null;

  return (
    <Animated.View style={[styles.container, containerAnimStyle]}>
      <StatusBar barStyle='light-content' backgroundColor='rgba(0,0,0,0.7)' />
      <BlurView intensity={80} style={styles.blurContainer} tint='dark'>
        <View
          style={[
            styles.contentContainer,
            { paddingTop: insets.top, paddingBottom: insets.bottom + 20 },
          ]}
        >
          {/* Caller Information */}
          <View style={styles.callerInfoContainer}>
            <Animated.View style={[styles.avatarContainer, avatarAnimStyle]}>
              {incomingCall.profilepic ? (
                <Image
                  source={{ uri: incomingCall.profilepic }}
                  style={styles.avatar}
                  resizeMode='cover'
                />
              ) : (
                <View style={styles.fallbackAvatar}>
                  <Text style={styles.fallbackText}>
                    {incomingCall.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </Animated.View>

            <Text style={styles.callerName}>{incomingCall.name}</Text>
            <View style={styles.callStatusContainer}>
              <Ionicons name='videocam' size={18} color='rgba(255, 255, 255, 0.9)' />
              <Text style={styles.callStatusText}>Incoming video call</Text>
            </View>
          </View>

          {/* Call Actions */}
          <View style={styles.actionsContainer}>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
                activeOpacity={0.7}
              >
                <MaterialIcons name='call-end' size={30} color='#fff' />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.answerButton]}
                onPress={handleAnswer}
                activeOpacity={0.7}
              >
                <Ionicons name='videocam' size={30} color='#fff' />
              </TouchableOpacity>
            </View>

            <View style={styles.actionLabelsRow}>
              <Text style={styles.actionLabelText}>Decline</Text>
              <Text style={styles.actionLabelText}>Accept</Text>
            </View>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  callerInfoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#fff',
  },
  fallbackAvatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#2c2c2c',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  fallbackText: {
    fontSize: 50,
    color: '#fff',
    fontWeight: 'bold',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  callStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 4,
  },
  callStatusText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
    fontWeight: '500',
  },
  actionsContainer: {
    marginBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 30,
  },
  actionLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 30,
    marginTop: 12,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  answerButton: {
    backgroundColor: '#34C759',
  },
  actionLabelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    width: 70,
    textAlign: 'center',
  },
});

export default memo(IncomingCallModal);
