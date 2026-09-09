import { memo, useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageCircle,
  Send,
  Lock,
  Sparkles,
  Play,
  ListMusic,
  SkipForward,
  UserPlus,
  UserMinus,
  Music,
  Image as ImageIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import UpgradeDialog from '@/components/UpgradeDialog';
import SoundPicker from './SoundPicker';
import SoundMessage from './SoundMessage';
import MediaPicker from './MediaPicker';

const EMOJI_ONLY_REGEX =
  /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\s*(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)){0,2}$/u;

const isEmojiOnly = (text) => {
  if (!text || text.length > 20) return false;
  return EMOJI_ONLY_REGEX.test(text.trim());
};

const isGifMessage = (msg) => msg.messageType === 'gif' && msg.gifUrl;
const isSoundMessage = (msg) => msg.messageType === 'sound' || Boolean(msg.soundUrl);

const ACTIVITY_MAP = {
  'now playing': {
    Icon: Play,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/15',
  },
  queue: {
    Icon: ListMusic,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-500/15',
  },
  skipped: {
    Icon: SkipForward,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-500/15',
  },
  joined: {
    Icon: UserPlus,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/15',
  },
  left: {
    Icon: UserMinus,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-500/15',
  },
  'queue ended': {
    Icon: Music,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-500/15',
  },
};

const getActivityMeta = (message) => {
  const lower = message?.toLowerCase() || '';
  for (const [keyword, meta] of Object.entries(ACTIVITY_MAP)) {
    if (lower.includes(keyword)) return meta;
  }
  return {
    Icon: MessageCircle,
    color: 'text-muted-foreground/50',
    bg: 'bg-muted/20',
    border: 'border-border/10',
  };
};

const ActivityMessage = memo(({ msg }) => {
  const meta = useMemo(() => getActivityMeta(msg.message), [msg.message]);
  const IconComponent = meta.Icon;

  return (
    <div className='flex justify-center py-1.5'>
      <div
        className={cn(
          'inline-flex items-center gap-1.5 text-[10.5px] px-3 py-1 rounded-full',
          'border backdrop-blur-sm',
          meta.bg,
          meta.border
        )}
      >
        <IconComponent className={cn('h-3 w-3 shrink-0', meta.color)} />
        <span className='text-muted-foreground/60 leading-none truncate max-w-[280px]'>
          {msg.message}
        </span>
      </div>
    </div>
  );
});

const isVideoMedia = (url) => {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
};

const GifContent = memo(({ url }) => {
  const isVideo = isVideoMedia(url);
  return (
    <div className='overflow-hidden rounded-xl max-w-[240px]'>
      {isVideo ? (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          className='w-full h-auto rounded-xl object-cover block shadow-xs'
          style={{ maxHeight: 220, minHeight: 60, background: 'hsl(var(--muted) / 0.3)' }}
        />
      ) : (
        <img
          src={url}
          alt='Media'
          loading='lazy'
          className='w-full h-auto rounded-xl object-contain block'
          style={{ maxHeight: 220, minHeight: 60, background: 'hsl(var(--muted) / 0.15)' }}
        />
      )}
    </div>
  );
});

const ChatMessage = memo(({ msg, isOwn, showAvatar, isNew }) => {
  const emojiOnly = useMemo(() => isEmojiOnly(msg.message), [msg.message]);
  const gifMsg = isGifMessage(msg);
  const soundMsg = isSoundMessage(msg);

  const content = (
    <div
      className={cn(
        'flex gap-2 px-1',
        isOwn ? 'justify-end' : 'justify-start',
        showAvatar ? 'mt-3' : 'mt-[3px]'
      )}
    >
      {!isOwn && (
        <div className='w-7 shrink-0 self-end'>
          {showAvatar ? (
            <Avatar className='h-7 w-7 ring-1 ring-border/20 shadow-sm'>
              <AvatarImage src={msg.profilePic} />
              <AvatarFallback className='text-[10px] bg-accent/50 font-medium'>
                {msg.userName?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          'max-w-[78%] relative',
          emojiOnly || gifMsg
            ? ''
            : isOwn
              ? 'liquid-message-own rounded-[18px] rounded-br-[6px] px-3 py-1.5'
              : 'liquid-message-other rounded-[18px] rounded-bl-[6px] px-3 py-1.5'
        )}
      >
        {!isOwn && showAvatar && (
          <p className='text-[10px] font-semibold mb-1 text-muted-foreground/45 leading-none'>
            {msg.userName}
          </p>
        )}
        {soundMsg ? (
          <SoundMessage msg={msg} isOwn={isOwn} />
        ) : gifMsg ? (
          <GifContent url={msg.gifUrl} />
        ) : emojiOnly ? (
          <p className='text-[40px] leading-[1.1] select-none'>{msg.message}</p>
        ) : (
          <p className='text-[13px] leading-[1.5] break-words whitespace-pre-wrap'>{msg.message}</p>
        )}
      </div>
    </div>
  );

  if (isNew) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
});

const EmptyState = memo(() => (
  <div className='h-full flex flex-col items-center justify-center text-center p-8 gap-3 min-h-[160px]'>
    <div className='p-3.5 rounded-2xl liquid-badge'>
      <MessageCircle className='h-5 w-5 text-muted-foreground/25' />
    </div>
    <div className='space-y-1'>
      <p className='text-xs font-medium text-muted-foreground/45'>No messages yet</p>
      <p className='text-[11px] text-muted-foreground/25'>Say something to the group!</p>
    </div>
  </div>
));

const ChatLockedOverlay = memo(({ onUpgrade }) => (
  <button
    type='button'
    aria-label='Upgrade to PRO to unlock group chat'
    className='absolute inset-0 z-10 flex flex-col items-center justify-center liquid-panel rounded-xl cursor-pointer border-0 w-full text-left'
    onClick={onUpgrade}
  >
    <div className='flex flex-col items-center gap-3.5 p-6 text-center'>
      <div className='p-3.5 rounded-2xl liquid-badge'>
        <Lock className='h-5 w-5 text-muted-foreground/60' />
      </div>
      <div className='space-y-1'>
        <p className='font-medium text-sm text-foreground'>Group Chat is a PRO feature</p>
        <p className='text-xs text-muted-foreground/50'>Tap to upgrade and chat with your group</p>
      </div>
      <span className='gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 px-4 py-2 text-sm font-medium flex items-center transition-all duration-200 hover:scale-105 active:scale-95'>
        <Sparkles className='h-3.5 w-3.5' />
        Upgrade to PRO
      </span>
    </div>
  </button>
));

const MessagesList = memo(({ messages, currentUserId, prevCount = 0 }) => {
  if (messages.length === 0) return <EmptyState />;

  return (
    <div className='p-2 space-y-px'>
      {messages.map((msg, i) => {
        if (msg.type === 'activity') {
          return <ActivityMessage key={msg.id || i} msg={msg} />;
        }
        const isOwn = String(msg.senderId) === String(currentUserId);
        const prev = messages[i - 1];
        const showAvatar =
          !isOwn &&
          (!prev || prev.type === 'activity' || String(prev.senderId) !== String(msg.senderId));
        const isNew = i >= prevCount;

        return (
          <ChatMessage
            key={msg.id || i}
            msg={msg}
            isOwn={isOwn}
            showAvatar={showAvatar}
            isNew={isNew}
          />
        );
      })}
    </div>
  );
});

const TypingDot = memo(({ delay }) => (
  <span
    className='h-[5px] w-[5px] rounded-full bg-muted-foreground/50'
    style={{ animation: `typing-dot 1s ease-in-out ${delay}s infinite` }}
  />
));

const GroupChat = ({
  messages,
  currentUserId,
  onSendMessage,
  _onSendGif,
  locked = false,
  typingUsers = {},
  onTypingStart,
  onTypingStop,
}) => {
  const inputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const inputAreaRef = useRef(null);
  const gifButtonRef = useRef(null);
  const soundButtonRef = useRef(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [sfxAutoPlay, setSfxAutoPlay] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('syncvibe_sfx_autoplay') !== 'false';
  });
  const typingTimeoutRef = useRef(null);
  const [prevCount, setPrevCount] = useState(0);
  const [currentCount, setCurrentCount] = useState(messages.length);

  if (messages.length !== currentCount) {
    setPrevCount(currentCount);
    setCurrentCount(messages.length);
  }

  const handleToggleSfxAutoPlay = useCallback(() => {
    setSfxAutoPlay((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('syncvibe_sfx_autoplay', String(next));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: messages.length <= 1 ? 'auto' : 'smooth' });
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (locked) return;
    const message = inputRef.current?.value?.trim();
    if (message) {
      onSendMessage(message);
      inputRef.current.value = '';
      onTypingStop?.();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [onSendMessage, locked, onTypingStop]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback(() => {
    if (locked) return;
    onTypingStart?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop?.();
      typingTimeoutRef.current = null;
    }, 2000);
  }, [locked, onTypingStart, onTypingStop]);

  const handleGifSelect = useCallback(
    (fullUrl) => {
      if (locked) return;
      setShowGifPicker(false);
      onSendMessage(fullUrl, 'gif');
    },
    [locked, onSendMessage]
  );

  const handleSoundSelect = useCallback(
    (sound) => {
      if (locked) return;
      setShowSoundPicker(false);
      onSendMessage(sound.url, 'sound', {
        soundUrl: sound.url,
        soundName: sound.name,
        soundId: sound.id,
      });
    },
    [locked, onSendMessage]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const typingNames = Object.values(typingUsers).filter(Boolean);

  return (
    <div
      className='rounded-2xl liquid-panel flex flex-col h-full relative'
      style={{ background: 'hsl(var(--background) / 0.95)' }}
    >
      {locked && <ChatLockedOverlay onUpgrade={() => setShowUpgrade(true)} />}

      <div className='flex items-center gap-2 px-4 py-2.5 border-b border-border/15'>
        <MessageCircle className='h-3.5 w-3.5 text-muted-foreground/35' />
        <span className='text-sm font-semibold tracking-tight'>Chat</span>

        <div className='ml-auto flex items-center gap-1.5'>
          <button
            type='button'
            onClick={handleToggleSfxAutoPlay}
            title={
              sfxAutoPlay
                ? 'Sound effects auto-play is ON (Tap to mute)'
                : 'Sound effects auto-play is OFF (Tap to enable)'
            }
            className={cn(
              'h-6 px-2 rounded-full flex items-center gap-1 text-[10px] font-medium border cursor-pointer transition-all duration-200',
              sfxAutoPlay
                ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                : 'bg-muted/40 border-border/20 text-muted-foreground/50 hover:text-foreground'
            )}
          >
            {sfxAutoPlay ? <Volume2 className='h-3 w-3' /> : <VolumeX className='h-3 w-3' />}
            <span className='hidden sm:inline'>SFX {sfxAutoPlay ? 'ON' : 'OFF'}</span>
          </button>

          {locked && <Lock className='h-3 w-3 text-muted-foreground/25' />}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className='flex-1 overflow-y-auto overscroll-contain chat-scroll-area'
        style={{ maxHeight: '300px' }}
      >
        <MessagesList
          messages={messages}
          currentUserId={currentUserId}
          prevCount={prevCount}
        />
        <div ref={bottomRef} className='h-px' />
      </div>

      <div ref={inputAreaRef} className='px-2.5 pb-2.5 pt-1.5 border-t border-border/15'>
        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className='overflow-hidden'
            >
              <div className='px-2 pb-1.5 flex items-center gap-2'>
                <div className='flex gap-[3px] items-center'>
                  <TypingDot delay={0} />
                  <TypingDot delay={0.15} />
                  <TypingDot delay={0.3} />
                </div>
                <span className='text-[11px] text-muted-foreground/35 truncate'>
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing`
                    : `${typingNames.slice(0, 2).join(', ')} are typing`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className='flex gap-1.5 items-center'>
          <motion.button
            ref={gifButtonRef}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (locked) return;
              setShowGifPicker((v) => !v);
              setShowSoundPicker(false);
            }}
            disabled={locked}
            title='GIFs, Clips & Stickers'
            className={cn(
              'shrink-0 h-9 w-9 rounded-full flex items-center justify-center cursor-pointer border-0 transition-colors duration-200',
              'hover:bg-accent/50 disabled:opacity-30 disabled:pointer-events-none',
              showGifPicker
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground/50 bg-transparent'
            )}
          >
            <ImageIcon className='h-4 w-4' />
          </motion.button>

          <motion.button
            ref={soundButtonRef}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (locked) return;
              setShowSoundPicker((v) => !v);
              setShowGifPicker(false);
            }}
            disabled={locked}
            title='Soundboard & Instant Effects'
            className={cn(
              'shrink-0 h-9 w-9 rounded-full flex items-center justify-center cursor-pointer border-0 transition-colors duration-200',
              'hover:bg-accent/50 disabled:opacity-30 disabled:pointer-events-none',
              showSoundPicker
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground/50 bg-transparent'
            )}
          >
            <Volume2 className='h-4 w-4' />
          </motion.button>

          <input
            ref={inputRef}
            placeholder={locked ? 'PRO feature' : 'Type a message...'}
            onKeyDown={handleKeyDown}
            onInput={handleInputChange}
            disabled={locked}
            className='flex-1 rounded-full h-9 px-4 text-sm liquid-input placeholder:text-muted-foreground/25 outline-none text-foreground disabled:opacity-40 transition-all duration-200'
          />

          <motion.button
            onClick={handleSend}
            disabled={locked}
            whileTap={{ scale: 0.9, transition: { duration: 0.1 } }}
            className='liquid-btn rounded-full shrink-0 h-9 w-9 cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none'
          >
            <Send className='h-3.5 w-3.5' />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showGifPicker && (
          <MediaPicker
            anchorRef={inputAreaRef}
            toggleRef={gifButtonRef}
            onSelect={handleGifSelect}
            onClose={() => setShowGifPicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSoundPicker && (
          <SoundPicker
            anchorRef={inputAreaRef}
            toggleRef={soundButtonRef}
            onSelect={handleSoundSelect}
            onClose={() => setShowSoundPicker(false)}
          />
        )}
      </AnimatePresence>

      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} feature='realtimeChat' />
    </div>
  );
};

export default memo(GroupChat);
