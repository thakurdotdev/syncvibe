import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import axios from 'axios';
import { LucideX, Search, UserX, MessageSquarePlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';

const ChatListSkeleton = () => (
  <div className='space-y-1 p-1'>
    {[...Array(7)].map((_, i) => (
      <div key={i} className='flex items-center gap-3 px-3 py-2.5 rounded-md'>
        <div className='relative shrink-0'>
          <Skeleton className='w-11 h-11 rounded-full' />
        </div>
        <div className='flex-1 min-w-0 space-y-2'>
          <div className='flex items-center justify-between'>
            <Skeleton className='h-3.5 w-28 rounded-xs' />
            <Skeleton className='h-3 w-8 rounded-xs' />
          </div>
          <Skeleton className='h-3 w-40 rounded-xs' />
        </div>
      </div>
    ))}
  </div>
);

const SearchUser = ({
  users,
  loading,
  setLoading,
  setCurrentChat,
  getAllExistingChats,
  socket,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newUsers, setNewUsers] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const initialLoad = useRef(true);
  const location = useLocation();
  const navigate = useNavigate();
  const messageUserId = location.state?.recieverid;

  useEffect(() => {
    if (!messageUserId) return;

    const user = users.find((user) => user.otherUser?.userid === messageUserId);

    if (user) {
      setCurrentChat(user);
      setActiveTab(user.otherUser?.userid);
    } else {
      createChat(messageUserId);
    }

    navigate('/chat', { replace: true });
  }, [messageUserId, users, setCurrentChat]);

  const searchUsers = useCallback(async () => {
    if (searchQuery.trim() === '') {
      setNewUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/user/search?name=${searchQuery}`,
        { withCredentials: true }
      );
      setNewUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching filtered users:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, setLoading]);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    const delayDebounceFn = setTimeout(searchUsers, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchUsers]);

  const createChat = useCallback(
    async (userid) => {
      try {
        setLoading(true);
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/create/chat`,
          { receiverid: userid },
          { withCredentials: true }
        );

        if (response.status === 200) {
          setCurrentChat(response.data.chat);
          socket?.emit('join-room', response.data.chat.chatid);
          await getAllExistingChats();
          setNewUsers([]);
          setSearchQuery('');
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Error creating chat');
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setCurrentChat, socket, getAllExistingChats]
  );

  const clearSearch = () => {
    setSearchQuery('');
    setNewUsers([]);
  };

  const handleSelectChat = (user, isSearchResult = false) => {
    if (isSearchResult) {
      createChat(user.userid);
    } else {
      setCurrentChat(user);
      setActiveTab(user.otherUser?.userid);
    }
  };

  const renderUserItem = useCallback(
    (user, isSearchResult = false) => {
      const otherUser = isSearchResult ? user : user.otherUser;
      const isSelected = activeTab === otherUser?.userid;

      return (
        <div
          key={user.userid || otherUser?.userid}
          role='button'
          tabIndex={0}
          onClick={() => handleSelectChat(user, isSearchResult)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectChat(user, isSearchResult);
            }
          }}
          className={`group flex items-center px-3 py-2.5 rounded-md cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            isSelected
              ? 'bg-accent/80 dark:bg-accent/60 text-accent-foreground font-medium'
              : 'hover:bg-muted/70 dark:hover:bg-muted/50 text-foreground'
          }`}
        >
          <Avatar className='relative shrink-0 w-11 h-11 ring-1 ring-border/40 group-hover:ring-border/80'>
            <AvatarImage
              src={getProfileCloudinaryUrl(otherUser?.profilepic)}
              alt={otherUser?.name || 'User'}
              className='w-11 h-11 object-cover rounded-full'
            />
            <AvatarFallback className='w-11 h-11 rounded-full font-semibold text-xs bg-muted'>
              {otherUser?.name?.[0] || 'U'}
            </AvatarFallback>
            {!isSearchResult && (
              <span
                title={user.isOnline ? 'Online' : 'Offline'}
                className={`absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
                  user.isOnline ? 'bg-green-500' : 'bg-muted-foreground/30'
                }`}
              />
            )}
          </Avatar>

          <div className='flex flex-col ml-3 flex-1 min-w-0'>
            <div className='flex items-center justify-between gap-1.5'>
              <span
                className={`text-sm truncate ${
                  isSelected
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-foreground/90 group-hover:text-foreground'
                }`}
              >
                {otherUser?.name}
              </span>
              {!isSearchResult && user.unreadCount > 0 && (
                <Badge
                  variant='default'
                  className='h-4 min-w-4 px-1.5 text-[10px] font-bold rounded-full shrink-0'
                >
                  {user.unreadCount}
                </Badge>
              )}
            </div>

            {!isSearchResult && user.isTyping ? (
              <span className='text-xs text-green-500 font-medium animate-pulse'>Typing...</span>
            ) : !isSearchResult ? (
              <p className='text-xs text-muted-foreground group-hover:text-foreground/75 truncate'>
                {user?.lastmessage || 'No messages yet'}
              </p>
            ) : (
              <p className='text-xs text-muted-foreground group-hover:text-foreground/75 truncate'>
                @{otherUser?.username || 'user'}
              </p>
            )}
          </div>
        </div>
      );
    },
    [activeTab, createChat, setCurrentChat]
  );

  return (
    <Card className='flex flex-col h-[calc(100vh-60px)] p-2 gap-2.5 rounded-none border-r border-border bg-card shadow-none'>
      <div className='relative flex items-center px-1 pt-1'>
        <Search className='absolute left-3.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
        <Input
          placeholder='Search people...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='w-full pl-8 pr-8 py-1.5 text-xs rounded-md bg-muted/40 hover:bg-muted/60 focus-visible:bg-background transition-colors'
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            aria-label='Clear search'
            className='absolute right-2.5 p-1 rounded text-muted-foreground hover:text-foreground transition-colors'
          >
            <LucideX className='w-3.5 h-3.5' />
          </button>
        )}
      </div>

      <ScrollArea className='flex-1 w-full'>
        {loading ? (
          <ChatListSkeleton />
        ) : searchQuery.trim() !== '' ? (
          newUsers.length > 0 ? (
            <div className='space-y-0.5 p-1'>
              {newUsers.map((user) => renderUserItem(user, true))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center p-8 text-center gap-2 text-muted-foreground'>
              <UserX className='w-8 h-8 stroke-1 text-muted-foreground/60' />
              <p className='text-sm font-medium'>No users found</p>
              <p className='text-xs text-muted-foreground/80'>
                Try searching with a different name
              </p>
            </div>
          )
        ) : users.length > 0 ? (
          <div className='space-y-0.5 p-1'>{users.map((user) => renderUserItem(user))}</div>
        ) : (
          <div className='flex flex-col items-center justify-center p-8 text-center gap-3 text-muted-foreground h-[60vh]'>
            <div className='p-3.5 rounded-full bg-muted/60'>
              <MessageSquarePlus className='w-7 h-7 text-muted-foreground/80' />
            </div>
            <div className='space-y-1'>
              <p className='text-sm font-semibold text-foreground'>No conversations yet</p>
              <p className='text-xs text-muted-foreground max-w-[200px]'>
                Search above to find friends and start chatting.
              </p>
            </div>
          </div>
        )}
        <ScrollBar className='ml-1' />
      </ScrollArea>
    </Card>
  );
};

export default SearchUser;
