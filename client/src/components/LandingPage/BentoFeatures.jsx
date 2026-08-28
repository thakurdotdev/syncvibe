import { memo } from 'react';
import {
  MessageSquare,
  Music,
  Radio,
  Share2,
  Smartphone,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';

const BentoFeatures = memo(() => {
  return (
    <section id='features' className='py-20 px-4 sm:px-6 relative border-t border-border/60'>
      <div className='max-w-5xl mx-auto'>
        {/* Section Header */}
        <div className='text-center max-w-lg mx-auto mb-14 space-y-2.5'>
          <span className='text-xs font-mono font-medium text-primary uppercase tracking-widest'>
            Capabilities
          </span>
          <h2 className='text-2xl sm:text-4xl font-bold text-foreground tracking-tight'>
            Built for seamless listening.
          </h2>
          <p className='text-xs sm:text-sm text-muted-foreground leading-relaxed font-normal'>
            Everything needed to discover, stream, and share music with your circle.
          </p>
        </div>

        {/* Bento Grid */}
        <div className='grid grid-cols-1 md:grid-cols-12 gap-4'>
          {/* Card 1: Large Sync Engine (7 Cols) */}
          <div className='md:col-span-7 rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-7 flex flex-col justify-between hover:border-primary/40 transition-colors'>
            <div className='space-y-2.5'>
              <div className='w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary'>
                <Radio size={16} />
              </div>
              <h3 className='text-lg sm:text-xl font-semibold text-foreground tracking-tight'>
                Synchronized playback engine
              </h3>
              <p className='text-xs text-muted-foreground leading-relaxed font-normal max-w-md'>
                Continuous WebSocket timestamp alignment ensures every member in the room hears the
                exact same millisecond.
              </p>
            </div>

            <div className='mt-6 p-3.5 rounded-xl bg-secondary/60 border border-border space-y-2.5'>
              <div className='flex items-center justify-between text-[11px] text-muted-foreground font-mono'>
                <span className='text-foreground'>Room Master Clock</span>
                <span className='text-emerald-400'>● Active Sync (0ms)</span>
              </div>
              <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
                <div className='h-full w-3/4 bg-primary rounded-full' />
              </div>
            </div>
          </div>

          {/* Card 2: Video & Voice (5 Cols) */}
          <div className='md:col-span-5 rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-7 flex flex-col justify-between hover:border-primary/40 transition-colors'>
            <div className='space-y-2.5'>
              <div className='w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary'>
                <Video size={16} />
              </div>
              <h3 className='text-lg sm:text-xl font-semibold text-foreground tracking-tight'>
                Video & Voice Channels
              </h3>
              <p className='text-xs text-muted-foreground leading-relaxed font-normal'>
                Join live room video or mic channels without pausing or interrupting the music
                stream.
              </p>
            </div>

            <div className='mt-6 grid grid-cols-2 gap-2'>
              <div className='p-3 rounded-xl bg-secondary/60 border border-border/50 flex flex-col items-center justify-center space-y-1.5 h-22'>
                <div className='w-7 h-7 rounded-full bg-muted ring-1 ring-primary/40 text-foreground text-xs font-bold flex items-center justify-center'>
                  P
                </div>
                <span className='text-[10.5px] text-muted-foreground font-medium'>Pankaj</span>
              </div>
              <div className='p-3 rounded-xl bg-secondary/60 border border-border/50 flex flex-col items-center justify-center space-y-1.5 h-22'>
                <div className='w-7 h-7 rounded-full bg-muted ring-1 ring-border text-foreground text-xs font-bold flex items-center justify-center'>
                  A
                </div>
                <span className='text-[10.5px] text-muted-foreground font-medium'>Alex</span>
              </div>
            </div>
          </div>

          {/* Card 3: Real-Time Direct Invites (4 Cols) */}
          <div className='md:col-span-4 rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors'>
            <div className='space-y-2.5'>
              <div className='w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary'>
                <UserPlus size={16} />
              </div>
              <h3 className='text-base font-semibold text-foreground tracking-tight'>
                Direct Real-time Invites
              </h3>
              <p className='text-xs text-muted-foreground leading-relaxed font-normal'>
                Send 1-click in-app invites directly to online friends for instant room joining.
              </p>
            </div>
            <div className='mt-5 p-2 rounded-lg bg-secondary/60 border border-border flex items-center justify-between text-xs'>
              <span className='text-foreground truncate'>Alex is online</span>
              <span className='text-primary font-mono text-[10.5px] font-medium'>Invite Sent</span>
            </div>
          </div>

          {/* Card 4: Collaborative Queue (4 Cols) */}
          <div className='md:col-span-4 rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors'>
            <div className='space-y-2.5'>
              <div className='w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary'>
                <Music size={16} />
              </div>
              <h3 className='text-base font-semibold text-foreground tracking-tight'>
                Collaborative Queue
              </h3>
              <p className='text-xs text-muted-foreground leading-relaxed font-normal'>
                Democratic voting allows anyone in the room to add tracks and vote for what plays
                next.
              </p>
            </div>
            <div className='mt-5 space-y-1.5'>
              <div className='flex items-center justify-between p-2 rounded-lg bg-secondary/60 text-xs text-foreground border border-border'>
                <span className='truncate'>1. Main Agar Kahoon</span>
                <span className='text-primary font-mono text-[10px] font-semibold'>+5</span>
              </div>
            </div>
          </div>

          {/* Card 5: Android & Web (4 Cols) */}
          <div className='md:col-span-4 rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors'>
            <div className='space-y-2.5'>
              <div className='w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary'>
                <Smartphone size={16} />
              </div>
              <h3 className='text-base font-semibold text-foreground tracking-tight'>
                Android & Web
              </h3>
              <p className='text-xs text-muted-foreground leading-relaxed font-normal'>
                Seamlessly move between desktop browser and mobile app without disconnecting from
                the room.
              </p>
            </div>
            <div className='mt-5 p-2 rounded-lg bg-secondary/60 text-xs text-muted-foreground font-mono text-[11px] border border-border flex items-center justify-between'>
              <span>Background audio</span>
              <span className='text-emerald-400 text-[10px]'>Active</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

BentoFeatures.displayName = 'BentoFeatures';
export default BentoFeatures;
