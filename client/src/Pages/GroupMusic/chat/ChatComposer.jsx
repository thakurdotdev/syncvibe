import { cn } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, SendHorizontal, Volume2 } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MediaPicker from './MediaPicker';
import SoundPicker from './SoundPicker';
import { useTypingSignal } from './useTypingSignal';

const MAX_LENGTH = 1000;
const MAX_INPUT_HEIGHT_PX = 120;

const PICKERS = { none: null, media: 'media', sound: 'sound' };

const ToolButton = ({ label, active, disabled, onClick, buttonRef, children }) => (
  <button
    ref={buttonRef}
    type='button'
    aria-label={label}
    aria-pressed={active}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
      'disabled:pointer-events-none disabled:opacity-40',
      active
        ? 'bg-foreground/10 text-foreground'
        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
    )}
  >
    {children}
  </button>
);

/**
 * Message input with GIF + soundboard pickers.
 * Enter sends, Shift+Enter inserts a newline; the textarea grows up to a few lines.
 */
const ChatComposer = ({
  disabled,
  focusRequest,
  onSendText,
  onSendMedia,
  onSendSound,
  onTypingStart,
  onTypingStop,
}) => {
  const [draft, setDraft] = useState('');
  const [openPicker, setOpenPicker] = useState(PICKERS.none);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const mediaButtonRef = useRef(null);
  const soundButtonRef = useRef(null);
  const { notifyTyping, stopTyping } = useTypingSignal({ onTypingStart, onTypingStop, disabled });

  const canSend = !disabled && draft.trim().length > 0;

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
  }, [draft]);

  useEffect(() => {
    if (focusRequest && !disabled) inputRef.current?.focus();
  }, [focusRequest, disabled]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSendText(text);
    setDraft('');
    stopTyping();
  }, [draft, disabled, onSendText, stopTyping]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        send();
      }
    },
    [send]
  );

  const handleChange = useCallback(
    (event) => {
      setDraft(event.target.value);
      notifyTyping();
    },
    [notifyTyping]
  );

  const togglePicker = useCallback((picker) => {
    setOpenPicker((current) => (current === picker ? PICKERS.none : picker));
  }, []);

  const closePicker = useCallback(() => setOpenPicker(PICKERS.none), []);

  const handleMediaSelect = useCallback(
    (url) => {
      closePicker();
      onSendMedia(url);
    },
    [closePicker, onSendMedia]
  );

  const handleSoundSelect = useCallback(
    (sound) => {
      closePicker();
      onSendSound(sound);
    },
    [closePicker, onSendSound]
  );

  return (
    <div ref={containerRef} className='shrink-0 px-3 pb-3'>
      <div className='flex items-end gap-1 rounded-2xl border border-border/40 bg-background/60 p-1 transition-colors focus-within:border-border'>
        <ToolButton
          label='GIFs, clips & stickers'
          buttonRef={mediaButtonRef}
          active={openPicker === PICKERS.media}
          disabled={disabled}
          onClick={() => togglePicker(PICKERS.media)}
        >
          <ImageIcon className='h-4 w-4' />
        </ToolButton>
        <ToolButton
          label='Soundboard'
          buttonRef={soundButtonRef}
          active={openPicker === PICKERS.sound}
          disabled={disabled}
          onClick={() => togglePicker(PICKERS.sound)}
        >
          <Volume2 className='h-4 w-4' />
        </ToolButton>

        <label htmlFor='group-chat-input' className='sr-only'>
          Message the group
        </label>
        <textarea
          id='group-chat-input'
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          placeholder={disabled ? 'Chat is locked' : 'Message the group…'}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          className='max-h-[120px] min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground/50 disabled:opacity-50'
        />

        <button
          type='button'
          onClick={send}
          disabled={!canSend}
          aria-label='Send message'
          className={cn(
            'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all',
            canSend ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/40'
          )}
        >
          <SendHorizontal className='h-4 w-4' />
        </button>
      </div>

      <AnimatePresence>
        {openPicker === PICKERS.media && (
          <MediaPicker
            anchorRef={containerRef}
            toggleRef={mediaButtonRef}
            onSelect={handleMediaSelect}
            onClose={closePicker}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {openPicker === PICKERS.sound && (
          <SoundPicker
            anchorRef={containerRef}
            toggleRef={soundButtonRef}
            onSelect={handleSoundSelect}
            onClose={closePicker}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(ChatComposer);
