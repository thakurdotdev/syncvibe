import { memo, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Crown, Headphones, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const MemberCard = memo(({ member, isCreator, isCurrentUser, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, delay: index * 0.05 }}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl",
      "transition-colors duration-200",
      "hover:bg-accent/40",
      isCurrentUser && "bg-primary/5 ring-1 ring-primary/10",
    )}
  >
    <div className="relative shrink-0">
      <Avatar className="h-9 w-9 ring-2 ring-background">
        <AvatarImage src={member.profilePic} />
        <AvatarFallback className="bg-accent text-muted-foreground text-sm font-medium">
          {member.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium truncate">{member.userName}</span>
        {isCurrentUser && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal border-primary/20 text-primary">
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
        <div className="flex items-center gap-1 mt-0.5">
          <Headphones className="h-2.5 w-2.5 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/40">Listening</span>
        </div>
      )}
    </div>

    <div className="flex items-center gap-0.5 shrink-0">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ height: [3, 10, 5, 8, 3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          className="w-[2px] bg-primary/40 rounded-full"
          style={{ height: 3 }}
        />
      ))}
    </div>
  </motion.div>
))

const MembersList = ({ members, currentUserId, createdBy, maxMembers }) => {
  const memberCount = useMemo(() => members.length, [members.length])

  return (
    <div className="rounded-xl border border-border/30 bg-accent/10 backdrop-blur-sm overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground/60" />
          <span className="text-sm font-semibold">Listeners</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-500 font-medium">Live</span>
          </div>
          <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5 bg-accent/50">
            {memberCount}{maxMembers ? `/${maxMembers}` : ""}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 max-h-75">
        <div className="p-2 space-y-0.5">
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
