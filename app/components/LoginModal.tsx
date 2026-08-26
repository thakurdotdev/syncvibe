import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LoginModal = ({ title }: { title?: string }) => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <BlurView intensity={10} tint='dark' style={styles.blurContainer}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#111827', '#0f172a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
          >
            <View style={styles.glassmorphicAccent} />
            <View style={styles.glassmorphicAccent2} />

            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#3b82f6', '#6366f1']}
                style={styles.iconBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Image
                  source={{
                    uri: 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp',
                  }}
                  style={{ width: 65, height: 65 }}
                  resizeMode='contain'
                  className='rounded-full'
                />
              </LinearGradient>
            </View>

            <Text style={styles.title}>Sign in Required</Text>

            <Text style={styles.description}>
              {title ? title : 'You need to be signed in to use this feature. Sign in to continue.'}
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push('/login')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3b82f6', '#6366f1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Ionicons
                    name='log-in-outline'
                    size={20}
                    color='#fff'
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.buttonText}>Sign In</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  blurContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  glassmorphicAccent: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    zIndex: -1,
  },
  glassmorphicAccent2: {
    position: 'absolute',
    bottom: -100,
    left: -60,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    zIndex: -1,
  },
  gradientContainer: {
    padding: 32,
    width: '100%',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  iconContainer: {
    marginBottom: 28,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  iconBackground: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
  },
  signInButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  backButton: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default LoginModal;
