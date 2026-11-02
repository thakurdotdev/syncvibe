import { cn } from '@/lib/utils';
import { Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { memo } from 'react';
import { useRoomPreferences } from '../hooks/useRoomPreferences';

const PreferenceToggle = ({ active, onToggle, label, activeLabel, inactiveLabel, icons }) => {
  const [ActiveIcon, InactiveIcon] = icons;
  const Icon = active ? ActiveIcon : InactiveIcon;
  return (
    <button
      type='button'
      role='switch'
      aria-checked={active}
      aria-label={label}
      title={active ? activeLabel : inactiveLabel}
      onClick={onToggle}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors',
        active
          ? 'bg-primary/15 text-primary'
          : 'bg-foreground/[0.04] text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className='h-3.5 w-3.5' />
      {label}
    </button>
  );
};

/** One-tap chat preferences, always visible above the messages. */
const ChatToolbar = () => {
  const { sfxAutoPlay, mediaBlur, toggleSfxAutoPlay, toggleMediaBlur } = useRoomPreferences();

  return (
    <div className='flex shrink-0 items-center justify-between gap-2 border-b border-border/15 px-3 py-1.5'>
      <span className='truncate text-[11px] text-muted-foreground'>
        Hover or tap a message to react
      </span>
      <div className='flex shrink-0 items-center gap-1'>
        <PreferenceToggle
          active={sfxAutoPlay}
          onToggle={toggleSfxAutoPlay}
          label='SFX'
          activeLabel='Sound effects play automatically. Click to mute.'
          inactiveLabel='Sound effects are muted. Click to play them.'
          icons={[Volume2, VolumeX]}
        />
        <PreferenceToggle
          active={mediaBlur}
          onToggle={toggleMediaBlur}
          label='Blur'
          activeLabel='GIFs and media are blurred. Click to show them.'
          inactiveLabel='GIFs and media are visible. Click to blur them.'
          icons={[EyeOff, Eye]}
        />
      </div>
    </div>
  );
};

export default memo(ChatToolbar);
