import he from 'he';
import { Heart } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { useIsLiked, useToggleLike } from '@/hooks/useLikes';
import { cn } from '@/lib/utils';

/** A heart that likes the song: it lands in Liked songs and shapes what's recommended. */
const LikeButton = memo(function LikeButton({ song, className, size = 'icon' }) {
  const liked = useIsLiked(song?.id);
  const toggle = useToggleLike();
  if (!song?.id) return null;
  const name = he.decode(song.name || '');

  return (
    <Button
      type='button'
      variant='ghost'
      size={size}
      aria-pressed={liked}
      aria-label={liked ? `Remove ${name} from Liked songs` : `Like ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        toggle(song, !liked);
      }}
      className={cn(
        'h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground',
        liked && 'text-foreground',
        className
      )}
    >
      <Heart
        className={cn('h-[18px] w-[18px] transition-transform duration-150', liked && 'scale-110')}
        fill={liked ? 'currentColor' : 'none'}
      />
    </Button>
  );
});

export default LikeButton;
