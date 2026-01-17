import React from "react"
import { Clock, Globe, Monitor, MapPin, Shield, Check, AlertTriangle } from "lucide-react"
import { TimeAgo } from "../../Utils/TimeAgo"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "@/lib/utils"
import { ShieldCheck } from "lucide-react"

const LoginLogItem = ({ log }) => {
  const isSuspiciousLogin = (log) => {
    // Placeholder for suspicious login detection logic
    return false // Update with your logic
  }

  const suspicious = isSuspiciousLogin(log)
  const deviceInfo = `${log?.browser || "Unknown"} ${log?.os ? `• ${log?.os}` : ""}`

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border transition-shadow",
        suspicious
          ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 shadow"
          : "bg-white dark:bg-background border-border hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between p-4">
        <div className="flex items-center space-x-3">
          {suspicious ? (
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-green-500 dark:text-green-400" />
          )}
          <div>
            <h3 className="text-sm font-semibold">
              {suspicious ? "Suspicious Login" : "Successful Login"}
            </h3>
            <p className="text-xs text-muted-foreground">{TimeAgo(log.createdAt)}</p>
          </div>
        </div>
        {log?.loginType && (
          <div className="text-xs text-muted-foreground">
            <span className="capitalize">{log?.loginType}</span>
          </div>
        )}
      </div>
      <div className="p-4 pt-0 text-xs">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <span>{deviceInfo}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span>{log.ipaddress || "Unknown"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{log.location || "Unavailable"}</span>
          </div>
        </div>
      </div>

      {suspicious && (
        <div className="bg-red-100 dark:bg-red-950 p-3 text-xs border-t border-red-200 dark:border-red-800 text-muted-foreground">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
            <span>Additional investigation may be required for this login attempt.</span>
          </div>
        </div>
      )}
    </div>
  )
}

const LoginLogs = ({ isOpen, toggleDialog, loginLogs }) => {
  return (
    <Dialog open={isOpen} onOpenChange={toggleDialog}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security Logs
          </DialogTitle>
          <DialogDescription>Review recent account activity and login attempts.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          {loginLogs.length > 0 ? (
            <div className="space-y-3">
              {loginLogs.map((log) => (
                <LoginLogItem key={log.loginlogid} log={log} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No login activity to display.</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default LoginLogs
