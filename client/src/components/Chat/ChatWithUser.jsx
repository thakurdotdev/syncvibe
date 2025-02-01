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
  Copy,
  Loader2,
  MoreVertical,
  Paperclip,
  SendHorizonalIcon,
  Smile,
  Trash,
  X,
} from "lucide-react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import ImageGallery from "./ImageGallery";
import VideoCallButton from "./StartVideoCall";

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const groupMessagesByDate = (messages) => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  return messages.reduce((groups, message) => {
    const messageDate = new Date(message.createdat).toDateString();
    let groupKey;

    if (messageDate === today) {
      groupKey = "Today";
    } else if (messageDate === yesterday) {
      groupKey = "Yesterday";
    } else {
      groupKey = messageDate;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(message);
    return groups;
  }, {});
};

const ChatWithUser = ({
  setCurrentChat,
  currentChat,
  loggedInUserId,
  socket,
}) => {
  const { user } = useContext(Context);
  const isMobile = useIsMobile();
  const { setUsers, isInCall, incomingCall, startCall, answerCall, endCall } =
    useContext(ChatContext);
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messageEndRef = useRef(null);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState("");

  const fetchMessages = useCallback(async () => {
    if (!loggedInUserId || !currentChat?.otherUser?.userid) return;
    try {
      setLoading(true);
      const fetchedMessages = await getAllMessages(currentChat.chatid);
      setMessages(fetchedMessages);
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      setLoading(false);
    }
  }, [loggedInUserId, currentChat?.otherUser?.userid, currentChat?.chatid]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!socket || !loggedInUserId || !currentChat?.otherUser?.userid) return;

    const handleNewMessage = (newMessageReceived) => {
      if (newMessageReceived.chatid === currentChat.chatid) {
        setMessages((prevMessages) => [...prevMessages, newMessageReceived]);
      }
    };

    socket.on("message-deleted", (messageData) => {
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.messageid !== messageData.messageId),
      );
    });

    socket.on("message-received", handleNewMessage);

    return () => {
      socket.off("message-received", handleNewMessage);
      socket.off("message-deleted");
    };
  }, [
    socket,
    loggedInUserId,
    currentChat?.otherUser?.userid,
    currentChat?.chatid,
  ]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() && !file) return;

    try {
      const newMessage = {
        senderid: loggedInUserId,
        content: message,
        createdat: new Date().toISOString(),
        messageid: messages.length + 1,
        participants: currentChat.participants,
        chatid: currentChat.chatid,
        fileurl: file ? URL.createObjectURL(file) : null,
        senderName: user?.name,
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setUsers((prevUsers) => {
        const updatedUsers = prevUsers.map((user) => {
          if (user.chatid === currentChat.chatid) {
            return { ...user, lastmessage: message };
          }
          return user;
        });
        return updatedUsers;
      });
      setMessage("");
      setFile(null);
      setFilePreview(null);
      setShowEmojiPicker(false);

      if (!file) {
        socket.emit("new-message", newMessage);
      }

      const formData = new FormData();
      formData.append("chatid", currentChat.chatid);
      formData.append("senderid", loggedInUserId);
      formData.append("content", message);
      if (file) {
        formData.append("file", file);
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/send/message`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      if (file) {
        let serverMessage = response.data.message;
        serverMessage.participants = currentChat.participants;
        socket.emit("new-message", serverMessage);
      }

      socket.emit("typing", {
        userId: loggedInUserId,
        recipientId: currentChat.otherUser.userid,
        isTyping: false,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    }
  }, [message, file, loggedInUserId, currentChat, messages.length, socket]);

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/edit/message/${messageId}`,
        { content: newContent },
        { withCredentials: true },
      );

      if (response.status === 200) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.messageid === messageId ? { ...msg, content: newContent } : msg,
          ),
        );
      }
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error("Failed to edit message.");
    }
  };

  const deleteMessage = async (messageId) => {
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
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.messageid !== messageId),
        );
        toast.success("Message deleted");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message.");
    }
  };

  const handleTyping = useCallback(
    (e) => {
      setMessage(e.target.value);

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
    [loggedInUserId, currentChat?.otherUser?.userid, socket],
  );

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFile(null);
      setFilePreview(null);
    }
  }, []);

  useEffect(() => {
    // Function to scroll to the bottom
    const scrollToBottom = () => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Scroll when a new message arrives
    scrollToBottom();

    // MutationObserver to handle image load and new messages
    const observer = new MutationObserver(scrollToBottom);

    // Observe changes in the messages container
    const chatContainer = messageEndRef.current?.parentNode;
    if (chatContainer) {
      observer.observe(chatContainer, { childList: true, subtree: true });
    }

    // Scroll again when images in the chat load
    const handleImageLoad = () => scrollToBottom();
    const images = chatContainer?.querySelectorAll("img") || [];
    images.forEach((img) => img.addEventListener("load", handleImageLoad));

    return () => {
      // Clean up listeners and observer
      observer.disconnect();
      images.forEach((img) => img.removeEventListener("load", handleImageLoad));
    };
  }, [messages]);

  const getChatImages = useCallback(() => {
    return messages.filter((msg) => msg.fileurl).map((msg) => msg.fileurl);
  }, [messages]);

  const removeImage = () => {
    setFile(null);
    setFilePreview(null);
  };

  const handleCopy = (message) => {
    navigator.clipboard.writeText(message).then(() => {
      toast.success("Message copied to clipboard");
    });
  };

  const chatImages = getChatImages();

  const renderMessages = useCallback(() => {
    const processMessages = (chats) => {
      const groupedMessages = chats.reduce((groups, message) => {
        const messageDate = new Date(message.createdat).toDateString();

        if (!groups[messageDate]) {
          groups[messageDate] = [];
        }
        groups[messageDate].push(message);

        return groups;
      }, {});

      return Object.entries(groupedMessages)
        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
        .map(([date, messages]) => [
          date,
          messages.sort(
            (a, b) => new Date(a.createdat) - new Date(b.createdat),
          ),
        ]);
    };

    const groupedMessages = processMessages(messages);

    return groupedMessages.map(([date, dateMessages]) => (
      <div key={date} className="space-y-4">
        <div className="sticky top-0 z-10">
          <div className="text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-1.5 px-4 rounded-lg mx-auto max-w-fit">
            {date}
          </div>
        </div>

        <ScrollArea className="h-auto">
          {dateMessages.map((message, index) => {
            const isOwnMessage = message.senderid === loggedInUserId;

            return (
              <div
                key={index}
                className={`flex ${
                  isOwnMessage ? "justify-end" : "justify-start"
                } mb-4 group`}
              >
                <div
                  className={`max-w-[70%] min-w-[150px] flex flex-col ${
                    isOwnMessage ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`relative p-4 rounded-xl ${
                      isOwnMessage
                        ? "bg-blue-100 dark:bg-blue-900 text-gray-900 dark:text-gray-100"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    } shadow-md`}
                  >
                    {/* Message Actions - Different for own and other messages */}
                    <div
                      className={`absolute ${
                        isOwnMessage ? "-left-8" : "-right-8"
                      } top-2 opacity-0 group-hover:opacity-100 transition-opacity`}
                    >
                      {isOwnMessage ? (
                        // Full menu for own messages
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-[160px] shadow-lg"
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
                            {/* <DropdownMenuItem className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem> */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-600 cursor-pointer focus:text-red-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Message
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. Are you sure
                                    you want to delete this message?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      deleteMessage(message.messageid)
                                    }
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-[160px] shadow-lg"
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {message.fileurl && (
                      <div className="mb-2">
                        <img
                          src={getOptimizedImageUrl(message.fileurl, {
                            thumbnail: true,
                          })}
                          alt="Attachment"
                          className="max-w-[250px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            const imageIndex = chatImages.indexOf(
                              message.fileurl,
                            );
                            setSelectedImageIndex(imageIndex);
                            setShowGallery(true);
                          }}
                        />
                      </div>
                    )}

                    {message.content && (
                      <div className="text-base font-normal whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1 px-1">
                    {formatTime(message.createdat)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messageEndRef} />
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
    ));
  }, [messages, loggedInUserId, deleteMessage, chatImages]);

  if (!currentChat) {
    return (
      <Card className="flex flex-col h-[calc(100vh-60px)] justify-center items-center rounded-none"></Card>
    );
  }

  return (
    <>
      <div className="relative flex flex-col h-[calc(100vh-60px)]">
        <Card className="sticky top-0 z-10 mb-2 flex flex-row items-center w-full p-2 gap-2 rounded-none">
          {isMobile && (
            <button
              onClick={() => setCurrentChat(null)}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div
            className="relative cursor-pointer"
            onClick={() => {
              navigate(`/user/${currentChat?.otherUser?.username}`, {
                state: { user: currentChat?.otherUser },
              });
            }}
          >
            <Avatar>
              <AvatarImage
                alt="User Avatar"
                src={getProfileCloudinaryUrl(
                  currentChat?.otherUser?.profilepic,
                )}
                className="w-12 h-12 rounded-full mr-2"
              />
              <AvatarFallback className="w-12 h-12 rounded-full">
                {currentChat?.otherUser?.name[0]}
              </AvatarFallback>
            </Avatar>
            <span
              title={currentChat.isOnline ? "online" : "offline"}
              className={`absolute right-0 bottom-1 w-3 h-3 ${
                currentChat.isOnline ? "bg-green-500" : ""
              } rounded-full`}
            />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {currentChat?.otherUser?.name}
            </div>
            <div className="text-sm text-green-500">
              {currentChat?.isTyping ? "Typing..." : ""}
            </div>
          </div>
          <div className="flex items-center ml-auto">
            {!incomingCall && !isInCall && (
              <VideoCallButton
                startCall={startCall}
                currentChat={currentChat}
                incomingCall={incomingCall}
              />
            )}
          </div>
        </Card>
        <div className="flex-1 overflow-y-auto w-full flex flex-col px-4">
          {loading ? (
            <div className="flex items-center justify-center h-[90vh]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : messages.length > 0 ? (
            renderMessages()
          ) : (
            <div className="flex flex-col h-full justify-center items-center">
              <div className="text-gray-500 dark:text-gray-400 font-bold text-2xl mt-5 text-center">
                Say Hii to, {currentChat?.otherUser?.name}
              </div>
            </div>
          )}
        </div>
        <Card className="flex flex-col items-center mt-2 w-full p-2 relative rounded-none">
          {filePreview && (
            <div className="mb-2 relative border-t-2 mr-auto aspect-square w-[200px] h-[200px] overflow-hidden">
              <img
                src={filePreview}
                alt="Preview"
                className="w-full h-full object-cover rounded"
              />
              <button
                type="button"
                onClick={() => removeImage()}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center w-full relative gap-3 p-2 rounded-full">
            {!window.navigator.userAgent.includes("Mobile") && (
              <button
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="text-gray-500 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-400 cursor-pointer transition duration-150 ease-in-out"
                aria-label="Emoji Picker"
              >
                <Smile size={24} />
              </button>
            )}

            <label
              htmlFor="fileInput"
              className="text-gray-500 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-400 cursor-pointer transition duration-150 ease-in-out"
              aria-label="Attach file"
            >
              <Paperclip size={24} />
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="fileInput"
            />

            <Input
              value={message}
              onChange={handleTyping}
              placeholder="Type your message..."
              required
              className="flex-grow py-2 px-4 border rounded-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendMessage();
              }}
            />

            <button
              onClick={handleSendMessage}
              className={`text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition duration-150 ease-in-out ${
                message.length === 0 && !file
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={message.length === 0 && !file}
              aria-label="Send message"
            >
              <SendHorizonalIcon size={30} />
            </button>
          </div>

          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 z-50">
              <EmojiPicker
                data={data}
                onEmojiSelect={(emojiObject) =>
                  setMessage((prev) => prev + emojiObject.native)
                }
              />
            </div>
          )}
        </Card>
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
