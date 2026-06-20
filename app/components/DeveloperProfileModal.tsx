import { useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SwipeableModal from './common/SwipeableModal';

const { width } = Dimensions.get('window');

interface DeveloperProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({ isVisible, onClose }) => {
  const { colors, theme } = useTheme();
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
    <SwipeableModal isVisible={isVisible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name='x' size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            delayLongPress={1000}
            style={styles.avatarContainer}
          >
            <Image
              source={{
                uri: 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1745152151/lmdhpag0p6ubockyjs1q.jpg',
              }}
              style={styles.avatar}
            />
            {showEasterEgg && (
              <View style={[styles.easterEgg, { backgroundColor: colors.card }]}>
                <Text style={[styles.easterEggText, { color: colors.text }]}>
                  🚀 Keep building amazing things!
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.name, { color: colors.foreground }]}>Pankaj Thakur</Text>
          <Text style={[styles.title, { color: colors.mutedForeground }]}>Software Developer</Text>

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
              >
                <Feather name={link.icon} size={24} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.portfolioLink, { backgroundColor: colors.primary }]}
            onPress={() => handleSocialLink('https://thakur.dev')}
          >
            <Text style={[styles.portfolioText, { color: colors.primaryForeground }]}>
              Visit my portfolio
            </Text>
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
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#4F46E5',
  },
  easterEgg: {
    position: 'absolute',
    top: -40,
    left: -20,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  easterEggText: {
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    marginBottom: 16,
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: width - 80,
  },
  socialLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portfolioLink: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginBottom: 24,
  },
  portfolioText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 14,
  },
});

export default DeveloperProfileModal;
