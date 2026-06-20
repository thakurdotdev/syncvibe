import { useChat } from '@/context/SocketContext';
import { useVideoCall } from '@/context/VideoCallContext';
import { PhoneCall, Video } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const StartCall = () => {
  const { isInCall, startCall } = useVideoCall();
  const { currentChat } = useChat();
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Animation references
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  if (isInCall || !currentChat) {
    return null;
  }

  const handleStartCall = () => {
    // Run exit animation before closing
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsModalVisible(false);
      startCall(
        currentChat?.otherUser?.userid,
        currentChat?.otherUser?.name,
        currentChat?.otherUser?.profilepic
      );
    });
  };

  const openModal = () => {
    setIsModalVisible(true);
    // Reset animations
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);

    // Run entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setIsModalVisible(false));
  };

  return (
    <View style={{ flex: 1, alignItems: 'flex-end' }}>
      <TouchableOpacity onPress={openModal} style={styles.videoIconButton} activeOpacity={0.7}>
        <Video size={22} color='#FFFFFF' />
      </TouchableOpacity>

      <Modal
        animationType='none' // We'll handle animations ourselves
        transparent={true}
        visible={isModalVisible}
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.modalContent,
                  {
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                  },
                ]}
              >
                {/* Video call icon */}
                <View style={styles.iconContainer}>
                  <Video size={32} color='#3B82F6' />
                </View>

                <Text style={styles.modalTitle}>Start Video Call</Text>

                {/* User info with profile picture */}
                <View style={styles.userInfo}>
                  {currentChat?.otherUser?.profilepic && (
                    <Image
                      source={{ uri: currentChat.otherUser.profilepic }}
                      style={styles.userImage}
                    />
                  )}
                  <Text style={styles.userName}>{currentChat?.otherUser?.name || 'User'}</Text>
                </View>

                <Text style={styles.modalDescription}>
                  Make sure your camera and microphone permissions are enabled for the best
                  experience.
                </Text>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={closeModal}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.confirmButton]}
                    onPress={handleStartCall}
                    activeOpacity={0.7}
                  >
                    <View style={styles.buttonContent}>
                      <PhoneCall size={16} color='#FFFFFF' style={{ marginRight: 6 }} />
                      <Text style={styles.confirmButtonText}>Start Call</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  videoIconButton: {
    // backgroundColor: "#3B82F6",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1E27', // Darker background
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 15,
    alignItems: 'center', // Center content
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
    zIndex: 10,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F9FAFB', // Near white text
    marginBottom: 16,
    textAlign: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(55, 65, 81, 0.3)',
  },
  userImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  modalDescription: {
    fontSize: 15,
    color: '#9CA3AF', // Light gray text
    marginBottom: 24,
    lineHeight: 22,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(55, 65, 81, 0.6)',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E5E7EB',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StartCall;
