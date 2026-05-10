import { memo, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Crown, Headphones, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const MiniEqualizer = memo(({ className }) => (
  <div className={cn("flex items-end gap-[2px]", className)}>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        animate={{ height: [3, 10, 5, 8, 3] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        className="w-[2.5px] bg-primary/50 rounded-full"
        style={{ height: 3 }}
      />
    ))}
  </div>
))

const MemberCard = memo(({ member, isCreator, isCurrentUser, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, delay: index * 0.04 }}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg",
      "transition-colors duration-150",
      "hover:bg-accent/30",
      isCurrentUser && "bg-primary/5",
    )}
  >
    <div className="relative shrink-0">
      <Avatar className="h-8 w-8 ring-[1.5px] ring-background">
        <AvatarImage src={member.profilePic} />
        <AvatarFallback className="bg-accent text-muted-foreground text-xs font-medium">
          {member.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border-[1.5px] border-background" />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-medium truncate">{member.userName}</span>
        {isCurrentUser && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal border-primary/20 text-primary leading-none">
            You
          </Badge>
        )}
      </div>
      {isCreator ? (
        <div className="flex items-center gap-1 mt-0.5">
          <Crown className="h-2.5 w-2.5 text-amber-500" />
          <span className="text-[10px] text-amber-500 font-medium">Creator</span>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground/35">Listening</span>
      )}
    </div>

    <MiniEqualizer className="h-3.5 shrink-0" />
  </motion.div>
))

const MembersList = ({ members, currentUserId, createdBy, maxMembers }) => {
  const memberCount = useMemo(() => members.length, [members.length])

  return (
    <div className="rounded-xl border border-border/30 bg-accent/5 overflow-hidden h-full flex flex-col">
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
            <span className="text-[11px] text-emerald-500 font-medium">Live</span>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono font-normal h-5 px-1.5 bg-accent/40 border-0">
            {memberCount}{maxMembers ? `/${maxMembers}` : ""}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 max-h-75">
        <div className="p-1.5 space-y-0.5">
          {members.map((member, index) => (
            <MemberCard
              key={member.userId}
              member={member}
              isCreator={member.userId === createdBy}
              isCurrentUser={member.userId === currentUserId}
              index={index}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export default memo(MembersList)
