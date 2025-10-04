import { Home, Music, NotebookPen, Search, Send, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

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
} from '@/components/ui/sidebar';
import { ListMusic, Users } from 'lucide-react';
import LazyImage from './LazyImage';
import ProfileDropdownMenu from './ProfileDropdownMenu';

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'Home', icon: Home, path: '/feed' },
    { name: 'Search', icon: Search, path: '/post/search' },
    { name: 'Post', icon: NotebookPen, path: '/my/posts' },
    {
      name: 'Music',
      icon: Music,
      path: '/music',
    },
    { name: 'My Playlist', icon: ListMusic, path: '/music/my-playlist' },
    { name: 'Group Music', icon: Users, path: '/music/sync' },
    { name: 'Messages', icon: Send, path: '/chat' },
    { name: 'Profile', icon: User, path: '/profile' },
  ];

  return (
    <Sidebar className='border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <SidebarHeader>
        <div className='flex items-center mx-auto gap-3'>
          <LazyImage
            src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp'
            alt='SyncVibe'
            className='h-8 w-8'
            height={32}
            width={32}
          />
          <span className='text-xl'>SyncVibe</span>
        </div>
      </SidebarHeader>

      <SidebarContent className='px-2 py-6'>
        <SidebarGroup>
          <SidebarMenu className='space-y-1'>
            {menuItems.map((item, index) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  size='md'
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) {
                      setOpenMobile(false);
                    }
                  }}
                  isActive={location.pathname === item.path}
                  className='group relative hover:bg-accent/50 px-3'
                >
                  <div className='flex items-center gap-3 w-full'>
                    <div className='relative'>
                      <item.icon className='h-5 w-5' />
                      {location.pathname === item.path && (
                        <>
                          <div className='absolute -inset-1 bg-primary/20 rounded-lg blur-sm -z-10' />
                          <div className='absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full' />
                        </>
                      )}
                    </div>
                    <span className='font-medium'>{item.name}</span>
                  </div>
                  {location.pathname === item.path && (
                    <div className='absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl' />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className='border-t border-border/40 pt-4 pb-4'>
        <div className='px-3'>
          <ProfileDropdownMenu />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
