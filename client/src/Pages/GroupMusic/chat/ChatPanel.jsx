import UpgradeDialog from '@/components/UpgradeDialog';
import { memo, useCallback, useMemo, useState } from 'react';
import { useRoomPreferences } from '../hooks/useRoomPreferences';
import { useRoomUi } from '../hooks/useRoomUi';
import ChatComposer from './ChatComposer';
import { ChatLockedOverlay, TypingIndicator } from './ChatStates';
import MessageList from './MessageList';

/** Group chat: scrollable message log + fixed composer. Fills its parent's height. */
const ChatPanel = ({
  messages,
  currentUserId,
  onSendMessage,
  locked = false,
  typingUsers = {},
  onTypingStart,
  onTypingStop,
}) => {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const mediaBlur = useRoomPreferences((s) => s.mediaBlur);
  const focusRequest = useRoomUi((s) => s.chatFocusRequest);

  const typingNames = useMemo(() => Object.values(typingUsers).filter(Boolean), [typingUsers]);

  const sendMedia = useCallback((url) => onSendMessage(url, 'gif'), [onSendMessage]);
  const sendSound = useCallback(
    (sound) =>
      onSendMessage(sound.url, 'sound', {
        soundUrl: sound.url,
        soundName: sound.name,
        soundId: sound.id,
      }),
    [onSendMessage]
  );

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      {locked && <ChatLockedOverlay onUpgrade={() => setShowUpgrade(true)} />}

      <MessageList messages={messages} currentUserId={currentUserId} mediaBlur={mediaBlur} />
      <TypingIndicator names={typingNames} />
      <ChatComposer
        disabled={locked}
        focusRequest={focusRequest}
        onSendText={onSendMessage}
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
