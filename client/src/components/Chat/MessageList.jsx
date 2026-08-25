import React, { useMemo } from "react"
import { Loader2 } from "lucide-react"
import { ScrollArea } from "../ui/scroll-area"
import { groupMessagesByDate } from "./ChatDateUtils"
import DateSeparator from "./DateSeparator"
import CallMessageBubble from "./CallMessageBubble"
import MessageBubble from "./MessageBubble"

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
)

const MessageList = ({
  messages,
  loading,
  loggedInUserId,
  handleCopy,
  deleteMessage,
  onRetry,
  onShowInfo,
  chatImages,
  setSelectedImageIndex,
  setShowGallery,
  currentChat,
  messageEndRef,
}) => {
  const groupedMessages = useMemo(() => {
    const grouped = groupMessagesByDate(messages)
    return Object.entries(grouped).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
  }, [messages])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full justify-center items-center">
        <div className="flex flex-col items-center gap-4 text-center p-4">
          <div className="p-4 rounded-full bg-muted">
            <MessageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">No messages yet</h3>
            <p className="text-muted-foreground">
              Say hi to {currentChat?.otherUser?.name} to start the conversation
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {groupedMessages.map(([date, dateMessages]) => (
          <div key={date} className="space-y-2">
            <DateSeparator date={date} />

            {dateMessages
              .sort((a, b) => new Date(a.createdat) - new Date(b.createdat))
              .map((message, index) => {
                const isCallMessage = ["missed_call", "completed_call", "rejected_call"].includes(
                  message.messagetype,
                )

                if (isCallMessage) {
                  return (
                    <CallMessageBubble
                      key={message.messageid || index}
                      message={message}
                      isOwnMessage={message.senderid === loggedInUserId}
                    />
                  )
                }

                return (
                  <MessageBubble
                    key={message.messageid || index}
                    message={message}
                    isOwnMessage={message.senderid === loggedInUserId}
                    handleCopy={handleCopy}
                    deleteMessage={deleteMessage}
                    onRetry={onRetry}
                    onShowInfo={onShowInfo}
                    chatImages={chatImages}
                    setSelectedImageIndex={setSelectedImageIndex}
                    setShowGallery={setShowGallery}
                  />
                )
              })}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
    </ScrollArea>
  )
}

export default MessageList
