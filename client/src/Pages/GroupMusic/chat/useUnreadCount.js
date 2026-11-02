import { useMemo, useState } from 'react';
import { isActivityMessage, isOwnMessage } from './chatUtils';

const latestTimestamp = (messages) =>
  messages.reduce((max, msg) => Math.max(max, msg.timestamp || 0), 0);

/**
 * Messages from other people that arrived while the chat wasn't visible.
 * Timestamp-based, so loading older history never counts as unread.
 */
export const useUnreadCount = (messages, isVisible, currentUserId) => {
  // Start from "now": history loaded later (older timestamps) is never unread.
  const [seenUntil, setSeenUntil] = useState(() => Math.max(latestTimestamp(messages), Date.now()));
  const latest = latestTimestamp(messages);

  // Adjust state during render (React-recommended over an effect).
  if (isVisible && latest > seenUntil) setSeenUntil(latest);

  return useMemo(() => {
    if (isVisible) return 0;
    return messages.filter(
      (msg) =>
        (msg.timestamp || 0) > seenUntil &&
        !isActivityMessage(msg) &&
        !isOwnMessage(msg, currentUserId)
    ).length;
  }, [messages, seenUntil, isVisible, currentUserId]);
};
