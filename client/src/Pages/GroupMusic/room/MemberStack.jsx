import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { memo } from 'react';
import { getInitial } from '../utils/song';

const MAX_VISIBLE = 4;

/** Overlapping avatars; clicking opens the people list. */
const MemberStack = ({ members, onClick }) => {
  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - visible.length;

  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={`${members.length} people listening. Show people`}
      className='flex shrink-0 cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-foreground/5'
    >
      <span className='flex -space-x-2'>
        {visible.map((member) => (
          <Avatar
            key={member.userId}
            className={`h-7 w-7 ring-2 ring-background ${member.connected === false ? 'opacity-40' : ''}`}
          >
            <AvatarImage src={member.profilePic} />
            <AvatarFallback className='bg-accent text-[10px]'>
              {getInitial(member.userName)}
            </AvatarFallback>
          </Avatar>
        ))}
        {overflow > 0 && (
          <span className='flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-semibold ring-2 ring-background'>
            +{overflow}
          </span>
        )}
      </span>
      <span className='hidden text-xs text-muted-foreground sm:inline'>
        {members.length} listening
      </span>
    </button>
  );
};

export default memo(MemberStack);
