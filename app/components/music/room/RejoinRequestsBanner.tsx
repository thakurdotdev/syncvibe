import { Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { useChat } from '@/context/SocketContext';
import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import type { RejoinRequest } from '@/stores/groupMusic/types';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRoomControl } from './useRoomControl';

const NO_REQUESTS: RejoinRequest[] = [];
const AVATAR = 34;

/**
 * Someone a host removed asking to be let back in, for whoever can answer: the host, and
 * co-hosts for anyone removed as a listener. One at a time, oldest first; it goes once anyone
 * answers, here or on another host's device.
 */
export const RejoinRequestsBanner = memo(function RejoinRequestsBanner() {
  const { colors } = useTheme();
  const { socket } = useChat();
  const { isHost, canManage } = useRoomControl();
  const all = useGroupSessionStore((s) => s.currentGroup?.rejoinRequests ?? NO_REQUESTS);

  const requests = useMemo(
    () => (canManage ? all.filter((request) => isHost || !request.hostOnly) : NO_REQUESTS),
    [all, canManage, isHost]
  );
  const request = requests[0];
  if (!request) return null;

  const answer = (accept: boolean) =>
    useGroupSessionStore.getState().answerRejoin(socket, request.userId, accept);
  const more = requests.length - 1;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      accessibilityRole='alert'
    >
      <Image
        source={{ uri: getProfileCloudinaryUrl(request.profilePic) }}
        style={[styles.avatar, { backgroundColor: colors.raised }]}
        fadeDuration={0}
      />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {request.userName} wants to rejoin
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {more > 0 ? `and ${more} more waiting` : 'A host removed them'}
        </Text>
      </View>
      <PressableScale
        onPress={() => answer(false)}
        accessibilityRole='button'
        accessibilityLabel={`Decline ${request.userName}`}
        style={[styles.button, { borderColor: colors.hairline }]}
      >
        <Gloss tone='surface' />
        <Text style={[styles.buttonText, { color: colors.foreground }]}>Decline</Text>
      </PressableScale>
      <PressableScale
        onPress={() => answer(true)}
        accessibilityRole='button'
        accessibilityLabel={`Let ${request.userName} back in`}
        style={[styles.button, { backgroundColor: colors.primary, borderColor: 'transparent' }]}
      >
        <Gloss />
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Let in</Text>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 12.5, marginTop: 1 },
  button: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonText: { fontSize: 13, fontWeight: '700' },
});
