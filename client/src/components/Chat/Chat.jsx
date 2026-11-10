import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { openConversationWith } from '@/lib/chat';
import { paths } from '@/lib/paths';
import { useChatStore } from '@/stores/chatStore';
import ChatThread from './ChatThread';
import ConversationList from './ConversationList';

/**
 * Messages: the list of conversations beside the open one, or one at a time on a phone.
 * Other pages open a conversation by navigating here with `state.conversationId`, or with
 * `state.userId` to message someone for the first time.
 */
const Chat = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = useChatStore((s) => s.activeId);
  const setActive = useChatStore((s) => s.setActive);

  const { conversationId, userId } = location.state || {};

  useEffect(() => {
    if (!conversationId && !userId) return;
    navigate(paths.messages, { replace: true });

    if (conversationId) {
      setActive(conversationId);
      return;
    }
    openConversationWith(userId)
      .then((conversation) => setActive(conversation.id))
      .catch((error) =>
        toast.error(error?.response?.data?.message || "Couldn't open that conversation")
      );
  }, [conversationId, userId, navigate, setActive]);

  // Leaving the page closes the conversation, so new messages count as unread again.
  useEffect(() => () => setActive(null), [setActive]);

  if (isMobile) {
    return (
      <div className='relative h-full'>{activeId ? <ChatThread /> : <ConversationList />}</div>
    );
  }

  return (
    <div className='mx-auto flex h-full overflow-hidden'>
      <div className='h-full w-[30%] min-w-[280px] max-w-[380px]'>
        <ConversationList />
      </div>
      <div className='h-full min-w-0 flex-1'>
        <ChatThread />
      </div>
    </div>
  );
};

export default Chat;
