import { openConversation } from '@/lib/chatScreen';
import { showMoment } from '@/stores/islandStore';

/**
 * A message that arrives while the app is open, for a conversation that isn't on screen, shows
 * as a moment in the header's pill (components/shell/TopIsland) instead of a phone notification.
 * More from the same person while it shows add up ("3 new"). Tap to open the conversation.
 */
export const showMessageBanner = (banner: {
  conversationId: number;
  name: string;
  profilepic: string | null;
  text: string;
}): void => {
  showMoment({
    key: `message-${banner.conversationId}`,
    title: banner.name,
    subtitle: banner.text,
    leading: { kind: 'avatar', name: banner.name, pic: banner.profilepic },
    onPress: () => openConversation(banner.conversationId),
    duration: 4000,
    // The conversation list already shows it; the conversation itself even more so.
    hideOn: (path) => path === '/chat' || path === '/message',
  });
};
