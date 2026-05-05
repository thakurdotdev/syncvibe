import { memo, useCallback, useEffect, useMemo, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Check, Loader2, Search, UserPlus, Users, X } from "lucide-react"
import { useSocket } from "@/Context/ChatContext"
import axios from "axios"
import _ from "lodash"
import { motion, AnimatePresence } from "framer-motion"

const UserItem = memo(({ user, isOnline, onInvite, isInvited, isInGroup }) => {
  const handleInvite = useCallback(() => {
    if (!isInvited && !isInGroup) onInvite(user.userid)
  }, [user.userid, onInvite, isInvited, isInGroup])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
        !isInvited && !isInGroup ? "cursor-pointer hover:bg-muted/80 active:scale-[0.98]" : "cursor-default",
      )}
      onClick={handleInvite}
    >
      {/* Avatar with Ring */}
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10 border-2 border-border/50 group-hover:border-primary/30 transition-colors shadow-sm">
          <AvatarImage src={user.profilepic} className="object-cover" />
          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
            {user.name?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card shadow-sm",
            isOnline ? "bg-emerald-500" : "bg-muted-foreground/30",
          )}
        />
      </div>

      {/* Info with better typography */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold truncate text-foreground/90">{user.name}</span>
          {user.isFollowing && (
            <Badge
              variant="secondary"
              className="text-[9px] h-4 px-1.5 font-bold rounded-full bg-primary/10 text-primary border-none uppercase tracking-wider"
            >
              Following
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground/70 font-medium truncate mt-0.5">
          @{user.username}
          {isOnline && (
            <span className="ml-2 text-emerald-500 font-bold">· online</span>
          )}
        </p>
      </div>

      {/* Action with better states */}
      <div className="shrink-0 ml-2">
        {isInGroup ? (
          <Badge variant="outline" className="text-[10px] font-bold h-6 px-2 text-muted-foreground/60 border-muted/50">
            In group
          </Badge>
        ) : isInvited ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
            <Check className="h-3.5 w-3.5 stroke-[3px]" />
            <span className="text-[11px] font-bold">Sent</span>
          </div>
        ) : (
          <Button
            onClick={(e) => { e.stopPropagation(); handleInvite() }}
            variant="outline"
            size="sm"
            className="h-8 px-4 text-xs font-bold rounded-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Invite
          </Button>
        )}
      </div>
    </motion.div>
  )
})

const LoadingState = memo(() => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    <p className="text-sm text-muted-foreground">Looking for friends…</p>
  </div>
))

const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
      <Users className="h-5 w-5 text-muted-foreground" />
    </div>
    <div>
      <p className="text-sm font-medium">No friends yet</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        Search by name to invite someone to your session
      </p>
    </div>
  </div>
))

const NoResultsState = memo(() => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
      <UserPlus className="h-5 w-5 text-muted-foreground" />
    </div>
    <div>
      <p className="text-sm font-medium">No results</p>
      <p className="text-xs text-muted-foreground mt-1">
        Try a different name or username
      </p>
    </div>
  </div>
))

const InviteSheet = ({ isOpen, onClose, groupMembers, sendInvite }) => {
  const { onlineStatuses } = useSocket()
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [invitedUsers, setInvitedUsers] = useState(new Set())
  const [hasSearched, setHasSearched] = useState(false)

  const memberIds = useMemo(
    () => new Set(groupMembers?.map((m) => m.userId) || []),
    [groupMembers],
  )

  const fetchUsers = useCallback(async (query) => {
    try {
      setIsLoading(true)
      const params = query?.trim() ? `?search=${encodeURIComponent(query.trim())}` : ""
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/user/invite-list${params}`,
        { withCredentials: true },
      )
      setUsers(response.data?.users || [])
      setHasSearched(true)
    } catch {
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchUsers("")
      setInvitedUsers(new Set())
      setSearchQuery("")
      setHasSearched(false)
    }
  }, [isOpen, fetchUsers])

  const debouncedSearch = useMemo(
    () => _.debounce((query) => fetchUsers(query), 400),
    [fetchUsers],
  )

  const handleSearchChange = useCallback(
    (e) => {
      const val = e.target.value
      setSearchQuery(val)
      debouncedSearch(val)
    },
    [debouncedSearch],
  )

  const handleInvite = useCallback(
    (userId) => {
      setInvitedUsers((prev) => new Set(prev).add(userId))
      sendInvite(userId)
    },
    [sendInvite],
  )

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aOnline = onlineStatuses?.[a.userid] ? 1 : 0
      const bOnline = onlineStatuses?.[b.userid] ? 1 : 0
      const aFollow = a.isFollowing ? 1 : 0
      const bFollow = b.isFollowing ? 1 : 0
      if (aFollow !== bFollow) return bFollow - aFollow
      if (aOnline !== bOnline) return bOnline - aOnline
      return 0
    })
  }, [users, onlineStatuses])

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-sm p-0 flex flex-col">

        {/* Header */}
        <SheetHeader className="px-6 pt-7 pb-5 space-y-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl font-bold tracking-tight">Invite Friends</SheetTitle>
              <SheetDescription className="text-xs font-medium text-muted-foreground/80 mt-1">
                Bring your circle into the sync
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onClose(false)}
              className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted active:scale-90 transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative pt-6">
            <Search className="absolute left-3.5 top-[calc(50%+12px)] -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-all rounded-xl"
              autoFocus
            />
          </div>
        </SheetHeader>

        <div className="px-6">
          <Separator className="bg-border/40" />
        </div>

        {/* User list */}
        <ScrollArea className="flex-1">
          <div className="px-3 py-2">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <LoadingState key="loading" />
              ) : !hasSearched && users.length === 0 ? (
                <EmptyState key="empty" />
              ) : users.length === 0 ? (
                <NoResultsState key="no-results" />
              ) : (
                <motion.div key="list" className="space-y-0.5">
                  {sortedUsers.map((user) => (
                    <UserItem
                      key={user.userid}
                      user={user}
                      isOnline={!!onlineStatuses?.[user.userid]}
                      onInvite={handleInvite}
                      isInvited={invitedUsers.has(user.userid)}
                      isInGroup={memberIds.has(user.userid)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export default memo(InviteSheet)