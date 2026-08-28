import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Headphones,
  ListMusic,
  LogOut,
  Music,
  Pause,
  Play,
  QrCode,
  Send,
  SkipForward,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { DEMO_PLAYLIST } from './demoSong';

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const REACTIONS = ['🔥', '❤️', '👏', '😍', '🎵'];

const INITIAL_MESSAGES = [
  { id: 1, sender: 'Sarah', text: 'Love this song! 🎵', isMe: false },
  { id: 2, sender: 'Alex', text: '0ms delay, syncing is so smooth 🎧', isMe: false },
];

const Hero = memo(() => {
  const audioRef = useRef(null);
  const chatScrollRef = useRef(null);
  const reactionIdRef = useRef(0);

  // Active track state
  const [songIndex, setSongIndex] = useState(0);
  const currentSong = DEMO_PLAYLIST[songIndex] || DEMO_PLAYLIST[0];

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentSong?.duration || 308);
  const [volume, setVolume] = useState(85);
  const [prevVolume, setPrevVolume] = useState(85);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Floating Reactions
  const [floatingReactions, setFloatingReactions] = useState([]);

  // Live Chat state
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState('');
  const [typingUser, setTypingUser] = useState(null);

  // Auto-scroll chat on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, typingUser]);

  // Trigger floating reaction burst
  const triggerReaction = useCallback((emoji) => {
    const id = ++reactionIdRef.current;
    const randomX = Math.floor(Math.random() * 80) - 40;
    const newReaction = { id, emoji, x: randomX };

    setFloatingReactions((prev) => [...prev.slice(-10), newReaction]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1400);
  }, []);

  const handleSendReaction = (emoji, e) => {
    if (e) e.stopPropagation();
    triggerReaction(emoji);
  };

  // Audio track switch logic
  useEffect(() => {
    if (audioRef.current && currentSong?.audioSrc) {
      audioRef.current.src = currentSong.audioSrc;
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(currentSong.duration || 308);
      if (isPlaying) {
        audioRef.current
          .play()
          .catch((err) => console.warn('Autoplay policy:', err));
      }
    }
  }, [currentSong]);

  // Simulated social activity when playing
  useEffect(() => {
    if (!isPlaying) {
      setTypingUser(null);
      return;
    }

    const interval = setInterval(() => {
      const emoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      triggerReaction(emoji);
    }, 3800);

    const t1 = setTimeout(() => {
      setTypingUser('Sarah');
    }, 2800);

    const t2 = setTimeout(() => {
      setTypingUser(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'Sarah',
          text: 'This track hits so good! ❤️',
          isMe: false,
        },
      ]);
      triggerReaction('❤️');
    }, 4800);

    const t3 = setTimeout(() => {
      setTypingUser('Alex');
    }, 10000);

    const t4 = setTimeout(() => {
      setTypingUser(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'Alex',
          text: 'Next one is in the queue! 👏',
          isMe: false,
        },
      ]);
      triggerReaction('👏');
    }, 12500);

    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isPlaying, currentSong, triggerReaction]);

  // Audio time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  // Play / Pause toggle
  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        toast.success(`Playing: ${currentSong.name}`);
      } catch (err) {
        console.warn('Audio play error:', err);
        setIsPlaying(true);
      }
    }
  };

  // Next track
  const handleSkipNext = () => {
    const nextIndex = (songIndex + 1) % DEMO_PLAYLIST.length;
    setSongIndex(nextIndex);
    setIsPlaying(true);
    toast.info(`Now playing: ${DEMO_PLAYLIST[nextIndex].name}`);
  };

  // Select track from queue
  const handleSelectSong = (index) => {
    setSongIndex(index);
    setIsPlaying(true);
    setIsQueueOpen(false);
    toast.info(`Now playing: ${DEMO_PLAYLIST[index].name}`);
  };

  // Seek bar
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, (clickX / rect.width) * duration));

    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Volume slider
  const handleVolumeChange = (e) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol / 100;
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      if (audioRef.current) audioRef.current.volume = 0;
    } else {
      const restored = prevVolume || 80;
      setVolume(restored);
      if (audioRef.current) audioRef.current.volume = restored / 100;
    }
  };

  // Copy code
  const handleCopyCode = () => {
    navigator.clipboard.writeText('798859');
    setCopiedCode(true);
    toast.success('Room code 798859 copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Send user message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: 'Pankaj Thakur',
      text: chatInput.trim(),
      isMe: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setChatInput('');

    setTimeout(() => {
      setTypingUser('Alex');
      setTimeout(() => {
        setTypingUser(null);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'Alex',
            text: 'Vibing to this! 🔥',
            isMe: false,
          },
        ]);
        triggerReaction('🔥');
      }, 1400);
    }, 800);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section className='relative pt-24 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden'>
      {/* Hidden Real HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={currentSong?.audioSrc}
        preload='metadata'
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleSkipNext}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className='max-w-6xl mx-auto text-center relative z-10'>
        {/* Top Tag */}
        <div className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary border border-border text-xs font-medium text-muted-foreground mb-8 shadow-xs'>
          <span className='h-1.5 w-1.5 rounded-full bg-primary animate-pulse' />
          <span>Real-time Group Music Sync</span>
          <span className='text-muted-foreground/60'>•</span>
          <span className='text-muted-foreground'>Low-latency audio streaming</span>
        </div>

        {/* Spacious, Grand Headline */}
        <h1 className='text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold tracking-tight text-foreground leading-[1.08] mb-6 max-w-5xl mx-auto'>
          Music is better together.
        </h1>

        {/* Spacious Subtitle */}
        <p className='text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-normal'>
          Stream music in real-time sync with friends. Hop on voice, share reactions, and build
          shared queues without delay.
        </p>

        {/* Action Buttons */}
        <div className='flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-16'>
          <Link to='/register'>
            <Button
              size='lg'
              className='h-12 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm cursor-pointer transition-all active:scale-98 shadow-lg shadow-primary/25'
            >
              <span>Get Started Free</span>
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
          </Link>
          <Link to='/download'>
            <Button
              size='lg'
              variant='outline'
              className='h-12 px-6 rounded-full border-border bg-secondary/50 hover:bg-secondary text-foreground text-sm cursor-pointer transition-all'
            >
              <Download className='mr-2 h-4 w-4 text-muted-foreground' />
              <span>Download Android App</span>
            </Button>
          </Link>
        </div>

        {/* ═══ SPACIOUS INTERACTIVE GROUP MUSIC DEMO (Full Desktop Breadth) ═══ */}
        <div className='relative max-w-5xl mx-auto text-left'>
          {/* Floating Emoji Particles Layer */}
          <div className='absolute inset-0 pointer-events-none z-50 overflow-hidden'>
            <AnimatePresence>
              {floatingReactions.map((reaction) => (
                <motion.div
                  key={reaction.id}
                  initial={{ opacity: 1, y: 240, x: 260 + reaction.x, scale: 0.8 }}
                  animate={{
                    opacity: 0,
                    y: 40,
                    x: 260 + reaction.x * 2.2,
                    scale: 1.6,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.3, ease: 'easeOut' }}
                  className='absolute text-2xl drop-shadow-lg select-none'
                >
                  {reaction.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Spacious App Container matching actual GroupMusic UI */}
          <div className='rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-2xl space-y-5'>
            {/* Top Room Header Bar */}
            <div className='flex items-center justify-between gap-3 flex-wrap pb-1'>
              <div className='flex items-center gap-2.5'>
                {/* Room Pill */}
                <div className='flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-secondary border border-border text-foreground text-xs font-semibold'>
                  <div className='w-5 h-5 rounded-lg bg-primary/15 flex items-center justify-center text-primary'>
                    <Music size={13} />
                  </div>
                  <span>Hello</span>
                  {/* Equalizer Bars */}
                  <div className='flex items-end gap-[2.5px] h-3.5 px-0.5'>
                    {[0.3, 0.8, 0.4, 0.9].map((val, idx) => (
                      <motion.span
                        key={idx}
                        className='w-[2px] rounded-full bg-amber-400'
                        animate={
                          isPlaying
                            ? { height: ['25%', '100%', '35%', '90%', '25%'] }
                            : { height: '25%' }
                        }
                        transition={{
                          duration: 0.6 + idx * 0.15,
                          repeat: Infinity,
                          repeatType: 'mirror',
                          ease: 'easeInOut',
                        }}
                        style={{ height: isPlaying ? '80%' : '25%' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Room Code Badge */}
                <button
                  type='button'
                  onClick={handleCopyCode}
                  className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 border border-border text-muted-foreground hover:text-foreground text-xs font-mono cursor-pointer transition-colors'
                  title='Click to copy room code'
                >
                  <span>798859</span>
                  {copiedCode ? (
                    <Check size={12} className='text-emerald-400' />
                  ) : (
                    <Copy size={12} className='text-muted-foreground/60' />
                  )}
                  <QrCode size={12} className='text-muted-foreground/60' />
                </button>
              </div>

              {/* Right Action Icons */}
              <div className='flex items-center gap-2 relative'>
                <div className='hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400'>
                  <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
                  <span>0ms Sync</span>
                </div>

                <button
                  type='button'
                  onClick={() => setIsQueueOpen((prev) => !prev)}
                  className='flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs font-medium cursor-pointer transition-colors'
                >
                  <ListMusic size={14} className='text-muted-foreground' />
                  <span>Queue</span>
                  <span className='px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground font-bold text-[10px]'>
                    {DEMO_PLAYLIST.length}
                  </span>
                </button>

                <div
                  onClick={() => toast.info('Direct friend invite link ready to share!')}
                  className='w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
                  title='Invite friends'
                >
                  <UserPlus size={14} />
                </div>
                <div
                  onClick={() => toast.info('Interactive preview room')}
                  className='w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
                  title='Leave room'
                >
                  <LogOut size={14} />
                </div>

                {/* Queue Dropdown */}
                <AnimatePresence>
                  {isQueueOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className='absolute right-0 top-11 w-80 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 overflow-hidden flex flex-col'
                    >
                      <div className='flex items-center justify-between text-xs px-4 py-3 border-b border-border bg-secondary shrink-0'>
                        <span className='font-semibold text-foreground'>
                          Room Queue ({DEMO_PLAYLIST.length})
                        </span>
                        <button
                          type='button'
                          className='p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                          onClick={() => setIsQueueOpen(false)}
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <div className='overflow-y-auto max-h-64 p-2 space-y-1'>
                        {DEMO_PLAYLIST.map((item, idx) => {
                          const isCurrent = idx === songIndex;
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectSong(idx)}
                              className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isCurrent
                                  ? 'bg-primary/15 text-foreground font-medium border border-primary/30'
                                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                              }`}
                            >
                              <div className='w-9 h-9 rounded-lg overflow-hidden bg-muted shrink-0'>
                                <img
                                  src={item.cover}
                                  alt={item.name}
                                  className='w-full h-full object-cover'
                                />
                              </div>
                              <div className='min-w-0 flex-1'>
                                <div className='truncate text-foreground text-xs'>{item.name}</div>
                                <div className='text-[10.5px] text-muted-foreground truncate'>
                                  {item.artists}
                                </div>
                              </div>
                              <span className='text-[10px] font-mono shrink-0'>
                                {isCurrent ? (
                                  <span className='text-primary font-semibold'>Playing</span>
                                ) : (
                                  <span className='text-muted-foreground/80'>+{item.votes}</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Now Playing Deck (Spacious) */}
            <div className='rounded-2xl border border-border/80 bg-secondary/40 p-5 sm:p-6 space-y-5'>
              <div className='flex items-start gap-5'>
                <div className='relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden ring-1 ring-border shrink-0 bg-muted shadow-md'>
                  <img
                    src={currentSong?.cover}
                    alt={currentSong?.name}
                    className='w-full h-full object-cover'
                  />
                  {isPlaying && (
                    <div className='absolute bottom-0 inset-x-0 h-7 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1.5'>
                      <div className='flex items-end gap-[3px] h-3'>
                        {[0, 1, 2, 3].map((i) => (
                          <motion.span
                            key={i}
                            className='w-[2.5px] bg-primary rounded-full'
                            animate={{ height: ['25%', '100%', '40%', '90%', '25%'] }}
                            transition={{
                              duration: 0.5 + i * 0.12,
                              repeat: Infinity,
                              repeatType: 'mirror',
                              ease: 'easeInOut',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className='min-w-0 space-y-1.5 flex-1 pt-1'>
                  <h3 className='text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight truncate'>
                    {currentSong?.name}
                  </h3>
                  <div className='flex items-center gap-2 text-xs sm:text-sm text-muted-foreground truncate'>
                    <span className='text-foreground/90'>{currentSong?.artists}</span>
                    <span className='text-muted-foreground/40'>•</span>
                    <span className='text-foreground/70 font-medium'>Pankaj Thakur</span>
                  </div>
                  <p className='text-xs text-muted-foreground/60 truncate'>{currentSong?.album}</p>
                </div>
              </div>

              {/* Progress Scrubber Bar */}
              <div className='space-y-1.5'>
                <div
                  className='relative w-full h-2.5 bg-muted rounded-full cursor-pointer overflow-hidden group'
                  onClick={handleSeek}
                >
                  <motion.div
                    className='h-full bg-primary rounded-full relative'
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className='absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary-foreground ring-2 ring-primary opacity-0 group-hover:opacity-100 transition-opacity' />
                  </motion.div>
                </div>
                <div className='flex justify-between text-xs font-mono text-muted-foreground'>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls Row (Spacious) */}
              <div className='flex items-center justify-between pt-1 gap-3 flex-wrap'>
                <div className='flex items-center gap-3'>
                  {/* Animated Interactive Play/Pause Button */}
                  <div className='relative flex items-center justify-center'>
                    {!isPlaying && (
                      <span className='absolute -inset-1 rounded-full bg-primary/40 animate-ping pointer-events-none' />
                    )}
                    <motion.button
                      type='button'
                      whileTap={{ scale: 0.92 }}
                      onClick={togglePlayPause}
                      className={`relative z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-md ${
                        isPlaying
                          ? 'bg-secondary hover:bg-secondary/80 text-foreground'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/30 ring-2 ring-primary/50'
                      }`}
                      title={isPlaying ? 'Pause playback' : 'Click to Play live interactive demo'}
                    >
                      {isPlaying ? (
                        <Pause size={16} className='fill-current' />
                      ) : (
                        <Play size={16} className='fill-current ml-0.5' />
                      )}
                    </motion.button>
                  </div>

                  {/* Next */}
                  <button
                    type='button'
                    onClick={handleSkipNext}
                    className='w-9 h-9 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors active:scale-95'
                    title='Next track'
                  >
                    <SkipForward size={16} />
                  </button>

                  <div className='h-5 w-px bg-border mx-1 hidden sm:block' />

                  {/* Reaction Emojis */}
                  <div className='flex items-center gap-1 text-base select-none'>
                    {REACTIONS.map((emoji, idx) => (
                      <motion.button
                        key={idx}
                        type='button'
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={(e) => handleSendReaction(emoji, e)}
                        className='cursor-pointer p-1.5 rounded-lg hover:bg-muted transition-colors'
                        title={`Send ${emoji}`}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Right: Queue & Volume */}
                <div className='flex items-center gap-4'>
                  <div
                    onClick={() => setIsQueueOpen((prev) => !prev)}
                    className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium cursor-pointer transition-colors border border-border/50'
                  >
                    <span className='text-xs'>≡ Queue</span>
                    <span className='px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground font-bold text-[10px]'>
                      {DEMO_PLAYLIST.length}
                    </span>
                  </div>

                  <div className='flex items-center gap-2.5 text-muted-foreground'>
                    <button
                      type='button'
                      onClick={toggleMute}
                      className='cursor-pointer hover:text-foreground'
                    >
                      {volume === 0 ? (
                        <VolumeX size={16} className='text-muted-foreground/60' />
                      ) : (
                        <Volume2 size={16} />
                      )}
                    </button>
                    <input
                      type='range'
                      min='0'
                      max='100'
                      value={volume}
                      onChange={handleVolumeChange}
                      className='w-20 sm:w-24 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary'
                      title={`Volume: ${volume}%`}
                    />
                  </div>
                </div>
              </div>

              {/* Listening count */}
              <div className='flex items-center gap-2 text-xs text-muted-foreground pt-1'>
                <Headphones size={14} />
                <span>3 listening in sync</span>
              </div>
            </div>

            {/* Bottom Split: Chat & Listeners (Spacious 12-col grid) */}
            <div className='grid grid-cols-1 md:grid-cols-12 gap-4'>
              {/* Chat Panel (8 cols) */}
              <div className='md:col-span-8 rounded-2xl border border-border/80 bg-secondary/30 p-4 space-y-3.5 flex flex-col justify-between min-h-[180px]'>
                <div className='flex items-center justify-between text-xs text-foreground'>
                  <span className='font-semibold flex items-center gap-2'>
                    <span>💬</span>
                    <span>Chat</span>
                  </span>
                  <div className='flex items-center gap-2'>
                    {typingUser && (
                      <span className='text-[11px] text-emerald-400 font-mono'>
                        {typingUser} is typing...
                      </span>
                    )}
                    <span className='px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono'>
                      SFX ON
                    </span>
                  </div>
                </div>

                {/* Chat stream */}
                <div ref={chatScrollRef} className='space-y-2 max-h-36 overflow-y-auto pr-1'>
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`px-3.5 py-2 rounded-xl text-xs max-w-[85%] ${
                            msg.isMe
                              ? 'bg-primary/15 border border-primary/30 text-foreground'
                              : 'bg-secondary border border-border text-muted-foreground'
                          }`}
                        >
                          {!msg.isMe && (
                            <span className='text-[10px] text-muted-foreground/60 block font-mono mb-0.5'>
                              {msg.sender}
                            </span>
                          )}
                          <span>{msg.text}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Chat input */}
                <form onSubmit={handleSendMessage} className='flex items-center gap-2 pt-1'>
                  <input
                    type='text'
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder='Type a message and hit Enter...'
                    className='flex-1 px-3.5 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50'
                  />
                  <button
                    type='submit'
                    className='w-8 h-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-colors cursor-pointer shrink-0'
                    title='Send message'
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>

              {/* Listeners Panel (4 cols) */}
              <div className='md:col-span-4 rounded-2xl border border-border/80 bg-secondary/30 p-4 space-y-3.5'>
                <div className='flex items-center justify-between text-xs text-muted-foreground'>
                  <span className='font-semibold text-foreground flex items-center gap-1.5'>
                    <Users size={13} />
                    Listeners
                  </span>
                  <span className='text-[11px] font-mono text-emerald-400'>● Live 3/10</span>
                </div>

                <div className='space-y-2'>
                  {/* Pankaj Thakur */}
                  <div className='flex items-center gap-3 p-2 rounded-xl bg-secondary/60 border border-border/50'>
                    <div className='relative w-8 h-8 rounded-full bg-muted ring-1 ring-border overflow-hidden shrink-0'>
                      <img
                        src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg'
                        alt='Host'
                        className='w-full h-full object-cover'
                      />
                      <div className='absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-1.5'>
                        <span className='text-xs font-semibold text-foreground truncate'>
                          Pankaj Thakur
                        </span>
                        <span className='text-[10px] text-muted-foreground'>You</span>
                      </div>
                      <div className='text-[10px] text-amber-400 font-medium'>👑 Creator</div>
                    </div>
                  </div>

                  {/* Alex Rivera */}
                  <div className='flex items-center gap-3 p-2 rounded-xl bg-secondary/40 border border-border/30'>
                    <div className='w-8 h-8 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0'>
                      A
                    </div>
                    <div className='min-w-0 flex-1'>
                      <span className='text-xs font-medium text-foreground truncate block'>
                        Alex Rivera
                      </span>
                      <span className='text-[10px] text-emerald-400 font-mono'>Synced • 0ms</span>
                    </div>
                  </div>

                  {/* Sarah */}
                  <div className='flex items-center gap-3 p-2 rounded-xl bg-secondary/40 border border-border/30'>
                    <div className='w-8 h-8 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0'>
                      S
                    </div>
                    <div className='min-w-0 flex-1'>
                      <span className='text-xs font-medium text-foreground truncate block'>
                        Sarah
                      </span>
                      <span className='text-[10px] text-emerald-400 font-mono'>Synced • 0ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

Hero.displayName = 'Hero';
export default Hero;
