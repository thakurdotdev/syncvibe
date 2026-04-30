import { Home, Music, ListMusic, Send, History, Users } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAppModeStore } from "@/stores/appModeStore"
import { cn } from "@/lib/utils"

const normalMenuItems = [
  { name: "Home", icon: Home, path: "/feed" },
  { name: "Music", icon: Music, path: "/music" },
  { name: "Playlists", icon: ListMusic, path: "/music/my-playlist" },
  { name: "Messages", icon: Send, path: "/chat" },
]

const musicMenuItems = [
  { name: "Home", icon: Home, path: "/music" },
  { name: "Playlists", icon: ListMusic, path: "/music/my-playlist" },
  { name: "History", icon: History, path: "/music/history" },
  { name: "Sync", icon: Users, path: "/music/sync" },
]

const MobileBottomBar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = useAppModeStore((s) => s.mode)

  const menuItems = mode === "music" ? musicMenuItems : normalMenuItems

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
      <div className="h-[1px] bg-border/60" />
      <div className="bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-around h-14 px-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path

            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground active:text-foreground",
                )}
              >
                <item.icon
                  className={cn("h-5 w-5", isActive && "stroke-[2.5px]")}
                />
                <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>
                  {item.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MobileBottomBar
