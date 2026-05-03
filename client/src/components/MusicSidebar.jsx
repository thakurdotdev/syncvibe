import {
  Check,
  Crown,
  History,
  Home,
  ListMusic,
  Users,
  ArrowLeftRight,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useEntitlementQuery } from "@/hooks/queries/useEntitlementQuery"
import { cn } from "@/lib/utils"
import { useAppModeStore } from "@/stores/appModeStore"
import LazyImage from "./LazyImage"
import ProfileDropdownMenu from "./ProfileDropdownMenu"

const navItems = [
  { name: "Home", icon: Home, path: "/music" },
  { name: "My Playlists", icon: ListMusic, path: "/music/my-playlist" },
  { name: "History", icon: History, path: "/music/history" },
  { name: "Group Sync", icon: Users, path: "/music/sync" },
]

export function MusicSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entitlement } = useEntitlementQuery()
  const resetMode = useAppModeStore((s) => s.resetMode)

  const isPro = entitlement?.plan?.code === "PRO"

  const handleNavigate = (path) => {
    navigate(path)
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar className="border-r border-border/40">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <LazyImage
            src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
            alt="SyncVibe"
            className="h-8 w-8"
            height={32}
            width={32}
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold">SyncVibe</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Music
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarMenu className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    size="md"
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "px-3 py-2.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-primary")} />
                    <span className={cn("text-[13px]", isActive ? "font-semibold" : "font-medium")}>
                      {item.name}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-3 space-y-2">
        {isPro ? (
          <div className="w-full p-3 rounded-lg bg-linear-to-r from-yellow-500/20 to-yellow-500/10">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">PRO Member</span>
              <Check className="h-4 w-4 text-green-500 ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">All features unlocked</p>
          </div>
        ) : (
          <button
            onClick={() => handleNavigate("/plans")}
            className="w-full p-3 rounded-lg bg-linear-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Upgrade to PRO</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-left">Unlock all features</p>
          </button>
        )}

        <button
          onClick={resetMode}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Switch to Full Mode
        </button>

        <ProfileDropdownMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
