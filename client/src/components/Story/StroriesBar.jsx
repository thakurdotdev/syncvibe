import { memo, useContext, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import axios from 'axios';
import { Context } from '@/Context/Context';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Card } from '../ui/card';
import CreateStory from './CreateStory';
import StoryViewer from './StoryViewer';
import { cn } from '@/lib/utils';

const StoriesBar = () => {
  const { user } = useContext(Context);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/story/feed`, {
        withCredentials: true,
      });

      if (response.status === 200) {
        setStories(response.data.stories || []);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryClick = (index) => {
    setSelectedUserIndex(index);
    setStoryViewerOpen(true);
  };

  if (loading) {
    return (
      <Card className='rounded-2xl border-border/80 bg-card/60 backdrop-blur-xl p-3.5 sm:p-4 shadow-xs overflow-hidden'>
        <div className='flex items-center gap-3.5 sm:gap-4 overflow-hidden'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='flex flex-col items-center gap-1.5 shrink-0 animate-pulse'>
              <div className='w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-muted/60' />
              <div className='w-12 h-2.5 rounded-md bg-muted/40' />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className='rounded-2xl border-border/80 bg-card/60 backdrop-blur-xl p-3 sm:p-4 shadow-xs overflow-hidden'>
        <ScrollArea className='w-full whitespace-nowrap'>
          <div className='flex items-center gap-3 sm:gap-4 pb-1'>
            {/* Create / Add Story */}
            <div
              className='flex flex-col items-center gap-1.5 cursor-pointer group/story shrink-0'
              onClick={() => setIsCreateStoryOpen(true)}
            >
              <div className='relative'>
                <div className='p-[2px] rounded-full ring-2 ring-primary/25 transition-transform duration-200 group-hover/story:scale-105 group-hover/story:ring-primary/60'>
                  <Avatar className='w-13 h-13 sm:w-14 sm:h-14 ring-2 ring-background'>
                    <AvatarImage src={getProfileCloudinaryUrl(user?.profilepic)} />
                    <AvatarFallback className='bg-primary/10 text-primary font-semibold'>
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className='absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground rounded-full p-1 ring-2 ring-background shadow-sm transition-transform duration-200 group-hover/story:scale-110'>
                  <Plus className='w-3.5 h-3.5 stroke-[2.5]' />
                </div>
              </div>
              <span className='text-[11px] sm:text-xs font-medium text-foreground/90 truncate w-16 text-center'>
                Your story
              </span>
            </div>

            {/* Friend Stories */}
            {stories.map((storyGroup, index) => (
              <div
                key={storyGroup.user.userid}
                className='flex flex-col items-center gap-1.5 cursor-pointer group/story shrink-0'
                onClick={() => handleStoryClick(index)}
              >
                <div
                  className={cn(
                    'rounded-full transition-transform duration-200 group-hover/story:scale-105',
                    storyGroup.hasUnviewedStories
                      ? 'p-[2.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 shadow-xs'
                      : 'p-[2px] bg-border/90'
                  )}
                >
                  <Avatar className='w-13 h-13 sm:w-14 sm:h-14 ring-2 ring-background'>
                    <AvatarImage src={getProfileCloudinaryUrl(storyGroup.user.profilepic)} />
                    <AvatarFallback className='bg-muted text-muted-foreground font-semibold'>
                      {storyGroup.user.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className='text-[11px] sm:text-xs font-medium text-foreground/80 truncate w-16 text-center group-hover/story:text-primary transition-colors'>
                  {storyGroup.user.username}
                </span>
              </div>
            ))}
          </div>
          <ScrollBar orientation='horizontal' className='h-1.5' />
        </ScrollArea>
      </Card>

      <StoryViewer
        isOpen={storyViewerOpen}
        onClose={() => {
          setStoryViewerOpen(false);
          fetchStories();
          setSelectedUserIndex(null);
        }}
        stories={stories}
        initialUserIndex={selectedUserIndex}
        setSelectedUserIndex={setSelectedUserIndex}
        onStoriesEnd={() => {
          setStoryViewerOpen(false);
          fetchStories();
        }}
      />

      <CreateStory
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onSuccess={() => fetchStories()}
      />
    </>
  );
};

export default memo(StoriesBar);
