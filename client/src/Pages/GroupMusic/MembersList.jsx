import { memo, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Crown, Headphones, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"

const MiniEqualizer = memo(({ className }) => (
  <div className={cn("flex items-end gap-[2px]", className)}>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        animate={{ height: [3, 10, 5, 8, 3] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        className="w-[2.5px] bg-primary/40 rounded-full"
        style={{ height: 3 }}
      />
    ))}
  </div>
))

const MemberCard = memo(({ member, isCreator, isCurrentUser }) => (
  <motion.div
    layout
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: "auto" }}
    exit={{ opacity: 0, height: 0 }}
    transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-xl",
      "transition-colors duration-200",
      "liquid-hover-row",
      isCurrentUser && "bg-accent/20",
    )}
  >
    <div className="relative shrink-0">
      <Avatar className="h-8 w-8 ring-[1.5px] ring-border/40">
        <AvatarImage src={member.profilePic} />
        <AvatarFallback className="bg-accent text-muted-foreground text-xs font-medium">
          {member.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background"
        style={{ boxShadow: "0 0 6px rgba(16,185,129,0.4)" }}
      />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-medium truncate">{member.userName}</span>
        {isCurrentUser && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full liquid-badge text-primary font-medium leading-none">
            You
          </span>
        )}
      </div>
      {isCreator ? (
        <div className="flex items-center gap-1 mt-0.5">
          <Crown className="h-2.5 w-2.5 text-amber-400" />
          <span className="text-[10px] text-amber-400 font-medium">Creator</span>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground/50">Listening</span>
      )}
    </div>
  </motion.div>
))

const MembersList = ({ members, currentUserId, createdBy, maxMembers }) => {
  const memberCount = useMemo(() => members.length, [members.length])

  return (
    <div className="rounded-2xl liquid-panel overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-sm font-semibold">Listeners</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">Live</span>
          </div>
          <span className="text-[10px] font-mono font-normal h-5 px-2 liquid-badge rounded-full flex items-center justify-center text-muted-foreground">
            {memberCount}
            {maxMembers ? `/${maxMembers}` : ""}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 max-h-75">
        <div className="p-1.5 space-y-0.5">
          <AnimatePresence initial={false}>
            {members.map((member) => (
              <MemberCard
                key={member.userId}
                member={member}
                isCreator={member.userId === createdBy}
                isCurrentUser={member.userId === currentUserId}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}

export default memo(MembersList)
