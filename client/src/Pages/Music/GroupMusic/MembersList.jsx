import { memo, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Crown, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"

// Memoized Member Item
const MemberItem = memo(({ member, isCreator, isCurrentUser }) => (
  <div
    className={cn(
      "flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg md:rounded-xl",
      "hover:bg-accent/50 transition-all duration-200",
      "group cursor-default",
      isCurrentUser && "bg-primary/5 border border-primary/20",
    )}
  >
    {/* Avatar with online indicator */}
    <div className="relative">
      <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-offset-1 md:ring-offset-2 ring-offset-background ring-primary/10">
        <AvatarImage src={member.profilePic} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs md:text-sm">
          {member.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="absolute bottom-0 right-0 h-2 w-2 md:h-3 md:w-3 rounded-full bg-green-500 border-2 border-background" />
    </div>

    {/* Member Info */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 md:gap-2">
        <span
          className={cn(
            "font-medium truncate text-sm md:text-base",
            "group-hover:text-primary transition-colors",
          )}
        >
          {member.userName}
        </span>
        {isCurrentUser && (
          <Badge variant="outline" className="text-[10px] md:text-xs shrink-0 px-1.5">
            You
          </Badge>
        )}
      </div>
      {isCreator && (
        <div className="flex items-center gap-1 text-[10px] md:text-xs text-amber-500/80 mt-0.5">
          <Crown className="h-2.5 w-2.5 md:h-3 md:w-3" />
          <span className="hidden sm:inline">Group Creator</span>
          <span className="sm:hidden">Creator</span>
        </div>
      )}
    </div>

    {/* Sync indicator */}
    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <Wifi className="h-4 w-4 text-green-500" />
    </div>
  </div>
))

// Main MembersList Component
const MembersList = ({ members, currentUserId, createdBy, maxMembers }) => {
  const memberCount = useMemo(() => members.length, [members.length])

  return (
    <Card className="h-full border-border/50 shadow-lg overflow-hidden">
      <CardHeader className="py-2 md:pb-3 px-3 md:px-6 border-b border-border/50">
        <CardTitle className="text-sm md:text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 md:p-1.5 rounded-full bg-primary/10">
              <Users className="h-3 w-3 md:h-4 md:w-4 text-primary" />
            </div>
            Members
          </div>
          <Badge variant="secondary" className="font-normal text-xs">
            {memberCount}
            {maxMembers ? `/${maxMembers}` : ""}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="flex-1 p-2 md:p-4 max-h-[350px]">
          <div className="p-2 md:p-4 space-y-1 md:space-y-2">
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
      </CardContent>
    </Card>
  )
}

export default memo(MembersList)
