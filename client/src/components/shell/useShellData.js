import { useContext, useMemo } from 'react';
import { ChatContext } from '@/Context/ChatContext';

/**
 * Unread total plus the people you talk to, ordered so the ones that need you come first:
 * unread, then typing, then online, then most recent.
 */
export const useChatSummary = (limit = 6) => {
  const chat = useContext(ChatContext);
  const users = chat?.users;
  const onlineStatuses = chat?.onlineStatuses;

  return useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    const unread = list.reduce((sum, u) => sum + (Number(u?.unreadCount) || 0), 0);
    const score = (u) =>
      (Number(u.unreadCount) > 0 ? 4 : 0) + (u.isTyping ? 2 : 0) + (u.isOnline ? 1 : 0);
    const people = list
      .map((u, index) => ({
        ...u,
        index,
        isOnline: Boolean(onlineStatuses?.[u?.otherUser?.userid]),
      }))
      .sort((a, b) => score(b) - score(a) || a.index - b.index)
      .slice(0, limit);
    return { unread, people, total: list.length };
  }, [users, onlineStatuses, limit]);
};
