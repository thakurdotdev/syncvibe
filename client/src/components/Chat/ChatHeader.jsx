import React from "react"
import { ArrowLeft } from "lucide-react"
import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import VideoCallButton from "./StartVideoCall"

const ChatHeader = ({
  currentChat,
  setCurrentChat,
  isMobile,
  navigate,
  incomingCall,
  isInCall,
  startCall,
}) => {
  const { otherUser, isTyping, isOnline } = currentChat || {}

  return (
    <Card className="sticky top-0 z-10 mb-2 flex flex-row items-center w-full p-3 gap-3 rounded-none shadow-xs border-b">
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
          })
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
          <div className="text-lg font-medium text-foreground">{otherUser?.name}</div>
          {isTyping && (
            <div className="text-xs font-medium text-green-500 animate-pulse">Typing...</div>
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
  )
}

export default ChatHeader
