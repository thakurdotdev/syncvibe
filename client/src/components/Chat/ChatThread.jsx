import { MessagesSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  deleteMessage,
  discardMessage,
  editMessage,
  loadOlder,
  loadThread,
  markRead,
  retryMessage,
  sendMessage,
  toggleReaction,
} from '@/lib/chat';
import { selectConversation, selectThread, useChatStore } from '@/stores/chatStore';
import { useVideoCallStore } from '../../stores/videoCallStore';
import ChatHeader from './ChatHeader';
import ImageGallery from './ImageGallery';
import MessageInfoModal from './MessageInfoModal';
import MessageInput from './MessageInput';
import MessageList from './MessageList';

const report = (fallback) => (error) => toast.error(error?.message || fallback);

/** The conversation picked in the list, or a prompt to pick one. */
const ChatThread = () => {
  const activeId = useChatStore((s) => s.activeId);
  const conversation = useChatStore(selectConversation(activeId));

  useEffect(() => {
    if (activeId) void loadThread(activeId);
  }, [activeId]);

  if (!conversation) {
    return (
      <div className='flex h-full flex-col items-center justify-center bg-background/50'>
        <div className='flex max-w-md flex-col items-center gap-4 p-8 text-center'>
          <div className='rounded-3xl bg-primary/10 p-5 text-primary ring-12 ring-primary/5'>
            <MessagesSquare className='h-12 w-12 stroke-[1.5]' />
          </div>
          <div className='space-y-2'>
            <h3 className='text-2xl font-bold tracking-tight text-foreground'>Your Messages</h3>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              Select a conversation from the list, or search for someone to start a new one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Keyed, so a reply or an edit in progress never carries over to another conversation.
  return <OpenThread key={conversation.id} conversation={conversation} />;
};

/** An open conversation: its messages and the box to write in. */
const OpenThread = ({ conversation }) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const activeId = conversation.id;

  const meId = useChatStore((s) => s.meId);
  const setActive = useChatStore((s) => s.setActive);
  const thread = useChatStore(selectThread(activeId));
  const online = useChatStore((s) => Boolean(s.presence[conversation.peer.userid]));
  const typing = useChatStore((s) => Boolean(s.typing[activeId]));

  const isInCall = useVideoCallStore((s) => s.isInCall);
  const incomingCall = useVideoCallStore((s) => s.incomingCall);
  const startCall = useVideoCallStore((s) => s.startCall);

  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [infoFor, setInfoFor] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(null);

  // Read receipts go out only while the conversation is actually being looked at.
  const lastId = thread.messages.findLast((m) => m.id != null)?.id;
  useEffect(() => {
    if (thread.status !== 'ready') return undefined;
    const readIfVisible = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) markRead(activeId);
    };
    readIfVisible();
    window.addEventListener('focus', readIfVisible);
    document.addEventListener('visibilitychange', readIfVisible);
    return () => {
      window.removeEventListener('focus', readIfVisible);
      document.removeEventListener('visibilitychange', readIfVisible);
    };
  }, [activeId, thread.status, lastId]);

  const images = useMemo(
    () =>
      thread.messages
        .filter((m) => m.attachment?.url && m.id != null)
        .map((m) => ({ id: m.id, url: m.attachment.url })),
    [thread.messages]
  );

  const actions = useMemo(
    () => ({
      reply: (message) => {
        setEditing(null);
        setReplyTo(message);
      },
      edit: (message) => {
        setReplyTo(null);
        setEditing(message);
      },
      react: (message, emoji) =>
        toggleReaction(message, emoji).catch(report("Couldn't add your reaction")),
      remove: (message) => deleteMessage(message).catch(report("Couldn't delete the message")),
      retry: retryMessage,
      discard: discardMessage,
      info: setInfoFor,
      copy: (message) =>
        navigator.clipboard
          .writeText(message.body)
          .then(() => toast.success('Copied'))
          .catch(() => toast.error("Couldn't copy")),
      openImage: (message) => {
        const index = images.findIndex((image) => image.id === message.id);
        if (index !== -1) setGalleryIndex(index);
      },
    }),
    [images]
  );

  const handleSend = useCallback(
    ({ body, file }) => {
      sendMessage(activeId, { body, file, replyTo });
      setReplyTo(null);
    },
    [activeId, replyTo]
  );

  const handleSaveEdit = useCallback(
    async (body) => {
      const target = editing;
      setEditing(null);
      if (!target || body.trim() === (target.body || '')) return;
      await editMessage(target, body).catch(report("Couldn't save your edit"));
    },
    [editing]
  );

  const { peer } = conversation;

  return (
    <>
      <div className='relative flex h-full flex-col'>
        <ChatHeader
          peer={peer}
          online={online}
          typing={typing}
          onBack={isMobile ? () => setActive(null) : null}
          onOpenProfile={() => navigate(`/u/${peer.username}`, { state: { user: peer } })}
          call={{ isInCall, incomingCall, startCall }}
        />

        <MessageList
          conversation={conversation}
          thread={thread}
          meId={meId}
          actions={actions}
          onLoadOlder={() => loadOlder(conversation.id)}
          onRetryLoad={() => loadThread(conversation.id)}
        />

        <MessageInput
          conversationId={conversation.id}
          peerName={peer.name}
          meId={meId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSaveEdit={handleSaveEdit}
          onSend={handleSend}
        />
      </div>

      {galleryIndex != null && images.length > 0 && (
        <ImageGallery
          images={images.map((image) => image.url)}
          initialIndex={Math.min(galleryIndex, images.length - 1)}
          onClose={() => setGalleryIndex(null)}
        />
      )}

      <MessageInfoModal
        message={infoFor}
        conversation={conversation}
        onClose={() => setInfoFor(null)}
      />
    </>
  );
};

export default ChatThread;
