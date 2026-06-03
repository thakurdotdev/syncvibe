import { memo, useRef, useEffect, useCallback, useState, useMemo, createPortal } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MessageCircle,
  Send,
  Lock,
  Sparkles,
  Play,
  ListMusic,
  SkipForward,
  UserPlus,
  UserMinus,
  Music,
  Image as ImageIcon,
  X,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import UpgradeDialog from "@/components/UpgradeDialog"
import ReactDOM from "react-dom"

const EMOJI_ONLY_REGEX = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\s*(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)){0,2}$/u

const isEmojiOnly = (text) => {
  if (!text || text.length > 20) return false
  return EMOJI_ONLY_REGEX.test(text.trim())
}

const isGifMessage = (msg) => msg.messageType === "gif" && msg.gifUrl

const ACTIVITY_MAP = {
  "now playing": { Icon: Play, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-500/15" },
  "queue": { Icon: ListMusic, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-500/15" },
  "skipped": { Icon: SkipForward, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-500/15" },
  "joined": { Icon: UserPlus, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-500/15" },
  "left": { Icon: UserMinus, color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-500/15" },
  "queue ended": { Icon: Music, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-500/15" },
}

const getActivityMeta = (message) => {
  const lower = message?.toLowerCase() || ""
  for (const [keyword, meta] of Object.entries(ACTIVITY_MAP)) {
    if (lower.includes(keyword)) return meta
  }
  return { Icon: MessageCircle, color: "text-muted-foreground/50", bg: "bg-muted/20", border: "border-border/10" }
}

const ActivityMessage = memo(({ msg }) => {
  const meta = useMemo(() => getActivityMeta(msg.message), [msg.message])
  const IconComponent = meta.Icon

  return (
    <div className="flex justify-center py-1.5">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-[10.5px] px-3 py-1 rounded-full",
          "border backdrop-blur-sm",
          meta.bg, meta.border,
        )}
      >
        <IconComponent className={cn("h-3 w-3 shrink-0", meta.color)} />
        <span className="text-muted-foreground/60 leading-none truncate max-w-[280px]">
          {msg.message}
        </span>
      </div>
    </div>
  )
})

const GifContent = memo(({ url }) => (
  <div className="overflow-hidden rounded-xl max-w-[220px]">
    <img
      src={url}
      alt="GIF"
      loading="lazy"
      className="w-full h-auto rounded-xl object-cover"
      style={{ maxHeight: 200, minHeight: 60, background: "hsl(var(--muted) / 0.3)" }}
    />
  </div>
))

const ChatMessage = memo(({ msg, isOwn, showAvatar, isNew }) => {
  const emojiOnly = useMemo(() => isEmojiOnly(msg.message), [msg.message])
  const gifMsg = isGifMessage(msg)

  const content = (
    <div
      className={cn(
        "flex gap-2 px-1",
        isOwn ? "justify-end" : "justify-start",
        showAvatar ? "mt-3" : "mt-[3px]",
      )}
    >
      {!isOwn && (
        <div className="w-7 shrink-0 self-end">
          {showAvatar ? (
            <Avatar className="h-7 w-7 ring-1 ring-border/20 shadow-sm">
              <AvatarImage src={msg.profilePic} />
              <AvatarFallback className="text-[10px] bg-accent/50 font-medium">
                {msg.userName?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "max-w-[72%] relative",
          emojiOnly || gifMsg
            ? ""
            : isOwn
              ? "liquid-message-own rounded-[18px] rounded-br-[6px] px-3.5 py-[7px]"
              : "liquid-message-other rounded-[18px] rounded-bl-[6px] px-3.5 py-[7px]",
        )}
      >
        {!isOwn && showAvatar && (
          <p className="text-[10px] font-semibold mb-1 text-muted-foreground/45 leading-none">
            {msg.userName}
          </p>
        )}
        {gifMsg ? (
          <GifContent url={msg.gifUrl} />
        ) : emojiOnly ? (
          <p className="text-[40px] leading-[1.1] select-none">{msg.message}</p>
        ) : (
          <p className="text-[13px] leading-[1.5] break-words whitespace-pre-wrap">{msg.message}</p>
        )}
      </div>
    </div>
  )

  if (isNew) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {content}
      </motion.div>
    )
  }

  return content
})

const EmptyState = memo(() => (
  <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3 min-h-[160px]">
    <div className="p-3.5 rounded-2xl liquid-badge">
      <MessageCircle className="h-5 w-5 text-muted-foreground/25" />
    </div>
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground/45">No messages yet</p>
      <p className="text-[11px] text-muted-foreground/25">Say something to the group!</p>
    </div>
  </div>
))

const ChatLockedOverlay = memo(({ onUpgrade }) => (
  <div
    className="absolute inset-0 z-10 flex flex-col items-center justify-center liquid-panel rounded-xl cursor-pointer"
    onClick={onUpgrade}
  >
    <div className="flex flex-col items-center gap-3.5 p-6 text-center">
      <div className="p-3.5 rounded-2xl liquid-badge">
        <Lock className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-sm">Group Chat is a PRO feature</p>
        <p className="text-xs text-muted-foreground/50">Tap to upgrade and chat with your group</p>
      </div>
      <button className="gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 cursor-pointer px-4 py-2 text-sm font-medium flex items-center transition-all duration-200 hover:scale-105 active:scale-95">
        <Sparkles className="h-3.5 w-3.5" />
        Upgrade to PRO
      </button>
    </div>
  </div>
))

const MessagesList = memo(({ messages, currentUserId, prevCountRef }) => {
  if (messages.length === 0) return <EmptyState />
  const prevCount = prevCountRef.current

  return (
    <div className="p-2 space-y-px">
      {messages.map((msg, i) => {
        if (msg.type === "activity") {
          return <ActivityMessage key={msg.id || i} msg={msg} />
        }
        const isOwn = msg.senderId === currentUserId
        const prev = messages[i - 1]
        const showAvatar = !isOwn && (!prev || prev.type === "activity" || prev.senderId !== msg.senderId)
        const isNew = i >= prevCount

        return (
          <ChatMessage key={msg.id || i} msg={msg} isOwn={isOwn} showAvatar={showAvatar} isNew={isNew} />
        )
      })}
    </div>
  )
})

const TypingDot = memo(({ delay }) => (
  <span
    className="h-[5px] w-[5px] rounded-full bg-muted-foreground/50"
    style={{ animation: `typing-dot 1s ease-in-out ${delay}s infinite` }}
  />
))

const GifPreviewCard = memo(({ still, animated, title, onSelect }) => {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full rounded-lg overflow-hidden cursor-pointer border-0 p-0 bg-transparent block aspect-[4/3]"
    >
      <img
        src={hovered ? animated : (still || animated)}
        alt={title || "GIF"}
        loading="lazy"
        className="w-full h-full object-cover rounded-lg block"
        style={{ background: "hsl(var(--muted) / 0.2)" }}
      />
      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
            <Play className="h-3.5 w-3.5 text-white ml-0.5" fill="white" />
          </div>
        </div>
      )}
      {hovered && (
        <div className="absolute inset-0 rounded-lg" style={{ boxShadow: "inset 0 0 0 2px hsl(var(--primary) / 0.5)" }} />
      )}
    </button>
  )
})

const GIPHY_KEY = "fNEK945T8rNeZZKqkghYw1zFKWV0Se1M"

const GifPicker = memo(({ anchorRef, toggleRef, onSelect, onClose }) => {
  const [query, setQuery] = useState("")
  const [gifs, setGifs] = useState([])
  const [trending, setTrending] = useState([])
  const [loading, setLoading] = useState(true)
  const searchTimeout = useRef(null)
  const pickerRef = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!anchorRef?.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
      width: rect.width,
    })
  }, [anchorRef])

  useEffect(() => {
    fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=30&rating=g`)
      .then((r) => r.json())
      .then((d) => setTrending(d.data || []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        (!toggleRef?.current || !toggleRef.current.contains(e.target))
      ) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose, toggleRef])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [onClose])

  const handleSearch = useCallback((value) => {
    setQuery(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!value.trim()) {
      setGifs([])
      setLoading(false)
      return
    }
    setLoading(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(value)}&limit=30&rating=g`
        )
        const data = await res.json()
        setGifs(data.data || [])
      } catch { }
      setLoading(false)
    }, 350)
  }, [])

  useEffect(() => {
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [])

  const displayGifs = query.trim() ? gifs : trending

  if (!pos) return null

  return ReactDOM.createPortal(
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="fixed flex flex-col rounded-xl overflow-hidden border border-border/30 shadow-2xl"
      style={{
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
        height: 420,
        zIndex: 9999,
        background: "hsl(var(--background))",
        boxShadow: "0 -8px 40px -8px rgba(0,0,0,0.5), 0 0 0 1px hsl(var(--border) / 0.15)",
      }}
    >
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full rounded-lg h-10 pl-9 pr-9 text-sm outline-none transition-all duration-200"
            style={{
              background: "hsl(var(--muted) / 0.5)",
              border: "1px solid hsl(var(--border) / 0.3)",
              color: "hsl(var(--foreground))",
            }}
          />
          {query ? (
            <button
              onClick={() => { setQuery(""); setGifs([]) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center cursor-pointer border-0 bg-transparent text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {!query.trim() && (
          <p className="text-[10px] text-muted-foreground/35 mt-1.5 ml-1 font-medium uppercase tracking-wider">
            Trending
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto chat-scroll-area px-3 pb-2 min-h-0">
        {loading ? (
          <div className="gif-picker-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg animate-pulse w-full aspect-[4/3]"
                style={{ background: "hsl(var(--muted) / 0.25)" }}
              />
            ))}
          </div>
        ) : displayGifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
            <ImageIcon className="h-8 w-8 text-muted-foreground/15" />
            <p className="text-xs text-muted-foreground/35">
              {query.trim() ? "No GIFs found" : "Type to search GIFs"}
            </p>
          </div>
        ) : (
          <div className="gif-picker-grid">
            {displayGifs.map((gif) => {
              const still = gif.images?.fixed_width_still?.url
              const animated = gif.images?.fixed_width?.url
              const full = gif.images?.original?.url || animated
              return (
                <GifPreviewCard
                  key={gif.id}
                  still={still}
                  animated={animated}
                  title={gif.title}
                  onSelect={() => onSelect(full)}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-center py-1.5 border-t border-border/10">
        <span className="text-[9px] text-muted-foreground/25 tracking-wider uppercase">Powered by GIPHY</span>
      </div>
    </motion.div>,
    document.body,
  )
})

const GroupChat = ({
  messages,
  currentUserId,
  onSendMessage,
  onSendGif,
  locked = false,
  typingUsers = {},
  onTypingStart,
  onTypingStop,
}) => {
  const inputRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const bottomRef = useRef(null)
  const inputAreaRef = useRef(null)
  const gifButtonRef = useRef(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const typingTimeoutRef = useRef(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: messages.length <= 1 ? "auto" : "smooth" })
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  const handleSend = useCallback(() => {
    if (locked) return
    const message = inputRef.current?.value?.trim()
    if (message) {
      onSendMessage(message)
      inputRef.current.value = ""
      onTypingStop?.()
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [onSendMessage, locked, onTypingStop])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInputChange = useCallback(() => {
    if (locked) return
    onTypingStart?.()
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop?.()
      typingTimeoutRef.current = null
    }, 2000)
  }, [locked, onTypingStart, onTypingStop])

  const handleGifSelect = useCallback(
    (fullUrl) => {
      if (locked) return
      setShowGifPicker(false)
      onSendMessage(fullUrl, "gif")
    },
    [locked, onSendMessage],
  )

  useEffect(() => {
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current) }
  }, [])

  const typingNames = Object.values(typingUsers).filter(Boolean)

  return (
    <div
      className="rounded-2xl liquid-panel flex flex-col h-full relative"
      style={{ background: "hsl(var(--background) / 0.95)" }}
    >
      {locked && <ChatLockedOverlay onUpgrade={() => setShowUpgrade(true)} />}

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/15">
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/35" />
        <span className="text-sm font-semibold tracking-tight">Chat</span>
        {locked && <Lock className="h-3 w-3 text-muted-foreground/25 ml-auto" />}
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain chat-scroll-area"
        style={{ maxHeight: "300px" }}
      >
        <MessagesList
          messages={messages}
          currentUserId={currentUserId}
          prevCountRef={prevCountRef}
        />
        <div ref={bottomRef} className="h-px" />
      </div>

      <div ref={inputAreaRef} className="px-2.5 pb-2.5 pt-1.5 border-t border-border/15">
        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-1.5 flex items-center gap-2">
                <div className="flex gap-[3px] items-center">
                  <TypingDot delay={0} />
                  <TypingDot delay={0.15} />
                  <TypingDot delay={0.3} />
                </div>
                <span className="text-[11px] text-muted-foreground/35 truncate">
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing`
                    : `${typingNames.slice(0, 2).join(", ")} are typing`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-1.5 items-center">
          <motion.button
            ref={gifButtonRef}
            whileTap={{ scale: 0.9 }}
            onClick={() => !locked && setShowGifPicker((v) => !v)}
            disabled={locked}
            className={cn(
              "shrink-0 h-9 w-9 rounded-full flex items-center justify-center cursor-pointer border-0 transition-colors duration-200",
              "hover:bg-accent/50 disabled:opacity-30 disabled:pointer-events-none",
              showGifPicker ? "bg-accent text-foreground" : "text-muted-foreground/50 bg-transparent",
            )}
          >
            <ImageIcon className="h-4 w-4" />
          </motion.button>

          <input
            ref={inputRef}
            placeholder={locked ? "PRO feature" : "Type a message..."}
            onKeyDown={handleKeyDown}
            onInput={handleInputChange}
            disabled={locked}
            className="flex-1 rounded-full h-9 px-4 text-sm liquid-input placeholder:text-muted-foreground/25 outline-none text-foreground disabled:opacity-40 transition-all duration-200"
          />

          <motion.button
            onClick={handleSend}
            disabled={locked}
            whileTap={{ scale: 0.9, transition: { duration: 0.1 } }}
            className="liquid-btn rounded-full shrink-0 h-9 w-9 cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showGifPicker && (
          <GifPicker
            anchorRef={inputAreaRef}
            toggleRef={gifButtonRef}
            onSelect={handleGifSelect}
            onClose={() => setShowGifPicker(false)}
          />
        )}
      </AnimatePresence>

      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} feature="realtimeChat" />
    </div>
  )
}

export default memo(GroupChat)
