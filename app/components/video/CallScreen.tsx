import { useVideoCall } from '@/context/VideoCallContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const CallScreen: React.FC = () => {
  const {
    isInCall,
    currentCall,
    localStream,
    remoteStream,
    endCall,
    flipCamera,
    toggleMute,
    isMuted,
    connectionState,
  } = useVideoCall();

  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (isInCall) endCall();
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connectionState === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionState]);

  const toggleSpeaker = () => {
    setSpeakerOn((prev) => !prev);
  };

  const getStatusMessage = () => {
    switch (connectionState) {
      case 'connected':
        return formatTime(callDuration);
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      default:
        return connectionState;
    }
  };

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.avatarPlaceholder}>
        {currentCall?.profilepic ? (
          <Image source={{ uri: currentCall.profilepic }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{currentCall?.name?.charAt(0) || '?'}</Text>
        )}
      </View>

      <Text style={styles.callerName}>{currentCall?.name}</Text>
      <Text style={styles.callingText}>
        {connectionState === 'connecting' ? 'Connecting...' : 'Calling...'}
      </Text>
      <ActivityIndicator size='large' color='#FFFFFF' style={styles.loadingIndicator} />
    </View>
  );

  if (!isInCall) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.videoContainer}>
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteStream}
            objectFit='cover'
            mirror={false}
          />
        ) : (
          renderLoadingState()
        )}
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusRow}>
          <View style={styles.callTimerContainer}>
            <Ionicons name='time-outline' size={14} color='white' style={styles.timeIcon} />
            <Text style={styles.statusText}>{getStatusMessage()}</Text>
          </View>
        </View>
      </View>

      {localStream && (
        <View style={styles.localStreamContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localStream}
            objectFit='cover'
            mirror={true}
          />
        </View>
      )}

      <Animated.View style={styles.controlsContainer}>
        <BlurView intensity={50} tint='dark' style={styles.controlsBlur}>
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlButton} onPress={flipCamera} activeOpacity={0.7}>
              <View style={[styles.iconContainer]}>
                <Ionicons name='camera-reverse' size={24} color='#fff' />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleMute} activeOpacity={0.7}>
              <View style={[styles.iconContainer]}>
                <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color='#fff' />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={endCall} activeOpacity={0.7}>
              <View style={[styles.iconContainer]} className='bg-red-600'>
                <MaterialIcons name='call-end' size={28} color='red' />
              </View>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    height: '100%',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  statusBar: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  connectionQualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  callTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeIcon: {
    marginRight: 4,
  },
  remoteStream: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },

  callerName: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  callingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 24,
  },
  loadingIndicator: {
    marginTop: 12,
  },
  localStreamContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 110,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 5,
  },
  localStream: {
    width: '100%',
    height: '100%',
  },
  localStreamOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    overflow: 'hidden',
  },
  flipCameraButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerInfoContainer: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 10,
  },
  callerInfoBlur: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  callerInfoName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  controlsBlur: {
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeIconContainer: {
    backgroundColor: '#FFFFFF',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default CallScreen;
