import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';

const StoryCircle = ({ user, hasStory, viewed, onClick }) => {
  return (
    <div className='flex flex-col items-center gap-1 cursor-pointer' onClick={onClick}>
      <div
        className={cn(
          'p-[2px] rounded-full',
          hasStory && !viewed && 'bg-linear-to-tr from-foreground to-foreground',
          hasStory && viewed && 'bg-secondary dark:bg-raised'
        )}
      >
        <div className='bg-card p-[2px] rounded-full'>
          <Avatar className='w-14 h-14'>
            <AvatarImage src={user.profilepic} alt={user.username} />
            <AvatarFallback>{user.username[0]}</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <span className='text-xs truncate w-16 text-center'>{user.username}</span>
    </div>
  );
};

export default StoryCircle;
