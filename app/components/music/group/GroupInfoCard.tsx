import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/context/ThemeContext';

interface GroupInfoCardProps {
  groupName: string;
  groupId: string;
  onCopyId: () => void;
  onShowQRCode: () => void;
}

export const GroupInfoCard: React.FC<GroupInfoCardProps> = ({
  groupName,
  groupId,
  onCopyId,
  onShowQRCode,
}) => {
  const { colors } = useTheme();

  return (
    <Card variant='outline' className='m-4'>
      <CardContent className='flex-row justify-between items-center'>
        <CardTitle>{groupName}</CardTitle>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={onCopyId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.secondary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              ID: {groupId.substring(0, 8)}...
            </Text>
            <Feather name='copy' size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onShowQRCode}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.secondary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
            }}
          >
            <Feather name='grid' size={14} color={colors.mutedForeground} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                marginLeft: 8,
              }}
              numberOfLines={1}
            >
              QR
            </Text>
          </TouchableOpacity>
        </View>
      </CardContent>
    </Card>
  );
};
