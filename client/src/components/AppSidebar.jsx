import { ChevronRight } from "lucide-react";
import { Home, Music, NotebookPen, Search, Send, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import ProfileDropdownMenu from "./ProfileDropdownMenu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { TrendingUp } from "lucide-react";
import { ListMusic } from "lucide-react";
import LazyImage from "./LazyImage";
import { Users } from "lucide-react";

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: "Home", icon: Home, path: "/feed" },
    { name: "Search", icon: Search, path: "/post/search" },
    { name: "Post", icon: NotebookPen, path: "/my/posts" },
    {
      name: "Music",
      icon: Music,
      path: "/music",
    },
    { name: "My Playlist", icon: ListMusic, path: "/music/my-playlist" },
    { name: "Group Music", icon: Users, path: "/music/sync" },
    { name: "Messages", icon: Send, path: "/chat" },
    { name: "Profile", icon: User, path: "/profile" },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center mx-auto gap-3">
          <LazyImage
            src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
            alt="SyncVibe"
            className="h-8 w-8"
            height={32}
            width={32}
          />
          <span className="text-xl">SyncVibe</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="mt-[50px]">
        <SidebarGroup>
          <SidebarMenu>
            {menuItems.map((item) =>
              item.items ? (
                <Collapsible
                  key={item.name}
                  asChild
                  defaultOpen={location.pathname.startsWith(item.path)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        isActive={location.pathname.startsWith(item.path)}
                        tooltip={item.name}
                      >
                        <item.icon />
                        <span>{item.name}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.name}>
                            <SidebarMenuSubButton
                              className="cursor-pointer mb-3"
                              size="lg"
                              onClick={() => {
                                navigate(subItem.path);
                                if (isMobile) {
                                  setOpenMobile(false);
                                }
                              }}
                              isActive={location.pathname === subItem.path}
                            >
                              <subItem.icon />
                              <span>{subItem.name}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.name} className="mb-2">
                  <SidebarMenuButton
                    size="lg"
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) {
                        setOpenMobile(false);
                      }
                    }}
                    isActive={location.pathname === item.path}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ProfileDropdownMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
