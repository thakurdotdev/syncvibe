import { useMemo } from 'react';
import { selectUnreadTotal, useChatStore } from '@/stores/chatStore';

/**
 * Unread total plus the people you talk to, ordered so the ones that need you come first:
 * unread, then typing, then online, then most recent.
 */
export const useChatSummary = (limit = 6) => {
  const conversations = useChatStore((s) => s.conversations);
  const presence = useChatStore((s) => s.presence);
  const typing = useChatStore((s) => s.typing);
  const unread = useChatStore(selectUnreadTotal);

  return useMemo(() => {
    const score = (p) => (p.unreadCount > 0 ? 4 : 0) + (p.isTyping ? 2 : 0) + (p.isOnline ? 1 : 0);
    const people = conversations
      .map((c, index) => ({
        id: c.id,
        peer: c.peer,
        unreadCount: c.unreadCount,
        isTyping: Boolean(typing[c.id]),
        isOnline: Boolean(presence[c.peer.userid]),
        index,
      }))
      .sort((a, b) => score(b) - score(a) || a.index - b.index)
      .slice(0, limit);
    return { unread, people, total: conversations.length };
  }, [conversations, presence, typing, unread, limit]);
};
