import { useContext, useMemo } from 'react';
import { ChatContext } from '@/Context/ChatContext';

/** Unread total plus the most recent conversations, for the sidebar and tab badges. */
export const useChatSummary = (limit = 4) => {
  const chat = useContext(ChatContext);
  const users = chat?.users;
  const onlineStatuses = chat?.onlineStatuses;

  return useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    const unread = list.reduce((sum, u) => sum + (Number(u?.unreadCount) || 0), 0);
    const recent = list.slice(0, limit).map((u) => ({
      ...u,
      isOnline: Boolean(onlineStatuses?.[u?.otherUser?.userid]),
    }));
    return { unread, recent };
  }, [users, onlineStatuses, limit]);
};
