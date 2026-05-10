import { memo, useRef, useEffect, useCallback, useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, Send, Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import UpgradeDialog from "@/components/UpgradeDialog"

const getActivityMeta = (message) => {
  const lower = message?.toLowerCase() || ""
  if (lower.includes("now playing")) return { icon: "▶️", accent: "text-emerald-400/70" }
  if (lower.includes("added") && lower.includes("queue")) return { icon: "🎵", accent: "text-blue-400/70" }
  if (lower.includes("skipped")) return { icon: "⏭️", accent: "text-amber-400/70" }
  if (lower.includes("joined")) return { icon: "👋", accent: "text-emerald-400/70" }
  if (lower.includes("left")) return { icon: "👋", accent: "text-rose-400/70" }
  return { icon: "💬", accent: "text-muted-foreground/40" }
}

const ActivityMessage = memo(({ msg }) => {
  const meta = useMemo(() => getActivityMeta(msg.message), [msg.message])

  return (
    <div className="flex justify-center py-1.5">
      <p className={cn(
        "text-[11px] px-3.5 py-1 rounded-full leading-relaxed border border-border/10 bg-accent/20",
        meta.accent,
      )}>
        <span className="mr-1.5">{meta.icon}</span>
        {msg.message}
      </p>
    </div>
  )
})

const ChatMessage = memo(({ msg, isOwn, showAvatar }) => (
  <div className={cn("flex gap-2.5", isOwn ? "justify-end" : "justify-start")}>
    {!isOwn && (
      <div className="w-7 shrink-0">
        {showAvatar ? (
          <Avatar className="h-7 w-7">
            <AvatarImage src={msg.profilePic} />
            <AvatarFallback className="text-[10px] bg-accent font-medium">
              {msg.userName?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>
    )}

    <div
      className={cn(
        "max-w-[75%] px-3.5 py-2",
        isOwn
          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
          : "bg-accent/50 rounded-2xl rounded-bl-md",
      )}
    >
      {!isOwn && showAvatar && (
        <p className="text-[10px] font-semibold mb-0.5 opacity-60">{msg.userName}</p>
      )}
      <p className="text-[13px] leading-relaxed wrap-break-word">{msg.message}</p>
    </div>
  </div>
))

const EmptyState = memo(() => (
  <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-2">
    <div className="p-3 rounded-full bg-accent/30">
      <MessageCircle className="h-6 w-6 text-muted-foreground/20" />
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground/40">No messages yet</p>
      <p className="text-[11px] text-muted-foreground/25 mt-0.5">Say something to the group!</p>
    </div>
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
        className="gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 cursor-pointer"
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
    <div className="space-y-1 p-1">
      {messages.map((msg, i) => {
        if (msg.type === "activity") {
          return <ActivityMessage key={msg.id || i} msg={msg} />
        }

        const isOwn = msg.senderId === currentUserId
        const prev = messages[i - 1]
        const showAvatar = !isOwn && (
          !prev || prev.type === "activity" || prev.senderId !== msg.senderId
        )

        return (
          <ChatMessage
            key={msg.id || i}
            msg={msg}
            isOwn={isOwn}
            showAvatar={showAvatar}
          />
        )
      })}
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
    <div className="rounded-xl border border-border/30 bg-accent/5 overflow-hidden flex flex-col h-full relative">
      {locked && <ChatLockedOverlay onUpgrade={() => setShowUpgrade(true)} />}

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/20">
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-sm font-semibold">Chat</span>
        {locked && <Lock className="h-3 w-3 text-muted-foreground/40" />}
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 px-3 py-2 max-h-75">
        <MessagesList messages={messages} currentUserId={currentUserId} />
      </ScrollArea>

      <div className="p-2.5 border-t border-border/20">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={locked ? "PRO feature" : "Type a message..."}
            onKeyPress={handleKeyPress}
            disabled={locked}
            className="rounded-full bg-accent/30 border-border/20 h-9 text-sm placeholder:text-muted-foreground/25 focus-visible:ring-primary/20"
          />
          <Button
            onClick={handleSend}
            size="icon"
            disabled={locked}
            className="rounded-full shrink-0 h-9 w-9 cursor-pointer shadow-sm"
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
