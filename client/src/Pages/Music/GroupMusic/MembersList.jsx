import { memo, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Crown } from "lucide-react"
import { cn } from "@/lib/utils"

const MemberItem = memo(({ member, isCreator, isCurrentUser }) => (
  <div
    className={cn(
      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
      "transition-colors duration-150",
      "hover:bg-accent/40",
      isCurrentUser && "bg-accent/30",
    )}
  >
    <div className="relative shrink-0">
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.profilePic} />
        <AvatarFallback className="bg-accent text-muted-foreground text-xs">
          {member.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium truncate">{member.userName}</span>
        {isCurrentUser && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal border-border/50">
            You
          </Badge>
        )}
      </div>
      {isCreator && (
        <div className="flex items-center gap-1 mt-0.5">
          <Crown className="h-2.5 w-2.5 text-amber-500/70" />
          <span className="text-[10px] text-amber-500/70">Creator</span>
        </div>
      )}
    </div>
  </div>
))

const MembersList = ({ members, currentUserId, createdBy, maxMembers }) => {
  const memberCount = useMemo(() => members.length, [members.length])

  return (
    <div className="rounded-xl border border-border/40 bg-accent/10 overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-sm font-medium">Members</span>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5 bg-accent/50">
          {memberCount}{maxMembers ? `/${maxMembers}` : ""}
        </Badge>
      </div>

      <ScrollArea className="flex-1 max-h-[280px]">
        <div className="p-1.5 space-y-0.5">
          {members.map((member) => (
            <MemberItem
              key={member.userId}
              member={member}
              isCreator={member.userId === createdBy}
              isCurrentUser={member.userId === currentUserId}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export default memo(MembersList)
