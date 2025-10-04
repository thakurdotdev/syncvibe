import React, { useContext, useEffect, useState } from 'react';
import ChatWithUser from './ChatWithUser';
import SearchUser from './SearchUser';
import { ChatContext } from '../../Context/ChatContext';
import { Context } from '../../Context/Context';
import { useLocation, useNavigate } from 'react-router-dom';
import DotPattern from '../ui/dot-pattern';
import { cn } from '@/lib/utils';

const Chat = () => {
  const { user } = useContext(Context);
  const {
    users,
    setUsers,
    setLoading,
    onlineStatuses,
    loading,
    currentChat,
    setCurrentChat,
    socket,
    getAllExistingChats,
  } = useContext(ChatContext);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();
  const navigate = useNavigate();

  const notificationChatData = location.state?.chatData;

  useEffect(() => {
    if (notificationChatData) {
      const findChat = users.find((user) => user?.chatid === notificationChatData?.chatid);
      setCurrentChat(findChat);
      navigate('/chat', { replace: true });
    }
  }, [notificationChatData, users, navigate]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const usersWithStatus = users.map((user) => ({
    ...user,
    isOnline: onlineStatuses[user.otherUser.userid] || false,
  }));

  if (isMobile) {
    return (
      <div className='relative'>
        {currentChat ? (
          <ChatWithUser
            setCurrentChat={setCurrentChat}
            currentChat={currentChat}
            loggedInUserId={user?.userid}
            socket={socket}
          />
        ) : (
          <SearchUser
            users={usersWithStatus}
            setCurrentChat={setCurrentChat}
            setLoading={setLoading}
            loading={loading}
            socket={socket}
          />
        )}
      </div>
    );
  }

  return (
    <div className='flex mx-auto'>
      <div className='w-[30%]'>
        <SearchUser
          setUsers={setUsers}
          users={usersWithStatus}
          setLoading={setLoading}
          loading={loading}
          setCurrentChat={setCurrentChat}
          getAllExistingChats={getAllExistingChats}
          socket={socket}
        />
      </div>
      <div className='w-[70%]'>
        <ChatWithUser
          setCurrentChat={setCurrentChat}
          currentChat={currentChat}
          loggedInUserId={user?.userid}
          socket={socket}
        />
      </div>
    </div>
  );
};

export default Chat;
