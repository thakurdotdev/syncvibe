import { useState, useMemo, memo } from "react"
import { ChevronLeft, ChevronRight, Globe, MapPin, Monitor, ShieldCheck, Smartphone, Laptop } from "lucide-react"
import { TimeAgo } from "../../Utils/TimeAgo"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"

const ITEMS_PER_PAGE = 5

const getDeviceIcon = (os = "") => {
  const osLower = os.toLowerCase()
  if (osLower.includes("android") || osLower.includes("ios") || osLower.includes("iphone")) {
    return <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
  }
  if (osLower.includes("mac") || osLower.includes("windows") || osLower.includes("linux")) {
    return <Laptop className="h-4 w-4 text-muted-foreground shrink-0" />
  }
  return <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
}

const LoginLogItem = memo(({ log }) => {
  const browser = log?.browser || "Unknown Browser"
  const os = log?.os || "Unknown OS"
  const ip = log?.ipaddress || "Unknown IP"
  const location = log?.location || "Location unavailable"
  const loginType = log?.loginType || "password"

  return (
    <div className="p-4 transition-colors hover:bg-muted/30 flex flex-col gap-2.5">
      {/* Top Details Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Successful Login" />
          <div className="flex items-center gap-1.5 min-w-0">
            {getDeviceIcon(os)}
            <span className="text-sm font-semibold text-foreground truncate">
              {browser} <span className="text-muted-foreground font-normal">• {os}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-muted/50 border-border/70 text-muted-foreground"
          >
            {loginType}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {TimeAgo(log.createdAt)}
          </span>
        </div>
      </div>

      {/* Bottom Metadata Row: IP & Location */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground pl-4.5">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span className="font-mono text-[11.5px] tabular-nums text-foreground/80">{ip}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span className="text-foreground/80">{location}</span>
        </div>
      </div>
    </div>
  )
})

LoginLogItem.displayName = "LoginLogItem"

const LoginLogs = ({ isOpen, toggleDialog, loginLogs = [] }) => {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(loginLogs.length / ITEMS_PER_PAGE))

  // Reset page when dialog opens/closes
  const handleOpenChange = (open) => {
    if (!open) setCurrentPage(1)
    toggleDialog()
  }

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return loginLogs.slice(start, start + ITEMS_PER_PAGE)
  }, [loginLogs, currentPage])

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, loginLogs.length)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold">Login Activity</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Recent sign-in events and authorized sessions for your SyncVibe account.
          </DialogDescription>
        </DialogHeader>

        {/* Content Area */}
        <div className="p-6">
          {loginLogs.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-foreground">No login activity recorded</p>
              <p className="text-xs text-muted-foreground">
                Your future login sessions and device history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Logs List Container */}
              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden bg-background/40">
                {paginatedLogs.map((log) => (
                  <LoginLogItem key={log.loginlogid || `${log.ipaddress}-${log.createdAt}`} log={log} />
                ))}
              </div>

              {/* Pagination Controls */}
              {loginLogs.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-2 px-1">
                  <span className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{startIndex}–{endIndex}</span> of{" "}
                    <span className="font-semibold text-foreground">{loginLogs.length}</span> sessions
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                      title="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-xs font-medium text-foreground px-2 tabular-nums">
                      Page {currentPage} of {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default memo(LoginLogs)
