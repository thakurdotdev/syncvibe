import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { memo, useState } from 'react';
import { isVideoUrl } from './chatUtils';

const MEDIA_STYLE = { maxHeight: 220, minHeight: 60 };

/** GIF / clip / sticker message with a per-item blur toggle that follows the global preference. */
const MediaMessage = ({ url, globalBlur }) => {
  const [blurred, setBlurred] = useState(globalBlur);
  const [previousGlobalBlur, setPreviousGlobalBlur] = useState(globalBlur);

  // When the room-wide preference changes, it overrides any per-item choice.
  if (globalBlur !== previousGlobalBlur) {
    setPreviousGlobalBlur(globalBlur);
    setBlurred(globalBlur);
  }

  const mediaClassName = cn(
    'block h-auto w-full rounded-xl bg-muted/30 transition-[filter] duration-300',
    blurred && 'blur-xl'
  );

  return (
    <div className='group/media relative max-w-[240px] overflow-hidden rounded-xl'>
      {isVideoUrl(url) ? (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          className={cn(mediaClassName, 'object-cover')}
          style={MEDIA_STYLE}
        />
      ) : (
        <img
          src={url}
          alt='Shared media'
          loading='lazy'
          className={cn(mediaClassName, 'object-contain')}
          style={MEDIA_STYLE}
        />
      )}
      <button
        type='button'
        onClick={() => setBlurred((value) => !value)}
        aria-label={blurred ? 'Show media' : 'Hide media'}
        className={cn(
          'absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl transition-opacity duration-200',
          blurred
            ? 'bg-scrim/30 opacity-100'
            : 'opacity-0 focus-visible:opacity-100 group-hover/media:opacity-100'
        )}
      >
        <span className='inline-flex items-center gap-1.5 rounded-full bg-scrim/50 px-3 py-1.5 text-[11px] font-medium text-on-scrim backdrop-blur-md'>
          {blurred ? <Eye className='h-3 w-3' /> : <EyeOff className='h-3 w-3' />}
          {blurred ? 'Show' : 'Hide'}
        </span>
      </button>
    </div>
  );
};

export default memo(MediaMessage);
