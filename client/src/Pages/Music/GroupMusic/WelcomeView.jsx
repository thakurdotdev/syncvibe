import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Users, Radio, MessageCircle, Plus, LogIn } from "lucide-react"

const WelcomeView = ({ onOpenModal }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-220px)] sm:min-h-[calc(100vh-200px)] px-4">
      <div className="max-w-lg w-full flex flex-col items-center text-center">
        <div className="relative mb-8">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-background">
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
          Group Music Session
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base mb-10 max-w-sm leading-relaxed">
          Create or join a group to listen together, perfectly synchronized across all devices.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-12 w-full sm:w-auto">
          <Button
            onClick={() => onOpenModal("create")}
            size="lg"
            className="rounded-full px-8 gap-2 w-full sm:w-auto text-sm"
          >
            <Plus className="h-4 w-4" />
            Create Group
          </Button>
          <Button
            onClick={() => onOpenModal("join")}
            variant="outline"
            size="lg"
            className="rounded-full px-8 gap-2 w-full sm:w-auto text-sm"
          >
            <LogIn className="h-4 w-4" />
            Join Group
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6 sm:gap-10 w-full max-w-sm">
          <div className="flex flex-col items-center gap-2.5">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-muted/30 border border-border/20 flex items-center justify-center">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium">Listen</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Together</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2.5">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-muted/30 border border-border/20 flex items-center justify-center">
              <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium">Perfect</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Sync</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2.5">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-muted/30 border border-border/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium">Group</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Chat</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(WelcomeView)
