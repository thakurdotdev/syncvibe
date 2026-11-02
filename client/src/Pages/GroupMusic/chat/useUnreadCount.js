import { useMemo, useState } from 'react';
import { isActivityMessage, isOwnMessage } from './chatUtils';

/** Number of messages from other people that arrived while the chat was not visible. */
export const useUnreadCount = (messages, isVisible, currentUserId) => {
  const [seenCount, setSeenCount] = useState(messages.length);

  // Adjust state during render (React-recommended over an effect) when the
  // chat becomes visible or the message list is reset.
  if ((isVisible && seenCount !== messages.length) || messages.length < seenCount) {
    setSeenCount(messages.length);
  }

  return useMemo(() => {
    if (isVisible) return 0;
    return messages
      .slice(seenCount)
      .filter((msg) => !isActivityMessage(msg) && !isOwnMessage(msg, currentUserId)).length;
  }, [messages, seenCount, isVisible, currentUserId]);
};
