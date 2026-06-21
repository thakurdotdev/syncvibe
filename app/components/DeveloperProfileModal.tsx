import React, { useState } from 'react';
import { Dimensions, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import SwipeableModal from './common/SwipeableModal';

const { width } = Dimensions.get('window');

interface DeveloperProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({ isVisible, onClose }) => {
  const { colors } = useTheme();
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const handleSocialLink = (url: string) => {
    Linking.openURL(url);
  };

  const handleLongPress = () => {
    setShowEasterEgg(true);
    setTimeout(() => setShowEasterEgg(false), 2000);
  };

  const socialLinks = [
    {
      name: 'GitHub',
      icon: 'github' as const,
      url: 'https://github.com/thakurdotdev',
    },
    {
      name: 'LinkedIn',
      icon: 'linkedin' as const,
      url: 'https://linkedin.com/in/thakurdotdev',
    },
    {
      name: 'Twitter',
      icon: 'twitter' as const,
      url: 'https://twitter.com/thakurdotdev',
    },
    {
      name: 'Instagram',
      icon: 'instagram' as const,
      url: 'https://instagram.com/thakurdotdev',
    },
  ];

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} hideHandle>
      <View style={styles.container}>
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          />
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            delayLongPress={800}
            style={styles.avatarContainer}
            activeOpacity={0.9}
          >
            <Image
              source={{
                uri: 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1745152151/lmdhpag0p6ubockyjs1q.jpg',
              }}
              style={[styles.avatar, { borderColor: colors.card }]}
            />
            {showEasterEgg && (
              <View style={[styles.easterEgg, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                <Text style={[styles.easterEggText, { color: colors.foreground }]}>
                  🚀 Keep building amazing things!
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.name, { color: colors.foreground }]}>Pankaj Thakur</Text>

          <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>SOFTWARE ENGINEER</Text>
          </View>

          <Text style={[styles.bio, { color: colors.foreground }]}>
            A passionate builder crafting digital experiences that vibe. Focused on clean code,
            meaningful UX, and scalable tech.
          </Text>

          <View style={styles.socialLinks}>
            {socialLinks.map((link) => (
              <TouchableOpacity
                key={link.name}
                style={[styles.socialButton, { backgroundColor: colors.secondary }]}
                onPress={() => handleSocialLink(link.url)}
                activeOpacity={0.7}
              >
                <Feather name={link.icon} size={20} color={colors.foreground} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.portfolioLink, { backgroundColor: colors.primary }]}
            onPress={() => handleSocialLink('https://thakur.dev')}
            activeOpacity={0.9}
          >
            <Text style={[styles.portfolioText, { color: colors.primaryForeground }]}>
              Visit my portfolio
            </Text>
            <Feather name="external-link" size={16} color={colors.primaryForeground} style={styles.linkIcon} />
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Built with ❤️ by Pankaj Thakur
            </Text>
          </View>
        </View>
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  bannerContainer: {
    position: 'relative',
    height: 120,
    width: '100%',
  },
  banner: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  avatarContainer: {
    marginTop: -50,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
  },
  easterEgg: {
    position: 'absolute',
    top: -45,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    width: 220,
    alignItems: 'center',
  },
  easterEggText: {
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  bio: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: width - 80,
  },
  socialLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 28,
  },
  socialButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portfolioLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  portfolioText: {
    fontSize: 16,
    fontWeight: '700',
  },
  linkIcon: {
    marginLeft: 8,
  },
  footer: {
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default DeveloperProfileModal;
