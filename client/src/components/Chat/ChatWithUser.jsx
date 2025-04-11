import { useIsMobile } from "@/hooks/use-mobile";
import {
  getOptimizedImageUrl,
  getProfileCloudinaryUrl,
} from "@/Utils/Cloudinary";
import data from "@emoji-mart/data";
import EmojiPicker from "@emoji-mart/react";
import axios from "axios";
import {
  ArrowLeft,
  Check,
  Copy,
  Edit,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Paperclip,
  SendHorizontal,
  Smile,
  Trash,
  X,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChatContext } from "../../Context/ChatContext";
import { Context } from "../../Context/Context";
import { getAllMessages } from "../../Utils/ChatUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import ImageGallery from "./ImageGallery";
import VideoCallButton from "./StartVideoCall";

// ---- Utility Functions ----
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMessageDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
};

const groupMessagesByDate = (messages) => {
  return messages.reduce((groups, message) => {
    const messageDate = new Date(message.createdat).toDateString();

    if (!groups[messageDate]) {
      groups[messageDate] = [];
    }

    groups[messageDate].push(message);
    return groups;
  }, {});
};

// ---- Sub-Components ----

const ChatHeader = ({
  currentChat,
  setCurrentChat,
  isMobile,
  navigate,
  incomingCall,
  isInCall,
  startCall,
}) => {
  const { otherUser, isTyping, isOnline } = currentChat || {};

  return (
    <Card className="sticky top-0 z-10 mb-2 flex flex-row items-center w-full p-3 gap-3 rounded-none shadow-sm border-b">
      {isMobile && (
        <Button
          onClick={() => setCurrentChat(null)}
          variant="ghost"
          size="icon"
          className="rounded-full"
        >
          <ArrowLeft size={20} />
        </Button>
      )}

      <div
        className="relative cursor-pointer flex items-center gap-3"
        onClick={() => {
          navigate(`/user/${otherUser?.username}`, {
            state: { user: otherUser },
          });
        }}
      >
        <Avatar className="h-12 w-12 relative">
          <AvatarImage
            alt={otherUser?.name || "User"}
            src={getProfileCloudinaryUrl(otherUser?.profilepic)}
          />
          <AvatarFallback>{otherUser?.name?.[0] || "U"}</AvatarFallback>
          {isOnline && (
            <span
              title="Online"
              className="absolute right-1 bottom-1 w-3 h-3 bg-green-500 rounded-full"
            />
          )}
        </Avatar>

        <div className="flex flex-col justify-center">
          <div className="text-lg font-medium text-foreground">
            {otherUser?.name}
          </div>
          {isTyping && (
            <div className="text-xs font-medium text-green-500 animate-pulse">
              Typing...
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {!incomingCall && !isInCall && (
          <VideoCallButton
            startCall={startCall}
            currentChat={currentChat}
            incomingCall={incomingCall}
          />
        )}
      </div>
    </Card>
  );
};

const DateSeparator = ({ date }) => (
  <div className="flex justify-center my-4">
    <div className="px-4 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground">
      {formatMessageDate(date)}
    </div>
  </div>
);

const MessageActions = ({
  message,
  isOwnMessage,
  handleCopy,
  deleteMessage,
}) => {
  return (
    <div
      className={`absolute ${
        isOwnMessage ? "-left-12" : "-right-12"
      } top-0 opacity-0 group-hover:opacity-100 transition-opacity`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-accent"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isOwnMessage ? "start" : "end"}
          className="w-[160px]"
        >
          {message.content && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => handleCopy(message.content)}
            >
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy</span>
            </DropdownMenuItem>
          )}

          {isOwnMessage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  className="text-destructive cursor-pointer focus:text-destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Message</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Are you sure you want to
                    delete this message?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMessage(message.messageid)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const MessageBubble = ({
  message,
  isOwnMessage,
  handleCopy,
  deleteMessage,
  chatImages,
  setSelectedImageIndex,
  setShowGallery,
}) => {
  return (
    <div
      className={`flex ${
        isOwnMessage ? "justify-end" : "justify-start"
      } mb-2 group`}
    >
      <div
        className={`max-w-[75%] md:max-w-[60%] flex flex-col ${
          isOwnMessage ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`relative p-3 rounded-2xl ${
            isOwnMessage
              ? "bg-primary text-primary-foreground"
              : "bg-muted dark:bg-muted/70 text-foreground"
          }`}
        >
          <MessageActions
            message={message}
            isOwnMessage={isOwnMessage}
            handleCopy={handleCopy}
            deleteMessage={deleteMessage}
          />

          {message.fileurl && (
            <div className="mb-2 rounded-lg overflow-hidden">
              <img
                src={getOptimizedImageUrl(message.fileurl, { thumbnail: true })}
                alt="Attachment"
                className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  const imageIndex = chatImages.indexOf(message.fileurl);
                  setSelectedImageIndex(imageIndex);
                  setShowGallery(true);
                }}
                loading="lazy"
              />
            </div>
          )}

          {message.content && (
            <div className="text-sm font-normal whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 px-1">
          {formatTime(message.createdat)}
          {isOwnMessage && (
            <div className="flex items-center ml-1">
              {message.isread ? (
                <div className="flex text-blue-500">
                  <Check size={13} />
                  <Check size={13} className="-ml-2" />
                </div>
              ) : (
                <Check size={13} className="text-muted-foreground/70" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MessageList = ({
  messages,
  loading,
  loggedInUserId,
  handleCopy,
  deleteMessage,
  chatImages,
  setSelectedImageIndex,
  setShowGallery,
  currentChat,
  messageEndRef,
}) => {
  // Memoize the grouped messages to avoid recalculating on every render
  const groupedMessages = useMemo(() => {
    const grouped = groupMessagesByDate(messages);
    return Object.entries(grouped).sort(
      ([dateA], [dateB]) => new Date(dateA) - new Date(dateB),
    );
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full justify-center items-center">
        <div className="flex flex-col items-center gap-4 text-center p-4">
          <div className="p-4 rounded-full bg-muted">
            <MessageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              No messages yet
            </h3>
            <p className="text-muted-foreground">
              Say hi to {currentChat?.otherUser?.name} to start the conversation
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {groupedMessages.map(([date, dateMessages]) => (
          <div key={date} className="space-y-2">
            <DateSeparator date={date} />

            {dateMessages
              .sort((a, b) => new Date(a.createdat) - new Date(b.createdat))
              .map((message, index) => (
                <MessageBubble
                  key={message.messageid || index}
                  message={message}
                  isOwnMessage={message.senderid === loggedInUserId}
                  handleCopy={handleCopy}
                  deleteMessage={deleteMessage}
                  chatImages={chatImages}
                  setSelectedImageIndex={setSelectedImageIndex}
                  setShowGallery={setShowGallery}
                />
              ))}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
    </ScrollArea>
  );
};

const MessageInput = ({
  message,
  handleTyping,
  handleSendMessage,
  filePreview,
  removeImage,
  showEmojiPicker,
  setShowEmojiPicker,
  setMessage,
}) => {
  const isMobile = useIsMobile();

  const fileInputRef = useRef(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="mt-auto w-full p-3 border-t shadow-sm rounded-none">
      {filePreview && (
        <div className="mb-3 relative w-24 h-24 overflow-hidden rounded-md mr-auto">
          <img
            src={filePreview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-0.5 right-0.5 h-6 w-6 rounded-full"
            onClick={removeImage}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="relative flex items-center gap-2">
        <div className="flex gap-1">
          {!isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Emoji</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={handleAttachClick}
                >
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          id="fileInput"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              setFile(selectedFile);
              setFilePreview(URL.createObjectURL(selectedFile));
            }
          }}
        />

        <Input
          value={message}
          onChange={handleTyping}
          placeholder="Type a message..."
          className="flex-grow rounded-full"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />

        <Button
          variant={message.trim() || filePreview ? "default" : "ghost"}
          size="icon"
          className="rounded-full"
          disabled={!message.trim() && !filePreview}
          onClick={handleSendMessage}
        >
          <SendHorizontal className="h-5 w-5" />
        </Button>
      </div>

      {showEmojiPicker && (
        <div className="absolute bottom-16 left-0 z-50">
          <EmojiPicker
            data={data}
            onEmojiSelect={(emoji) => setMessage((prev) => prev + emoji.native)}
            theme="auto"
            previewPosition="none"
          />
        </div>
      )}
    </Card>
  );
};

// Message icon for empty state
const MessageIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// ---- Main Component ----

const ChatWithUser = ({
  setCurrentChat,
  currentChat,
  loggedInUserId,
  socket,
}) => {
  const { user } = useContext(Context);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { setUsers, isInCall, incomingCall, startCall } =
    useContext(ChatContext);

  // State
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Refs
  const typingTimeoutRef = useRef(null);
  const messageEndRef = useRef(null);

  // Get all images in the chat for the gallery
  const chatImages = useMemo(() => {
    return messages.filter((msg) => msg.fileurl).map((msg) => msg.fileurl);
  }, [messages]);

  // Fetch messages when chat changes
  const fetchMessages = useCallback(async () => {
    if (!loggedInUserId || !currentChat?.chatid) return;

    try {
      setLoading(true);
      const fetchedMessages = await getAllMessages(currentChat.chatid);
      setMessages(fetchedMessages);
    } catch (error) {
      toast.error("Failed to load messages");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [loggedInUserId, currentChat?.chatid]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !currentChat?.chatid) return;

    const handleNewMessage = (newMessageReceived) => {
      if (newMessageReceived.chatid === currentChat.chatid) {
        setMessages((prevMessages) => [...prevMessages, newMessageReceived]);
      }
    };

    const handleMessageDeleted = (messageData) => {
      if (messageData.chatid === currentChat.chatid) {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.messageid !== messageData.messageId),
        );
      }
    };

    const handleReadStatus = (data) => {
      if (data.chatid === currentChat.chatid) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            data.messageIds.includes(msg.messageid)
              ? { ...msg, isread: true }
              : msg,
          ),
        );
      }
    };

    socket.on("message-received", handleNewMessage);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("messages-read-status", handleReadStatus);

    return () => {
      socket.off("message-received", handleNewMessage);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("messages-read-status", handleReadStatus);
    };
  }, [socket, currentChat?.chatid]);

  // Send message handler
  const handleSendMessage = useCallback(async () => {
    if ((!message.trim() && !file) || !currentChat?.chatid) return;

    try {
      // Optimistic update
      const optimisticMessage = {
        senderid: loggedInUserId,
        content: message.trim(),
        createdat: new Date().toISOString(),
        messageid: `temp-${Date.now()}`,
        participants: currentChat.participants,
        chatid: currentChat.chatid,
        fileurl: file ? URL.createObjectURL(file) : null,
        senderName: user?.name,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // Update last message in chat list
      setUsers((prevUsers) =>
        prevUsers.map((chat) =>
          chat.chatid === currentChat.chatid
            ? { ...chat, lastmessage: message.trim() || "Sent an image" }
            : chat,
        ),
      );

      // Reset input states
      setMessage("");
      setShowEmojiPicker(false);

      // Send text message immediately via socket
      if (!file) {
        socket.emit("new-message", optimisticMessage);
      }

      // Prepare and send API request
      const formData = new FormData();
      formData.append("chatid", currentChat.chatid);
      formData.append("senderid", loggedInUserId);
      formData.append("content", message.trim());

      if (file) {
        formData.append("file", file);
        setFile(null);
        setFilePreview(null);
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/send/message`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      // If file was sent, update with server response and emit socket event
      if (file && response.data.message) {
        const serverMessage = {
          ...response.data.message,
          participants: currentChat.participants,
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === optimisticMessage.messageid ? serverMessage : msg,
          ),
        );

        socket.emit("new-message", serverMessage);
      }

      // Reset typing indicator
      socket.emit("typing", {
        userId: loggedInUserId,
        recipientId: currentChat.otherUser.userid,
        isTyping: false,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");

      // Remove optimistic message on failure
      setMessages((prev) =>
        prev.filter((msg) => !msg.messageid.toString().startsWith("temp-")),
      );
    }
  }, [
    message,
    file,
    loggedInUserId,
    currentChat,
    user?.name,
    socket,
    setUsers,
  ]);

  // Delete message handler
  const deleteMessage = useCallback(
    async (messageId) => {
      try {
        const response = await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/delete/message/${messageId}`,
          { withCredentials: true },
        );

        if (response.status === 200) {
          socket.emit("delete-message", {
            chatid: currentChat.chatid,
            messageId,
            recipientId: currentChat.otherUser.userid,
          });

          setMessages((prev) =>
            prev.filter((msg) => msg.messageid !== messageId),
          );
          toast.success("Message deleted");
        }
      } catch (error) {
        console.error("Error deleting message:", error);
        toast.error("Failed to delete message");
      }
    },
    [socket, currentChat?.chatid, currentChat?.otherUser?.userid],
  );

  // Typing indicator handler
  const handleTyping = useCallback(
    (e) => {
      setMessage(e.target.value);

      if (!socket || !currentChat?.otherUser?.userid) return;

      clearTimeout(typingTimeoutRef.current);

      socket.emit("typing", {
        userId: loggedInUserId,
        recipientId: currentChat.otherUser.userid,
        isTyping: true,
      });

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", {
          userId: loggedInUserId,
          recipientId: currentChat.otherUser.userid,
          isTyping: false,
        });
      }, 3000);
    },
    [loggedInUserId, socket, currentChat?.otherUser?.userid],
  );

  // Mark messages as read
  useEffect(() => {
    if (
      !messages.length ||
      !socket ||
      !loggedInUserId ||
      !currentChat?.otherUser?.userid
    ) {
      return;
    }

    // Find messages from other user that are unread
    const unreadMessages = messages.filter(
      (msg) => msg.senderid === currentChat?.otherUser?.userid && !msg.isread,
    );

    if (unreadMessages.length === 0) return;

    // Get message IDs to mark as read
    const messageIds = unreadMessages.map((msg) => msg.messageid);

    // Function to mark messages as read
    const markMessagesAsRead = async () => {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/read/messages`,
          { messageIds },
          { withCredentials: true },
        );

        if (response.status === 200) {
          // Emit socket event to inform sender
          socket.emit("messages-read", {
            messageIds,
            chatid: currentChat.chatid,
            readerId: loggedInUserId,
            senderId: currentChat.otherUser.userid,
          });
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };

    // Debounce the read status update
    const timeoutId = setTimeout(markMessagesAsRead, 1000);

    return () => clearTimeout(timeoutId);
  }, [messages, socket, loggedInUserId, currentChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    scrollToBottom();

    // Also scroll when images load
    const handleImageLoad = () => scrollToBottom();
    const chatContainer = messageEndRef.current?.parentElement;

    if (chatContainer) {
      const images = chatContainer.querySelectorAll("img");
      images.forEach((img) => {
        img.addEventListener("load", handleImageLoad);
      });

      return () => {
        images.forEach((img) => {
          img.removeEventListener("load", handleImageLoad);
        });
      };
    }
  }, [messages]);

  // Utility function to copy message text
  const handleCopy = useCallback((text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Failed to copy"));
  }, []);

  // Helper to remove file preview
  const removeImage = () => {
    setFile(null);
    setFilePreview(null);
  };

  // If no current chat is selected
  if (!currentChat) {
    return (
      <div className="flex flex-col h-[calc(100vh-60px)] justify-center items-center bg-card">
        <div className="text-center p-4">
          <div className="mb-4">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Select a conversation
          </h3>
          <p className="text-muted-foreground">
            Choose a chat from the sidebar to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex flex-col h-[calc(100vh-60px)]">
        <ChatHeader
          currentChat={currentChat}
          setCurrentChat={setCurrentChat}
          isMobile={isMobile}
          navigate={navigate}
          incomingCall={incomingCall}
          isInCall={isInCall}
          startCall={startCall}
        />

        <MessageList
          messages={messages}
          loading={loading}
          loggedInUserId={loggedInUserId}
          handleCopy={handleCopy}
          deleteMessage={deleteMessage}
          chatImages={chatImages}
          setSelectedImageIndex={setSelectedImageIndex}
          setShowGallery={setShowGallery}
          currentChat={currentChat}
          messageEndRef={messageEndRef}
        />

        <MessageInput
          message={message}
          handleTyping={handleTyping}
          handleSendMessage={handleSendMessage}
          filePreview={filePreview}
          removeImage={removeImage}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          setMessage={setMessage}
        />
      </div>

      {showGallery && chatImages.length > 0 && (
        <ImageGallery
          images={chatImages}
          initialIndex={selectedImageIndex}
          onClose={() => setShowGallery(false)}
        />
      )}
    </>
  );
};

export default ChatWithUser;
