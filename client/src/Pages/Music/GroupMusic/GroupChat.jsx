import { memo, useRef, useEffect, useCallback, useMemo, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, Send, Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import UpgradeDialog from "@/components/UpgradeDialog"

const ActivityMessage = memo(({ msg }) => (
  <div className="flex justify-center py-1">
    <p className="text-[11px] text-muted-foreground/50 bg-accent/40 px-3 py-1 rounded-full">
      {msg.message}
    </p>
  </div>
))

const ChatMessage = memo(({ msg, isOwn }) => (
  <div className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}>
    {!isOwn && (
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarImage src={msg.profilePic} />
        <AvatarFallback className="text-[10px] bg-accent">
          {msg.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
    )}

    <div
      className={cn(
        "max-w-[75%] rounded-2xl px-3 py-2",
        isOwn
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-accent/60 rounded-bl-sm",
      )}
    >
      {!isOwn && <p className="text-[10px] font-medium mb-0.5 opacity-50">{msg.userName}</p>}
      <p className="text-sm leading-relaxed wrap-break-word">{msg.message}</p>
    </div>
  </div>
))

const EmptyState = memo(() => (
  <div className="h-full flex flex-col items-center justify-center text-center p-6">
    <MessageCircle className="h-8 w-8 text-muted-foreground/20 mb-2" />
    <p className="text-xs text-muted-foreground/40">No messages yet</p>
  </div>
))

const ChatLockedOverlay = memo(({ onUpgrade }) => (
  <div
    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl cursor-pointer"
    onClick={onUpgrade}
  >
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <div className="p-3 rounded-full bg-accent/50">
        <Lock className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <div>
        <p className="font-medium text-sm">Group Chat is a PRO feature</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Tap to upgrade and chat with your group
        </p>
      </div>
      <Button
        size="sm"
        className="gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Upgrade to PRO
      </Button>
    </div>
  </div>
))

const MessagesList = memo(({ messages, currentUserId }) => {
  if (messages.length === 0) return <EmptyState />
  return (
    <div className="space-y-2.5 p-1">
      {messages.map((msg, i) =>
        msg.type === "activity" ? (
          <ActivityMessage key={msg.id || i} msg={msg} />
        ) : (
          <ChatMessage key={msg.id || i} msg={msg} isOwn={msg.senderId === currentUserId} />
        ),
      )}
    </div>
  )
})

const GroupChat = ({ messages, currentUserId, onSendMessage, locked = false }) => {
  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages.length])

  const handleSend = useCallback(() => {
    if (locked) return
    const message = inputRef.current?.value?.trim()
    if (message) {
      onSendMessage(message)
      inputRef.current.value = ""
    }
  }, [onSendMessage, locked])

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="rounded-xl border border-border/40 bg-accent/10 overflow-hidden flex flex-col h-full relative">
      {locked && <ChatLockedOverlay onUpgrade={() => setShowUpgrade(true)} />}

      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/30">
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="text-sm font-medium">Chat</span>
        {locked && <Lock className="h-3 w-3 text-muted-foreground/40" />}
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 px-2.5 py-2 max-h-[300px]">
        <MessagesList messages={messages} currentUserId={currentUserId} />
      </ScrollArea>

      <div className="p-2 border-t border-border/30">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={locked ? "PRO feature" : "Type a message..."}
            onKeyPress={handleKeyPress}
            disabled={locked}
            className="rounded-full bg-accent/30 border-border/30 h-9 text-sm placeholder:text-muted-foreground/30"
          />
          <Button
            onClick={handleSend}
            size="icon"
            disabled={locked}
            className="rounded-full shrink-0 h-9 w-9"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} feature="realtimeChat" />
    </div>
  )
}

export default memo(GroupChat)
