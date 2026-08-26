import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SwipeableModal from '@/components/SwipeableModal';
import { useTheme } from '@/context/ThemeContext';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, qrCode }) => {
  const { colors } = useTheme();

  return (
    <SwipeableModal isVisible={isOpen} onClose={onClose}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>Group QR Code</Text>
        <View style={[styles.qrContainer, { backgroundColor: colors.secondary }]}>
          <Image
            source={{ uri: `data:image/png;base64,${qrCode}` }}
            style={styles.qrImage}
            resizeMode='contain'
          />
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Share this QR code with others to join your group
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6}>
          <Text style={[styles.closeText, { color: colors.mutedForeground }]}>Close</Text>
        </TouchableOpacity>
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    borderRadius: 12,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeButton: {
    marginTop: 24,
    paddingVertical: 12,
  },
  closeText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
});
