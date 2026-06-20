import React from 'react';
import { FlatList, Image, Text, View } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/context/ThemeContext';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';

interface Member {
  userId: string | number;
  userName: string;
  profilePic?: string;
}

interface GroupMembersCardProps {
  groupMembers: Member[];
  hostId?: string | number;
}

export const GroupMembersCard: React.FC<GroupMembersCardProps> = ({
  groupMembers,
  hostId,
}) => {
  const { colors } = useTheme();

  return (
    <Card variant='outline' className='m-4' style={{ flex: 1 }}>
      <CardHeader>
        <CardTitle>Group Members ({groupMembers.length})</CardTitle>
      </CardHeader>
      <CardContent style={{ flex: 1 }}>
        <FlatList
          data={groupMembers}
          keyExtractor={(item) => item.userId.toString()}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Image
                source={{
                  uri:
                    getProfileCloudinaryUrl(item.profilePic) ||
                    'https://via.placeholder.com/40',
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.secondary,
                }}
              />
              <View style={{ marginLeft: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 15 }}>
                  {item.userName}
                </Text>
                {hostId && item.userId.toString() === hostId.toString() && (
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    Host
                  </Text>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      </CardContent>
    </Card>
  );
};
