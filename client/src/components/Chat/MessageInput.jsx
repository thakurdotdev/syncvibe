import { CornerUpLeft, ImagePlus, Pencil, SendHorizontal, Check, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MAX_MESSAGE_LENGTH, setTyping } from '@/lib/chat';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
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
}) => {
  const [draft, setDraft] = useState('');
  const [editText, setEditText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [file, setFile] = useState(null);
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

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  useEffect(() => () => setTyping(conversationId, false), [conversationId]);

  const pickFile = (picked) => {
    if (!picked) return;
    if (!IMAGE_TYPES.includes(picked.type)) {
      toast.error('Photos can be JPG, PNG, GIF or WebP');
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      toast.error('Photos can be up to 5 MB');
      return;
    }
    setFile(picked);
  };

  const canSubmit = editing
    ? Boolean(text.trim() || editing.attachment)
    : Boolean(text.trim() || file);

  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      onSaveEdit(text);
      return;
    }
    onSend({ body: text, file });
    setText('');
    setFile(null);
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
    const pasted = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (pasted && !editing) {
      e.preventDefault();
      pickFile(pasted);
    }
  };

  const remaining = MAX_MESSAGE_LENGTH - text.length;

  return (
    <Card className='mt-auto w-full rounded-none border-t p-3 shadow-xs'>
      {editing && (
        <Banner
          icon={Pencil}
          title='Editing message'
          text={editing.body || 'Photo'}
          onCancel={onCancelEdit}
          cancelLabel='Cancel editing'
        />
      )}
      {replyTo && !editing && (
        <Banner
          icon={CornerUpLeft}
          title={`Replying to ${replyTo.senderId === meId ? 'yourself' : peerName}`}
          text={replyTo.body || 'Photo'}
          onCancel={onCancelReply}
          cancelLabel='Cancel reply'
        />
      )}

      {preview && !editing && (
        <div className='relative mb-3 mr-auto h-24 w-24 overflow-hidden rounded-md'>
          <img src={preview} alt='Ready to send' className='h-full w-full object-cover' />
          <Button
            variant='destructive'
            size='icon'
            className='absolute right-0.5 top-0.5 h-6 w-6 rounded-full'
            onClick={() => setFile(null)}
            aria-label='Remove photo'
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      )}

      <div className='flex items-end gap-2'>
        {!editing && (
          <Button
            variant='ghost'
            size='icon'
            className='shrink-0 rounded-full'
            onClick={() => fileInputRef.current?.click()}
            aria-label='Add a photo'
            title='Add a photo'
          >
            <ImagePlus className='h-5 w-5 text-muted-foreground' />
          </Button>
        )}
        <input
          type='file'
          accept={IMAGE_TYPES.join(',')}
          className='hidden'
          ref={fileInputRef}
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
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
            placeholder='Message'
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
