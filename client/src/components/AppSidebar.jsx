import {
  Check,
  Crown,
  History,
  Home,
  ListMusic,
  Music,
  NotebookPen,
  Search,
  Send,
  User,
  Users,
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
import LazyImage from "./LazyImage"
import ProfileDropdownMenu from "./ProfileDropdownMenu"

const menuItems = [
  { name: "Home", icon: Home, path: "/feed" },
  { name: "Search", icon: Search, path: "/post/search" },
  { name: "Post", icon: NotebookPen, path: "/my/posts" },
  { name: "Music", icon: Music, path: "/music" },
  { name: "My Playlist", icon: ListMusic, path: "/music/my-playlist" },
  { name: "History", icon: History, path: "/music/history" },
  { name: "Group Music", icon: Users, path: "/music/sync" },
  { name: "Messages", icon: Send, path: "/chat" },
  { name: "Profile", icon: User, path: "/profile" },
]

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entitlement } = useEntitlementQuery()

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
          <span className="text-lg font-semibold">SyncVibe</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarMenu className="space-y-0.5">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    size="md"
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "relative px-3 py-2.5 rounded-lg",
                      "hover:bg-muted/60",
                      isActive && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        className={cn(
                          "h-5 w-5",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm",
                          isActive ? "font-semibold text-primary" : "font-medium",
                        )}
                      >
                        {item.name}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-3 space-y-3">
        {isPro ? (
          <div className="w-full p-3 rounded-lg bg-gradient-to-r from-yellow-500/20 to-yellow-500/10">
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
            className="w-full p-3 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 transition-all duration-200 group"
          >
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Upgrade to PRO</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-left">Unlock all features</p>
          </button>
        )}
        <ProfileDropdownMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
