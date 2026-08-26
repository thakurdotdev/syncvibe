import { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  Battery,
  BatteryCharging,
  Bell,
  ChevronLeft,
  Copy,
  Download,
  MoreVertical,
  Music,
  Pause,
  Play,
  PlayCircle,
  Repeat,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  UserPlus,
  Users,
  Volume2,
  Wifi,
} from 'lucide-react';
import { Button } from '../ui/button';
import { DEMO_SONG } from './demoSong';

const MobileShowcase = memo(() => {
  return (
    <section id='download' className='py-24 px-4 sm:px-6 relative border-t border-zinc-800/60'>
      <div className='max-w-5xl mx-auto'>
        <div className='rounded-3xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/40 via-zinc-950/60 to-zinc-950/90 backdrop-blur-2xl p-7 sm:p-12 overflow-hidden relative shadow-2xl'>
          {/* Ambient Lighting */}
          <div className='absolute top-1/3 right-1/4 w-80 h-80 bg-white/[0.02] rounded-full blur-[100px] pointer-events-none' />

          <div className='grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center'>
            {/* Left Content Column */}
            <div className='lg:col-span-7 space-y-6 text-left'>
              <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300'>
                <Smartphone size={13} className='text-zinc-400' />
                <span>SyncVibe for Android</span>
              </div>

              <h2 className='text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight'>
                The full SyncVibe experience on your phone.
              </h2>

              <p className='text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal max-w-lg'>
                Engineered for native background audio, system media notification controls, and
                instant room invite alerts.
              </p>

              {/* 4 Feature Benefit Items */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1'>
                <div className='space-y-1'>
                  <div className='flex items-center gap-2 text-xs font-semibold text-white'>
                    <PlayCircle size={14} className='text-zinc-400 shrink-0' />
                    <span>Background Playback</span>
                  </div>
                  <p className='text-[11.5px] text-zinc-500 leading-normal pl-5'>
                    Stream while using other apps or with your screen locked.
                  </p>
                </div>

                <div className='space-y-1'>
                  <div className='flex items-center gap-2 text-xs font-semibold text-white'>
                    <Bell size={14} className='text-zinc-400 shrink-0' />
                    <span>Instant Push Alerts</span>
                  </div>
                  <p className='text-[11.5px] text-zinc-500 leading-normal pl-5'>
                    Get notified the moment your friends start a session.
                  </p>
                </div>

                <div className='space-y-1'>
                  <div className='flex items-center gap-2 text-xs font-semibold text-white'>
                    <Wifi size={14} className='text-zinc-400 shrink-0' />
                    <span>Low Data & Latency</span>
                  </div>
                  <p className='text-[11.5px] text-zinc-500 leading-normal pl-5'>
                    Optimized WebSocket stream for 4G/5G mobile networks.
                  </p>
                </div>

                <div className='space-y-1'>
                  <div className='flex items-center gap-2 text-xs font-semibold text-white'>
                    <BatteryCharging size={14} className='text-zinc-400 shrink-0' />
                    <span>Battery Efficient</span>
                  </div>
                  <p className='text-[11.5px] text-zinc-500 leading-normal pl-5'>
                    Native audio pipeline designed to conserve battery.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className='pt-3 flex flex-wrap items-center gap-3'>
                <a
                  href={`${import.meta.env.VITE_API_URL}/api/app-update/download`}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <Button
                    size='lg'
                    className='h-11 px-6 rounded-full bg-white text-black hover:bg-zinc-200 font-semibold text-xs cursor-pointer shadow-sm transition-all active:scale-98'
                  >
                    <Download className='mr-2 h-4 w-4' />
                    <span>Download APK</span>
                  </Button>
                </a>
                <Link to='/download'>
                  <Button
                    size='lg'
                    variant='outline'
                    className='h-11 px-5 rounded-full border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs cursor-pointer transition-all'
                  >
                    <span>Releases & Checksums</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Realistic Slim Phone Mockup */}
            <div className='lg:col-span-5 flex justify-center'>
              <div className='relative w-[280px] sm:w-[300px] h-[580px] rounded-[44px] p-[8px] bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.12)] ring-1 ring-black'>
                {/* Physical Hardware Buttons */}
                <div className='absolute -left-[10px] top-24 w-[3px] h-9 bg-zinc-700 rounded-l-sm' />
                <div className='absolute -left-[10px] top-36 w-[3px] h-12 bg-zinc-700 rounded-l-sm' />
                <div className='absolute -right-[10px] top-28 w-[3px] h-14 bg-zinc-700 rounded-r-sm' />

                {/* Inner Screen Display */}
                <div className='w-full h-full rounded-[36px] bg-[#0c0c0e] overflow-hidden flex flex-col justify-between p-4 relative border border-white/5 text-left select-none'>
                  {/* Punch Hole Camera */}
                  <div className='w-3 h-3 rounded-full bg-black ring-1 ring-zinc-800/80 absolute top-3 left-1/2 -translate-x-1/2 z-30' />

                  {/* Android Status Bar */}
                  <div className='flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-0.5 px-2 relative z-20'>
                    <span className='font-semibold text-white'>9:41</span>
                    <div className='flex items-center gap-1.5 text-zinc-400'>
                      <span className='text-[10px]'>5G</span>
                      <Wifi size={11} />
                      <Battery size={13} className='text-white fill-white' />
                    </div>
                  </div>

                  {/* Room App Header */}
                  <div className='flex items-center justify-between pt-1'>
                    <div className='flex items-center gap-1.5 min-w-0'>
                      <ChevronLeft size={16} className='text-zinc-400' />
                      <div className='flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-white'>
                        <Music size={10} className='text-zinc-400' />
                        <span className='truncate max-w-[90px]'>Lets have fun</span>
                        <span className='text-amber-400 font-mono text-[9px]'>ılı</span>
                      </div>
                    </div>
                    <div className='flex items-center gap-1.5'>
                      <div className='px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400'>
                        267477
                      </div>
                      <UserPlus size={14} className='text-zinc-400' />
                    </div>
                  </div>

                  {/* High-Res Album Artwork with Glow */}
                  <div className='relative my-auto py-2'>
                    <div className='w-48 h-48 sm:w-52 sm:h-52 rounded-2xl overflow-hidden mx-auto shadow-2xl border border-white/10 ring-1 ring-black bg-zinc-900'>
                      <img
                        src={DEMO_SONG?.cover || DEMO_SONG?.image?.[2]?.link || ''}
                        alt={DEMO_SONG?.name || 'Track'}
                        className='w-full h-full object-cover'
                      />
                    </div>
                  </div>

                  {/* Track Info & Scrubber */}
                  <div className='space-y-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0 space-y-0.5'>
                        <h4 className='text-sm font-bold text-white truncate'>
                          {DEMO_SONG?.name || 'Main Agar Kahoon'}
                        </h4>
                        <p className='text-[11px] text-zinc-400 truncate'>
                          {DEMO_SONG?.artists || 'Sonu Nigam, Shreya Ghoshal'}
                        </p>
                      </div>
                      <Share2 size={15} className='text-zinc-400 shrink-0 mt-1' />
                    </div>

                    {/* Scrubber Bar */}
                    <div className='space-y-1'>
                      <div className='relative w-full h-1 bg-zinc-800 rounded-full overflow-hidden'>
                        <div className='h-full w-1/3 bg-white rounded-full relative'>
                          <div className='absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white ring-2 ring-black' />
                        </div>
                      </div>
                      <div className='flex justify-between text-[9px] font-mono text-zinc-500'>
                        <span>1:42</span>
                        <span>5:08</span>
                      </div>
                    </div>

                    {/* Media Controls Bar */}
                    <div className='flex items-center justify-between px-1'>
                      <Shuffle size={14} className='text-zinc-500' />
                      <SkipBack size={16} className='text-zinc-300' />
                      <div className='w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg shadow-white/10'>
                        <Pause size={16} className='fill-black' />
                      </div>
                      <SkipForward size={16} className='text-zinc-300' />
                      <Repeat size={14} className='text-zinc-500' />
                    </div>

                    {/* Room Live Listeners Badge */}
                    <div className='flex items-center justify-between p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80'>
                      <div className='flex items-center gap-1.5'>
                        <div className='flex -space-x-1.5'>
                          <div className='w-5 h-5 rounded-full bg-zinc-700 border border-black text-[9px] font-bold flex items-center justify-center text-white'>
                            P
                          </div>
                          <div className='w-5 h-5 rounded-full bg-zinc-600 border border-black text-[9px] font-bold flex items-center justify-center text-white'>
                            A
                          </div>
                          <div className='w-5 h-5 rounded-full bg-zinc-500 border border-black text-[9px] font-bold flex items-center justify-center text-white'>
                            S
                          </div>
                        </div>
                        <span className='text-[10px] text-zinc-300 font-medium'>4 in sync</span>
                      </div>
                      <span className='text-[9.5px] font-mono text-emerald-400'>● 0ms delta</span>
                    </div>
                  </div>

                  {/* Android Bottom Home Gesture Bar */}
                  <div className='w-24 h-1 bg-white/30 rounded-full mx-auto mt-1' />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

MobileShowcase.displayName = 'MobileShowcase';
export default MobileShowcase;
