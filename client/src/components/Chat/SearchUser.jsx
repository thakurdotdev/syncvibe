import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import axios from 'axios';
import { LucideX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Loader2 } from 'lucide-react';

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
      setNewUsers(response.data.users);
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

    const delayDebounceFn = setTimeout(searchUsers, 800);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchUsers]);

  const createChat = useCallback(
    async (userid) => {
      try {
        setLoading(true);
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/create/chat`,
          { recieverid: userid },
          { withCredentials: true }
        );

        if (response.status === 200) {
          setCurrentChat(response.data.chat);
          socket.emit('join-room', response.data.chat.chatid);
          await getAllExistingChats();
          setNewUsers([]);
          setSearchQuery('');
        }
      } catch (error) {
        toast.error(error.response.data.message);
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

  const renderUserItem = useCallback(
    (user, isSearchResult = false) => (
      <Card
        key={user.userid || user.otherUser?.userid}
        onClick={() => {
          isSearchResult ? createChat(user.userid) : setCurrentChat(user);
          setActiveTab(user.otherUser?.userid);
        }}
        className={`flex items-center p-2 rounded-md hover:bg-accent/50 hover:shadow-lg border-0 cursor-pointer ${
          activeTab === user.otherUser?.userid ? 'bg-gray-100 dark:bg-gray-800' : ''
        }`}
      >
        <Avatar className='relative'>
          <AvatarImage
            src={getProfileCloudinaryUrl(
              isSearchResult ? user.profilepic : user.otherUser?.profilepic
            )}
            alt={isSearchResult ? user.name : user.otherUser?.name}
            className='w-12 h-12 rounded-full'
          />
          <AvatarFallback className='w-12 h-12 rounded-full'>
            {isSearchResult ? user.name[0] : user.otherUser?.name[0]}
          </AvatarFallback>
          {!isSearchResult && (
            <span
              title={user.isOnline ? 'online' : 'offline'}
              className={`absolute right-1 bottom-1 w-3 h-3 rounded-full ${
                user.isOnline ? 'bg-green-500' : ''
              }`}
            />
          )}
        </Avatar>
        <div className='flex flex-col ml-4'>
          <div className='flex items-center space-x-2'>
            <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              {isSearchResult ? user.name : user.otherUser?.name}
            </span>
          </div>
          {!isSearchResult && user.isTyping ? (
            <span className='text-xs text-green-500 font-semibold'>Typing...</span>
          ) : (
            !isSearchResult && (
              <p className='text-xs text-gray-500 dark:text-gray-400 line-clamp-1'>
                {user?.lastmessage}
              </p>
            )
          )}
        </div>
      </Card>
    ),
    [activeTab, createChat, setCurrentChat]
  );

  return (
    <Card className='flex flex-col h-[calc(100vh-60px)] p-2 py-3 gap-4 rounded-none'>
      <div className='flex items-center relative'>
        <Input
          placeholder='Search for a user...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='w-full p-3 px-5 rounded-full shadow-sm'
        />
        {searchQuery && (
          <button onClick={clearSearch} className='absolute right-2'>
            <LucideX className='text-gray-400 dark:text-gray-500' />
          </button>
        )}
      </div>

      {loading && (
        <div className='flex items-center justify-center mt-3'>
          <Loader2 className='w-8 h-8 animate-spin' />
        </div>
      )}

      <div className='p-2'>
        {newUsers.length > 0 ? (
          <>
            <ScrollArea className='h-[85vh] w-full'>
              <div className='grid gap-2'>{newUsers.map((user) => renderUserItem(user, true))}</div>
              <ScrollBar className='ml-1' />
            </ScrollArea>
          </>
        ) : (
          users.length > 0 &&
          !loading && (
            <ScrollArea className='h-[85vh] w-full'>
              <div className='grid gap-2 mb-5'>{users.map((user) => renderUserItem(user))}</div>
              <ScrollBar className='ml-1' />
            </ScrollArea>
          )
        )}
        {users.length === 0 && !loading && (
          <p className='text-gray-500 dark:text-gray-400'>No users found.</p>
        )}
      </div>
    </Card>
  );
};

export default SearchUser;
