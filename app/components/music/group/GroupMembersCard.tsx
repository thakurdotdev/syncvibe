import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Card from '@/components/ui/card';
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

const MAX_VISIBLE_AVATARS = 4;
const AVATAR_SIZE = 28;
const OVERLAP = 8;

export const GroupMembersCard: React.FC<GroupMembersCardProps> = ({ groupMembers, hostId }) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  const visibleAvatars = groupMembers.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = groupMembers.length - MAX_VISIBLE_AVATARS;
  const pileWidth =
    visibleAvatars.length * (AVATAR_SIZE - OVERLAP) +
    OVERLAP +
    (overflow > 0 ? AVATAR_SIZE - OVERLAP + OVERLAP : 0);

  return (
    <Card variant='default' style={styles.container}>
      <TouchableOpacity
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole='button'
        accessibilityLabel='Toggle members list'
        style={styles.header}
      >
        <Feather name='users' size={15} color={colors.mutedForeground} />

        <Text style={[styles.title, { color: colors.foreground }]}>Listeners</Text>

        <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>
            {groupMembers.length}
          </Text>
        </View>

        {/* Avatar pile */}
        <View style={[styles.avatarPile, { width: pileWidth }]}>
          {visibleAvatars.map((member, i) => (
            <Image
              key={member.userId.toString()}
              source={{
                uri: getProfileCloudinaryUrl(member.profilePic) || 'https://via.placeholder.com/28',
              }}
              style={[
                styles.pileAvatar,
                {
                  left: i * (AVATAR_SIZE - OVERLAP),
                  borderColor: colors.background,
                  backgroundColor: colors.secondary,
                },
              ]}
            />
          ))}
          {overflow > 0 && (
            <View
              style={[
                styles.pileAvatar,
                styles.overflowBadge,
                {
                  left: visibleAvatars.length * (AVATAR_SIZE - OVERLAP),
                  borderColor: colors.background,
                  backgroundColor: colors.secondary,
                },
              ]}
            >
              <Text style={[styles.overflowText, { color: colors.mutedForeground }]}>
                +{overflow}
              </Text>
            </View>
          )}
        </View>

        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.mutedForeground + '60'}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.memberList, { borderTopColor: colors.border + '30' }]}>
          {groupMembers.map((item, index) => {
            const isHost = hostId && item.userId.toString() === hostId.toString();
            const isLast = index === groupMembers.length - 1;

            return (
              <View
                key={item.userId.toString()}
                style={[
                  styles.memberRow,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border + '30',
                  },
                ]}
              >
                <Image
                  source={{
                    uri:
                      getProfileCloudinaryUrl(item.profilePic) || 'https://via.placeholder.com/32',
                  }}
                  style={[styles.memberAvatar, { backgroundColor: colors.secondary }]}
                />
                <Text style={[styles.memberName, { color: colors.foreground }]}>
                  {item.userName}
                </Text>
                {isHost && (
                  <View style={[styles.hostBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.hostText, { color: colors.primary }]}>Host</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
  avatarPile: {
    flex: 1,
    height: AVATAR_SIZE,
    flexDirection: 'row',
    marginLeft: 4,
  },
  pileAvatar: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
  },
  overflowBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    fontSize: 9,
    fontWeight: '700',
  },
  memberList: {
    marginTop: 8,
    paddingTop: 4,
    borderTopWidth: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
  },
  hostText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
