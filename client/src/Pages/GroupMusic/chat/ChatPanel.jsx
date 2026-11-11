import UpgradeDialog from '@/components/UpgradeDialog';
import { memo, useCallback, useMemo, useState } from 'react';
import { useRoomPreferences } from '../hooks/useRoomPreferences';
import { useRoomUi } from '../hooks/useRoomUi';
import ChatComposer from './ChatComposer';
import { ChatLockedOverlay, TypingIndicator } from './ChatStates';
import ChatToolbar from './ChatToolbar';
import { buildReplyReference } from './chatUtils';
import MessageList from './MessageList';

/**
 * Group chat: quick preferences, scrollable message log and a fixed composer.
 * Fills its parent's height.
 */
const ChatPanel = ({
  messages,
  currentUserId,
  currentUserName,
  onSendMessage,
  onReactToMessage,
  locked = false,
  muted = false,
  typingUsers = {},
  onTypingStart,
  onTypingStop,
}) => {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const mediaBlur = useRoomPreferences((s) => s.mediaBlur);
  const focusRequest = useRoomUi((s) => s.chatFocusRequest);

  const typingNames = useMemo(() => Object.values(typingUsers).filter(Boolean), [typingUsers]);

  // Every outgoing message carries the reply reference (if any), then clears it.
  const send = useCallback(
    (message, messageType = 'text', extra = {}) => {
      const replyTo = replyTarget ? buildReplyReference(replyTarget) : undefined;
      onSendMessage(message, messageType, replyTo ? { ...extra, replyTo } : extra);
      setReplyTarget(null);
    },
    [onSendMessage, replyTarget]
  );

  const sendText = useCallback((text) => send(text), [send]);
  const sendMedia = useCallback((url) => send(url, 'gif'), [send]);
  const sendSound = useCallback(
    (sound) =>
      send(sound.url, 'sound', {
        soundUrl: sound.url,
        soundName: sound.name,
        soundId: sound.id,
      }),
    [send]
  );

  const react = useCallback(
    (messageId, emoji) => onReactToMessage?.(messageId, emoji),
    [onReactToMessage]
  );
  const cancelReply = useCallback(() => setReplyTarget(null), []);

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      {locked && <ChatLockedOverlay onUpgrade={() => setShowUpgrade(true)} />}

      <ChatToolbar />
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        mediaBlur={mediaBlur}
        onReact={react}
        onReply={setReplyTarget}
      />
      <TypingIndicator names={typingNames} />
      <ChatComposer
        disabled={locked || muted}
        disabledLabel={muted && !locked ? 'A host muted you' : undefined}
        focusRequest={focusRequest}
        replyTarget={replyTarget}
        onCancelReply={cancelReply}
        onSendText={sendText}
        onSendMedia={sendMedia}
        onSendSound={sendSound}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />

      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} feature='realtimeChat' />
    </div>
  );
};

export default memo(ChatPanel);
