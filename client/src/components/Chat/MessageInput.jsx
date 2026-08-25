import React, { useCallback, useEffect, useRef, useState } from "react"
import { Paperclip, SendHorizontal, X } from "lucide-react"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Input } from "../ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

const MessageInput = ({
  onSendMessage,
  filePreview,
  removeImage,
  onTyping,
  currentChat,
  loggedInUserId,
  onFileSelect,
}) => {
  const [message, setMessage] = useState("")
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  // Handle typing events with proper socket emission
  const handleTyping = useCallback(
    (e) => {
      setMessage(e.target.value)

      if (!onTyping || !currentChat?.otherUser?.userid) return

      clearTimeout(typingTimeoutRef.current)

      // Emit typing start
      onTyping({
        userId: loggedInUserId,
        recipientId: currentChat.otherUser.userid,
        isTyping: true,
      })

      typingTimeoutRef.current = setTimeout(() => {
        onTyping({
          userId: loggedInUserId,
          recipientId: currentChat.otherUser.userid,
          isTyping: false,
        })
      }, 3000)
    },
    [onTyping, loggedInUserId, currentChat?.otherUser?.userid],
  )

  const handleSendMessage = useCallback(() => {
    if (!message.trim() && !filePreview) return

    clearTimeout(typingTimeoutRef.current)
    if (onTyping && currentChat?.otherUser?.userid) {
      onTyping({
        userId: loggedInUserId,
        recipientId: currentChat.otherUser.userid,
        isTyping: false,
      })
    }

    onSendMessage(message.trim())
    setMessage("")
  }, [
    message,
    filePreview,
    onSendMessage,
    onTyping,
    loggedInUserId,
    currentChat?.otherUser?.userid,
  ])

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  return (
    <Card className="mt-auto w-full p-3 border-t shadow-xs rounded-none">
      {filePreview && (
        <div className="mb-3 relative w-24 h-24 overflow-hidden rounded-md mr-auto">
          <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
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
            const selectedFile = e.target.files?.[0]
            if (selectedFile && onFileSelect) {
              onFileSelect(selectedFile)
            }
          }}
        />

        <Input
          value={message}
          onChange={handleTyping}
          placeholder="Type a message..."
          className="grow rounded-full"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage()
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
    </Card>
  )
}

export default MessageInput
