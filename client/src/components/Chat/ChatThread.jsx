import { MessagesSquare, Paperclip } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  MAX_FILES_AT_ONCE,
  checkFile,
  dragHasFiles,
  droppedFolders,
  filesFromClipboard,
} from '@/lib/attachments';
import {
  deleteMessage,
  discardMessage,
  downloadAttachment,
  editMessage,
  freshAttachment,
  loadOlder,
  loadThread,
  markRead,
  newClientId,
  retryMessage,
  sendMessage,
  toggleReaction,
} from '@/lib/chat';
import { selectConversation, selectThread, useChatStore } from '@/stores/chatStore';
import { startCall } from '@/lib/call';
import { selectBusy, useCallStore } from '@/stores/callStore';
import ChatHeader from './ChatHeader';
import FilePreview from './FilePreview';
import MediaViewer from './MediaViewer';
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

  const inCall = useCallStore(selectBusy);

  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [infoFor, setInfoFor] = useState(null);
  const [mediaIndex, setMediaIndex] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [staged, setStaged] = useState([]);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

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

  // Photos and videos, in the viewer's order.
  const media = useMemo(
    () =>
      thread.messages
        .filter(
          (m) =>
            m.id != null &&
            m.attachment?.url &&
            ['image', 'video'].includes(m.attachment.kind ?? 'image')
        )
        .map((m) => ({
          key: m.id,
          message: m,
          kind: m.attachment.kind ?? 'image',
          url: m.attachment.url,
          downloadUrl: m.attachment.downloadUrl ?? m.attachment.url,
          name: m.attachment.name,
        })),
    [thread.messages]
  );

  // Files picked but not yet sent. Each becomes its own message.
  const addFiles = useCallback(
    (list) => {
      const incoming = [...(list || [])];
      if (incoming.length === 0) return;
      const next = [...staged];
      const problems = [];
      for (const file of incoming) {
        if (next.length >= MAX_FILES_AT_ONCE) {
          problems.push(`You can send up to ${MAX_FILES_AT_ONCE} files at once`);
          break;
        }
        const { kind, error } = checkFile(file);
        if (error) {
          problems.push(error);
          continue;
        }
        const duplicate = next.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified
        );
        if (duplicate) continue;
        next.push({
          id: newClientId(),
          file,
          kind,
          preview: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null,
        });
      }
      for (const problem of new Set(problems)) toast.error(problem);
      setStaged(next);
    },
    [staged]
  );

  const removeFile = useCallback((id) => {
    setStaged((current) => {
      const gone = current.find((item) => item.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const stagedRef = useRef(staged);
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);
  useEffect(
    () => () =>
      stagedRef.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)),
    []
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
      openMedia: (message) => {
        const index = media.findIndex((item) => item.key === message.id);
        if (index !== -1) setMediaIndex(index);
      },
      preview: (message) =>
        freshAttachment(message).then(setPreviewing).catch(report("Couldn't open the file")),
      download: (message) =>
        downloadAttachment(message).catch(report("Couldn't download the file")),
    }),
    [media]
  );

  const handleSend = useCallback(
    ({ body }) => {
      const files = staged.map(({ file, kind }) => ({ file, kind }));
      staged.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
      setStaged([]);
      void sendMessage(activeId, { body, files, replyTo });
      setReplyTo(null);
    },
    [activeId, replyTo, staged]
  );

  const dropHandlers = {
    onDragEnter: (e) => {
      if (!dragHasFiles(e) || editing) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (e) => {
      if (!dragHasFiles(e) || editing) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (e) => {
      if (!dragHasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (e) => {
      if (!dragHasFiles(e) || editing) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const folders = droppedFolders(e.dataTransfer);
      if (folders.length) toast.error(`Folders can't be sent. Zip ${folders[0]} first.`);
      addFiles([...e.dataTransfer.files].filter((file) => !folders.includes(file.name)));
    },
  };

  // A file let go anywhere else on the page would make the browser open it and leave the chat.
  // A drag that ends outside the window never sends the leave that would hide the overlay.
  useEffect(() => {
    const keepPage = (e) => {
      if (dragHasFiles(e)) e.preventDefault();
    };
    const reset = () => {
      dragDepth.current = 0;
      setDragging(false);
    };
    window.addEventListener('dragover', keepPage);
    window.addEventListener('drop', keepPage);
    window.addEventListener('drop', reset);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragover', keepPage);
      window.removeEventListener('drop', keepPage);
      window.removeEventListener('drop', reset);
      window.removeEventListener('dragend', reset);
    };
  }, []);

  // Pasting a file attaches it wherever the focus is, not only in the message box. Other text
  // fields (search, for one) keep their paste.
  useEffect(() => {
    const onPaste = (e) => {
      if (e.defaultPrevented || editing) return;
      const target = e.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      const files = filesFromClipboard(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles, editing]);

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
      <div className='relative flex h-full flex-col' {...dropHandlers}>
        <ChatHeader
          peer={peer}
          online={online}
          typing={typing}
          onBack={isMobile ? () => setActive(null) : null}
          onOpenProfile={() => navigate(`/u/${peer.username}`, { state: { user: peer } })}
          onCall={inCall ? null : () => startCall(conversation.peer)}
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
          files={staged}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
        />

        {dragging && (
          <div className='pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-background/85 backdrop-blur-sm animate-in fade-in-0 duration-100'>
            <span className='flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <Paperclip className='h-5 w-5' />
            </span>
            <p className='text-sm font-medium'>Drop to send to {peer.name}</p>
          </div>
        )}
      </div>

      {mediaIndex != null && media.length > 0 && (
        <MediaViewer
          items={media}
          initialIndex={Math.min(mediaIndex, media.length - 1)}
          onClose={() => setMediaIndex(null)}
          onDownload={(item) => actions.download(item.message)}
        />
      )}

      <FilePreview
        attachment={previewing}
        onClose={() => setPreviewing(null)}
        onDownload={() => {
          const message = thread.messages.find((m) => m.attachment?.id === previewing?.id);
          if (message) actions.download(message);
        }}
      />

      <MessageInfoModal
        message={infoFor}
        conversation={conversation}
        onClose={() => setInfoFor(null)}
      />
    </>
  );
};

export default ChatThread;
