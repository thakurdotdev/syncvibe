import { ArrowLeft, Video } from 'lucide-react';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

/** `onCall` is null while a call is already going on. */
const ChatHeader = ({ peer, online, typing, onBack, onOpenProfile, onCall }) => (
  <Card className='sticky top-0 z-10 flex w-full flex-row items-center gap-3 rounded-none border-b p-3 shadow-xs'>
    {onBack && (
      <Button
        onClick={onBack}
        variant='ghost'
        size='icon'
        className='rounded-full'
        aria-label='Back to conversations'
      >
        <ArrowLeft size={20} />
      </Button>
    )}

    <button
      type='button'
      className='flex min-w-0 cursor-pointer items-center gap-3 text-left'
      onClick={onOpenProfile}
    >
      <Avatar className='relative h-11 w-11'>
        <AvatarImage alt='' src={getProfileCloudinaryUrl(peer?.profilepic)} />
        <AvatarFallback>{peer?.name?.[0] || 'U'}</AvatarFallback>
        {online && (
          <span className='absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-card bg-foreground' />
        )}
      </Avatar>

      <div className='flex min-w-0 flex-col justify-center'>
        <div className='truncate text-base font-medium text-foreground'>{peer?.name}</div>
        <div className='h-4 text-xs text-muted-foreground' aria-live='polite'>
          {typing ? (
            <span className='font-medium text-foreground'>typing…</span>
          ) : online ? (
            'Online'
          ) : null}
        </div>
      </div>
    </button>

    <div className='ml-auto flex items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-11 w-11 rounded-full'
            aria-label={`Video call ${peer?.name}`}
            disabled={!onCall}
            onClick={onCall}
          >
            <Video size={20} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Video call</TooltipContent>
      </Tooltip>
    </div>
  </Card>
);

export default ChatHeader;
