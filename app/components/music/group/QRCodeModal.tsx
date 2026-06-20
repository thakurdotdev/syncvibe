import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import SwipeableModal from '@/components/common/SwipeableModal';
import { useTheme } from '@/context/ThemeContext';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  qrCode,
}) => {
  const { colors } = useTheme();

  return (
    <SwipeableModal isVisible={isOpen} onClose={onClose}>
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 20,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          Group QR Code
        </Text>
        <View
          style={{
            backgroundColor: colors.card,
            padding: 16,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <Image
            source={{
              uri: `data:image/png;base64,${qrCode}`,
            }}
            style={{ width: 250, height: 250 }}
            resizeMode='contain'
          />
        </View>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 14,
            marginTop: 20,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          Share this QR code with others to join your group
        </Text>
        <TouchableOpacity
          onPress={onClose}
          style={{ marginTop: 24, paddingVertical: 12 }}
        >
          <Text
            style={{
              color: colors.mutedForeground,
              textAlign: 'center',
              fontSize: 15,
              fontWeight: '500',
            }}
          >
            Close
          </Text>
        </TouchableOpacity>
      </View>
    </SwipeableModal>
  );
};
