import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Headphones,
  LogOut,
  Music,
  Pause,
  Play,
  Search,
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

const INITIAL_MESSAGES = [
  { id: 1, sender: 'Sarah', text: 'Love this song! 🎵', isMe: false },
  { id: 2, sender: 'Pankaj Thakur', text: 'Hello everyone, enjoy the vibes!', isMe: true },
];

const EMOJIS = ['🔥', '❤️', '👏', '😍', '🎵'];

const Hero = memo(() => {
  const audioRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Playlist & Active Song State
  const [songIndex, setSongIndex] = useState(0);
  const currentSong = DEMO_PLAYLIST[songIndex] || DEMO_PLAYLIST[0];

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentSong?.duration || 308);
  const [volume, setVolume] = useState(80);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Floating Reactions State
  const [floatingReactions, setFloatingReactions] = useState([]);
  const reactionIdRef = useRef(0);

  // Live Chat & Typing State
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState('');
  const [typingUser, setTypingUser] = useState(null);

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, typingUser]);

  // Spawn animated floating emoji burst
  const triggerReaction = useCallback((emoji) => {
    const id = ++reactionIdRef.current;
    const randomX = Math.floor(Math.random() * 80) - 40;
    const newReaction = { id, emoji, x: randomX };

    setFloatingReactions((prev) => [...prev.slice(-15), newReaction]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1400);
  }, []);

  // User manually sends a reaction
  const handleSendReaction = (emoji, e) => {
    if (e) e.stopPropagation();
    triggerReaction(emoji);
  };

  // When song changes, update audio src and auto-play if active
  useEffect(() => {
    if (audioRef.current && currentSong?.audioSrc) {
      audioRef.current.src = currentSong.audioSrc;
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(currentSong.duration || 308);
      if (isPlaying) {
        audioRef.current
          .play()
          .catch((e) => console.warn('Auto-playback on track change policy:', e));
      }
    }
  }, [currentSong, isPlaying]);

  // Automated Social Simulation when song is playing (reactions + typing + listener comments)
  useEffect(() => {
    if (!isPlaying) {
      setTypingUser(null);
      return;
    }

    // 1. Periodic automated emoji reaction bursts
    const reactionInterval = setInterval(() => {
      const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      triggerReaction(randomEmoji);
    }, 3200);

    // 2. Sequential social chat simulation
    const timer1 = setTimeout(() => {
      setTypingUser('Sarah');
    }, 2500);

    const timer2 = setTimeout(() => {
      setTypingUser(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 10,
          sender: 'Sarah',
          text: 'This track hits so good! ❤️',
          isMe: false,
        },
      ]);
      triggerReaction('❤️');
    }, 4500);

    const timer3 = setTimeout(() => {
      setTypingUser('Alex');
    }, 9000);

    const timer4 = setTimeout(() => {
      setTypingUser(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 20,
          sender: 'Alex',
          text: '0ms delay, syncing is so smooth 🎧',
          isMe: false,
        },
      ]);
      triggerReaction('🔥');
    }, 11500);

    const timer5 = setTimeout(() => {
      setTypingUser('Sarah');
    }, 17000);

    const timer6 = setTimeout(() => {
      setTypingUser(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 30,
          sender: 'Sarah',
          text: 'Queue the next one in the list! 👏',
          isMe: false,
        },
      ]);
      triggerReaction('👏');
    }, 19500);

    return () => {
      clearInterval(reactionInterval);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      clearTimeout(timer6);
    };
  }, [isPlaying, currentSong, triggerReaction]);

  // Sync audio time & duration
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  // Handle Play/Pause toggle with real HTML5 audio
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
        console.warn('Audio play policy:', err);
        setIsPlaying(true);
      }
    }
  };

  // Handle track skip
  const handleSkipNext = () => {
    const nextIndex = (songIndex + 1) % DEMO_PLAYLIST.length;
    setSongIndex(nextIndex);
    setIsPlaying(true);
    toast.info(`Now playing: ${DEMO_PLAYLIST[nextIndex].name}`);
  };

  // Handle selecting song from queue
  const handleSelectSong = (index) => {
    setSongIndex(index);
    setIsPlaying(true);
    setIsQueueOpen(false);
    toast.info(`Now playing: ${DEMO_PLAYLIST[index].name}`);
  };

  // Handle seeking
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, (clickX / rect.width) * duration));

    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol / 100;
    }
  };

  // Send user chat message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'Pankaj Thakur',
      text: chatInput.trim(),
      isMe: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    // Simulated quick response
    setTimeout(() => {
      setTypingUser('Alex');
      setTimeout(() => {
        setTypingUser(null);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'Alex',
            text: 'Loving this session! 🔥',
            isMe: false,
          },
        ]);
        triggerReaction('🔥');
      }, 1500);
    }, 1000);
  };

  // Copy room code
  const handleCopyCode = () => {
    navigator.clipboard.writeText('267477');
    setCopiedCode(true);
    toast.success('Room code 267477 copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section className='relative pt-24 sm:pt-28 pb-16 px-4 sm:px-6 overflow-hidden'>
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

      {/* Ambient Lighting */}
      <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/[0.03] rounded-full blur-[100px] pointer-events-none' />

      <div className='max-w-5xl mx-auto text-center relative z-10'>
        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-medium text-zinc-300 backdrop-blur-md mb-8 hover:border-zinc-700 transition-colors cursor-default'
        >
          <span className='flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse' />
          <span>Real-time Group Music Sync</span>
          <span className='text-zinc-600'>•</span>
          <span className='text-zinc-400'>Low-latency audio streaming</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className='text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6 max-w-3xl mx-auto'
        >
          Music is better{' '}
          <span className='bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent'>
            together.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className='text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed font-normal'
        >
          Stream music in real-time sync with friends. Hop on voice, share video reactions, and
          build shared queues without delay.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className='flex flex-col sm:flex-row items-center justify-center gap-3 mb-10'
        >
          <Link to='/register'>
            <Button
              size='lg'
              className='h-11 px-6 rounded-full bg-white text-black hover:bg-zinc-200 font-medium text-xs sm:text-sm cursor-pointer transition-all active:scale-98 shadow-sm'
            >
              <span>Get Started Free</span>
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
          </Link>
          <Link to='/download'>
            <Button
              size='lg'
              variant='outline'
              className='h-11 px-5 rounded-full border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs sm:text-sm cursor-pointer transition-all'
            >
              <Download className='mr-2 h-3.5 w-3.5 text-zinc-400' />
              <span>Download Android App</span>
            </Button>
          </Link>
        </motion.div>

        {/* Interactive Helper Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className='flex items-center justify-center mb-4'
        >
          <div className='inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11.5px] text-zinc-300 backdrop-blur-md shadow-sm'>
            <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
            <span className='font-medium text-white'>Live Interactive Demo</span>
            <span className='text-zinc-600'>•</span>
            <span className='text-zinc-400'>Tap Play, Reactions, or Queue to test</span>
          </div>
        </motion.div>

        {/* Interactive Group Music Product UI Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className='relative max-w-4xl mx-auto'
        >
          {/* Floating Emoji Particles Layer */}
          <div className='absolute inset-0 pointer-events-none z-50 overflow-hidden'>
            <AnimatePresence>
              {floatingReactions.map((reaction) => (
                <motion.div
                  key={reaction.id}
                  initial={{ opacity: 1, y: 320, x: 280 + reaction.x, scale: 0.7 }}
                  animate={{
                    opacity: 0,
                    y: 100,
                    x: 280 + reaction.x * 2.2,
                    scale: 1.6,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  className='absolute text-2xl drop-shadow-lg select-none'
                >
                  {reaction.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className='rounded-2xl border border-zinc-800/90 bg-[#121214] p-4 sm:p-5 shadow-2xl text-left space-y-3.5 relative overflow-hidden'>
            {/* Top Room Header Bar */}
            <div className='flex items-center justify-between gap-2 flex-wrap relative z-20'>
              <div className='flex items-center gap-2'>
                <div className='flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-semibold'>
                  <div className='w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300'>
                    <Music size={13} />
                  </div>
                  <span>Bollywood 90s Magic 🎬</span>
                  {/* Animated Sound Wave Equalizer */}
                  <div className='flex items-end gap-[2px] h-3.5 px-0.5'>
                    {[0.3, 0.7, 0.4, 0.9].map((val, idx) => (
                      <motion.span
                        key={idx}
                        className='w-[2.5px] rounded-full bg-amber-400'
                        animate={
                          isPlaying
                            ? {
                                height: ['25%', '100%', '40%', '85%', '25%'],
                              }
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

                <button
                  type='button'
                  onClick={handleCopyCode}
                  className='flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono cursor-pointer transition-colors'
                  title='Click to copy room code'
                >
                  <span>267477</span>
                  {copiedCode ? (
                    <Check size={11} className='text-emerald-400' />
                  ) : (
                    <Copy size={11} className='text-zinc-500' />
                  )}
                </button>
              </div>

              <div className='flex items-center gap-1.5 relative'>
                {/* Interactive Queue Button */}
                <button
                  type='button'
                  onClick={() => setIsQueueOpen((prev) => !prev)}
                  className='flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium cursor-pointer transition-colors'
                >
                  <Search size={12} className='text-zinc-400' />
                  <span>Queue</span>
                  <span className='px-1.5 py-0.2 rounded-full bg-white text-black font-bold text-[10px]'>
                    {DEMO_PLAYLIST.length}
                  </span>
                </button>

                <div
                  onClick={() => toast.info('Direct friend invite link ready to share!')}
                  className='w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 cursor-pointer hover:bg-zinc-800 transition-colors'
                  title='Invite friends'
                >
                  <UserPlus size={13} />
                </div>
                <div
                  onClick={() => toast.info('Interactive preview session')}
                  className='w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 cursor-pointer hover:bg-zinc-800 transition-colors'
                  title='Leave room'
                >
                  <LogOut size={13} />
                </div>

                {/* Interactive Queue Dropdown */}
                <AnimatePresence>
                  {isQueueOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className='absolute right-0 top-11 w-72 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl z-50 overflow-hidden flex flex-col'
                    >
                      {/* Fixed Non-Scrolling Header */}
                      <div className='flex items-center justify-between text-xs px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0'>
                        <span className='font-semibold text-white'>
                          Room Queue ({DEMO_PLAYLIST.length})
                        </span>
                        <button
                          type='button'
                          className='p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer'
                          onClick={() => setIsQueueOpen(false)}
                        >
                          <X size={13} />
                        </button>
                      </div>

                      {/* Scrollable Song List Container */}
                      <div className='overflow-y-auto max-h-64 p-2 space-y-1'>
                        {DEMO_PLAYLIST.map((item, idx) => {
                          const isCurrent = idx === songIndex;
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectSong(idx)}
                              className={`p-2 rounded-lg text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                                isCurrent
                                  ? 'bg-zinc-900 text-white font-medium border border-zinc-700/80'
                                  : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                              }`}
                            >
                              <div className='w-8 h-8 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-white/5'>
                                <img
                                  src={item.cover}
                                  alt={item.name}
                                  className='w-full h-full object-cover'
                                />
                              </div>
                              <div className='min-w-0 flex-1'>
                                <div className='truncate text-white text-[11.5px]'>{item.name}</div>
                                <div className='text-[10px] text-zinc-500 truncate'>
                                  {item.artists}
                                </div>
                              </div>
                              <span className='text-[10px] font-mono shrink-0'>
                                {isCurrent ? (
                                  <span className='text-emerald-400 font-semibold'>Playing</span>
                                ) : (
                                  <span className='text-zinc-400'>+{item.votes}</span>
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

            {/* Main NowPlayingCard */}
            <div className='rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5 space-y-3.5 relative z-10'>
              <div className='flex items-start gap-4'>
                <motion.div
                  animate={isPlaying ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className='relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden ring-1 ring-zinc-800 shrink-0 bg-neutral-900 shadow-xl'
                >
                  <img
                    src={currentSong?.cover}
                    alt={currentSong?.name}
                    className='w-full h-full object-cover'
                  />
                </motion.div>
                <div className='min-w-0 space-y-1'>
                  <h3 className='text-base sm:text-xl font-bold text-white truncate'>
                    {currentSong?.name}
                  </h3>
                  <div className='flex items-center gap-1.5 text-xs text-zinc-400 truncate'>
                    <span>{currentSong?.artists}</span>
                    <span className='text-zinc-600'>•</span>
                    <span className='text-zinc-300 font-medium'>Pankaj Thakur</span>
                  </div>
                  <p className='text-xs text-zinc-500 truncate'>{currentSong?.album}</p>
                </div>
              </div>

              {/* Scrubber */}
              <div className='space-y-1'>
                <div
                  className='relative w-full h-2 bg-zinc-800 rounded-full cursor-pointer overflow-hidden group'
                  onClick={handleSeek}
                >
                  <motion.div
                    className='h-full bg-white rounded-full relative'
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className='absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-black opacity-0 group-hover:opacity-100 transition-opacity' />
                  </motion.div>
                </div>
                <div className='flex justify-between text-[11px] font-mono text-zinc-500'>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls Bar */}
              <div className='flex items-center justify-between pt-1 gap-2 flex-wrap'>
                <div className='flex items-center gap-2'>
                  {/* Play / Pause Toggle Button */}
                  <button
                    type='button'
                    onClick={togglePlayPause}
                    className='w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm'
                    title={isPlaying ? 'Pause playback' : 'Play music'}
                  >
                    {isPlaying ? (
                      <Pause size={13} className='fill-black text-black' />
                    ) : (
                      <Play size={13} className='fill-black text-black ml-0.5' />
                    )}
                  </button>

                  <button
                    type='button'
                    onClick={handleSkipNext}
                    className='w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors active:scale-95'
                    title='Skip to next track'
                  >
                    <SkipForward size={13} />
                  </button>

                  {/* Interactive Emoji Reactions Bar */}
                  <div className='flex items-center gap-1.5 pl-2 text-sm select-none'>
                    {EMOJIS.map((emoji, idx) => (
                      <motion.button
                        key={idx}
                        type='button'
                        whileHover={{ scale: 1.3 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={(e) => handleSendReaction(emoji, e)}
                        className='cursor-pointer p-1 rounded-md hover:bg-zinc-800/80 transition-colors'
                        title={`Send ${emoji} reaction`}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <div
                    onClick={() => setIsQueueOpen((prev) => !prev)}
                    className='flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer transition-colors'
                  >
                    <span className='font-mono text-xs'>≡ Queue</span>
                    <span className='px-1.5 py-0.2 rounded-full bg-white text-black font-bold text-[10px]'>
                      {DEMO_PLAYLIST.length}
                    </span>
                  </div>

                  {/* Interactive Volume Control */}
                  <div className='flex items-center gap-2 text-zinc-400'>
                    {volume === 0 ? (
                      <VolumeX size={14} className='text-zinc-500' />
                    ) : (
                      <Volume2 size={14} />
                    )}
                    <input
                      type='range'
                      min='0'
                      max='100'
                      value={volume}
                      onChange={handleVolumeChange}
                      className='w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white'
                      title={`Volume: ${volume}%`}
                    />
                  </div>
                </div>
              </div>

              <div className='flex items-center gap-1.5 text-xs text-zinc-500 pt-1'>
                <Headphones size={13} />
                <span>3 listening in sync</span>
              </div>
            </div>

            {/* Bottom Split Row: Chat & Listeners */}
            <div className='grid grid-cols-1 md:grid-cols-12 gap-3.5'>
              {/* Interactive Chat Panel (8 Cols) */}
              <div className='md:col-span-8 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 space-y-3 flex flex-col justify-between'>
                <div className='flex items-center justify-between text-xs text-zinc-300'>
                  <span className='font-semibold'>💬 Live Room Chat</span>
                  {typingUser && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className='flex items-center gap-1 text-[11px] text-emerald-400 font-mono'
                    >
                      <span>{typingUser} is typing</span>
                      <span className='flex items-center gap-0.5'>
                        <span className='w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]' />
                        <span className='w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]' />
                        <span className='w-1 h-1 bg-emerald-400 rounded-full animate-bounce' />
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Chat Message Stream */}
                <div ref={chatScrollRef} className='space-y-2 max-h-28 overflow-y-auto pr-1'>
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`px-3 py-1.5 rounded-xl text-xs max-w-[85%] ${
                            msg.isMe
                              ? 'bg-zinc-800 text-white'
                              : 'bg-zinc-900/90 border border-zinc-800 text-zinc-300'
                          }`}
                        >
                          {!msg.isMe && (
                            <span className='text-[10px] text-zinc-500 block font-mono'>
                              {msg.sender}
                            </span>
                          )}
                          <span>{msg.text}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Chat Form */}
                <form onSubmit={handleSendMessage} className='flex items-center gap-2 pt-1'>
                  <input
                    type='text'
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder='Type a message and hit Enter...'
                    className='flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700'
                  />
                  <button
                    type='submit'
                    className='w-7 h-7 rounded-lg bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0'
                    title='Send message'
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>

              {/* Listeners Panel (4 Cols) */}
              <div className='md:col-span-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 space-y-3'>
                <div className='flex items-center justify-between text-xs text-zinc-400'>
                  <span className='font-semibold text-zinc-300 flex items-center gap-1'>
                    <Users size={12} />
                    Listeners
                  </span>
                  <span className='text-[11px] font-mono text-emerald-400'>● Live 3/10</span>
                </div>

                <div className='space-y-1.5'>
                  <div className='flex items-center gap-2.5 p-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50'>
                    <div className='relative w-7 h-7 rounded-full bg-zinc-800 ring-1 ring-zinc-700 overflow-hidden shrink-0'>
                      <img
                        src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg'
                        alt='Host'
                        className='w-full h-full object-cover'
                      />
                      <div className='absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-1'>
                        <span className='text-xs font-semibold text-white truncate'>
                          Pankaj Thakur
                        </span>
                        <span className='text-[10px] text-zinc-400'>You</span>
                      </div>
                      <div className='text-[10px] text-amber-400 font-medium'>👑 Creator</div>
                    </div>
                  </div>

                  <div className='flex items-center gap-2.5 p-1.5 rounded-xl bg-zinc-900/40 border border-zinc-800/30'>
                    <div className='w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-bold flex items-center justify-center shrink-0'>
                      A
                    </div>
                    <div className='min-w-0 flex-1'>
                      <span className='text-xs font-medium text-zinc-300 truncate block'>
                        Alex Rivera
                      </span>
                      <span className='text-[9.5px] text-emerald-400 font-mono'>Synced • 0ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

Hero.displayName = 'Hero';
export default Hero;
