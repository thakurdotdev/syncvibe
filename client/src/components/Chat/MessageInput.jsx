import {
  Check,
  CornerUpLeft,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Pencil,
  Play,
  SendHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ACCEPT,
  attachmentLabel,
  fileFamily,
  filesFromClipboard,
  formatBytes,
  replyLabel,
} from '@/lib/attachments';
import { MAX_MESSAGE_LENGTH, setTyping } from '@/lib/chat';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

const MAX_ROWS_PX = 140;
/** The count appears once this close to the limit. */
const SHOW_COUNT_WITHIN = 200;

const Banner = ({ icon: Icon, title, text, onCancel, cancelLabel }) => (
  <div className='mb-2 flex items-center gap-2 rounded-xl bg-foreground/[0.05] py-1.5 pl-3 pr-1.5'>
    <Icon className='h-3.5 w-3.5 shrink-0 text-primary' aria-hidden='true' />
    <div className='min-w-0 flex-1 text-xs'>
      <span className='font-semibold'>{title}</span>
      <p className='truncate text-muted-foreground'>{text}</p>
    </div>
    <button
      type='button'
      onClick={onCancel}
      aria-label={cancelLabel}
      className='flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
    >
      <X className='h-3.5 w-3.5' />
    </button>
  </div>
);

const removeButton =
  'absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-foreground text-background shadow-sm ring-2 ring-card transition-transform hover:scale-110';

/** A file waiting to be sent: a thumbnail for photos and videos, a small card for the rest. */
const StagedFile = ({ item, onRemove }) => {
  const { file, kind, preview } = item;
  const remove = (
    <button
      type='button'
      onClick={() => onRemove(item.id)}
      aria-label={`Remove ${file.name}`}
      className={removeButton}
    >
      <X className='h-3 w-3' strokeWidth={2.5} />
    </button>
  );

  if (preview) {
    return (
      <div className='relative h-16 w-16 shrink-0' title={file.name}>
        {kind === 'video' ? (
          <video
            src={`${preview}#t=0.1`}
            preload='metadata'
            muted
            className='h-full w-full rounded-lg object-cover'
          />
        ) : (
          <img src={preview} alt={file.name} className='h-full w-full rounded-lg object-cover' />
        )}
        {kind === 'video' && (
          <span className='absolute inset-0 flex items-center justify-center'>
            <Play className='h-4 w-4 fill-on-scrim text-on-scrim drop-shadow' />
          </span>
        )}
        {remove}
      </div>
    );
  }

  const family = kind === 'audio' ? 'audio' : fileFamily(file.name);
  const Icon =
    { audio: FileAudio, archive: FileArchive, sheet: FileSpreadsheet }[family] ?? FileText;
  return (
    <div
      className='relative flex h-16 w-48 shrink-0 items-center gap-2.5 rounded-lg bg-foreground/[0.05] px-2.5'
      title={file.name}
    >
      <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground/[0.07]'>
        <Icon className='h-4.5 w-4.5' strokeWidth={1.75} />
      </span>
      <span className='min-w-0'>
        <span className='block truncate text-xs font-medium'>{file.name}</span>
        <span className='block text-[11px] tabular-nums text-muted-foreground'>
          {formatBytes(file.size)}
        </span>
      </span>
      {remove}
    </div>
  );
};

/** Where messages are written. The same box edits an existing message. */
const MessageInput = ({
  conversationId,
  peerName,
  meId,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onSaveEdit,
  onSend,
  files,
  onAddFiles,
  onRemoveFile,
}) => {
  const [draft, setDraft] = useState('');
  const [editText, setEditText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Editing borrows the box; what was being written is still there afterwards.
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    setEditText(editing?.body || '');
  }
  const text = editing ? editText : draft;
  const setText = editing ? setEditText : setDraft;

  useEffect(() => {
    inputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [text]);

  useEffect(() => () => setTyping(conversationId, false), [conversationId]);

  const canSubmit = editing
    ? Boolean(text.trim() || editing.attachment)
    : Boolean(text.trim() || files.length);

  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      onSaveEdit(text);
      return;
    }
    onSend({ body: text });
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      if (editing) onCancelEdit();
      else if (replyTo) onCancelReply();
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (!editing) setTyping(conversationId, e.target.value.trim().length > 0);
  };

  const handlePaste = (e) => {
    if (editing) return;
    const pasted = filesFromClipboard(e.clipboardData);
    if (pasted.length) {
      e.preventDefault();
      onAddFiles(pasted);
    }
  };

  const remaining = MAX_MESSAGE_LENGTH - text.length;

  return (
    <Card className='mt-auto w-full rounded-none border-t p-3 shadow-xs'>
      {editing && (
        <Banner
          icon={Pencil}
          title='Editing message'
          text={editing.body || attachmentLabel(editing.attachment)}
          onCancel={onCancelEdit}
          cancelLabel='Cancel editing'
        />
      )}
      {replyTo && !editing && (
        <Banner
          icon={CornerUpLeft}
          title={`Replying to ${replyTo.senderId === meId ? 'yourself' : peerName}`}
          text={replyLabel({
            body: replyTo.body,
            hasAttachment: Boolean(replyTo.attachment),
            attachmentKind: replyTo.attachment?.kind,
            attachmentName: replyTo.attachment?.name,
          })}
          onCancel={onCancelReply}
          cancelLabel='Cancel reply'
        />
      )}

      {files.length > 0 && !editing && (
        <div className='-mx-3 mb-2 flex gap-2.5 overflow-x-auto px-3 pt-2 pb-1 [scrollbar-width:thin]'>
          {files.map((item) => (
            <StagedFile key={item.id} item={item} onRemove={onRemoveFile} />
          ))}
        </div>
      )}

      <div className='flex items-end gap-2'>
        {!editing && (
          <Button
            variant='ghost'
            size='icon'
            className='shrink-0 rounded-full'
            onClick={() => fileInputRef.current?.click()}
            aria-label='Attach files'
            title='Attach files. You can also paste or drop them here.'
          >
            <Paperclip className='h-5 w-5 text-muted-foreground' />
          </Button>
        )}
        <input
          type='file'
          multiple
          accept={ACCEPT}
          className='hidden'
          ref={fileInputRef}
          onChange={(e) => {
            onAddFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className='relative min-w-0 flex-1'>
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => setTyping(conversationId, false)}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={files.length && !editing ? 'Add a message' : 'Message'}
            aria-label={editing ? 'Edit message' : `Message ${peerName}`}
            className='surface-input block max-h-[140px] border bg-transparent min-h-10 w-full resize-none rounded-3xl px-4 py-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring'
          />
          {remaining <= SHOW_COUNT_WITHIN && (
            <span className='absolute -top-5 right-2 text-[11px] tabular-nums text-muted-foreground'>
              {remaining}
            </span>
          )}
        </div>

        <Button
          variant={canSubmit ? 'default' : 'ghost'}
          size='icon'
          className='shrink-0 rounded-full'
          disabled={!canSubmit}
          onClick={submit}
          aria-label={editing ? 'Save changes' : 'Send message'}
        >
          {editing ? <Check className='h-5 w-5' /> : <SendHorizontal className='h-5 w-5' />}
        </Button>
      </div>
    </Card>
  );
};

export default MessageInput;
