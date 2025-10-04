import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { ChatContext } from '@/Context/ChatContext';
import { Context } from '@/Context/Context';
import { usePlayer } from '@/Context/PlayerContext';
import { useTheme } from '@/Context/ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import axios from 'axios';
import { BadgeCheck, ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';

const ProfileDropdownMenu = ({ fromSidebar = true }) => {
  const { user, setUser } = useContext(Context);
  const { stopSong } = usePlayer();
  const { cleanUpSocket } = useContext(ChatContext);
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { status } = await axios.get(`${import.meta.env.VITE_API_URL}/api/logout`, {
        withCredentials: true,
      });

      if (status === 200) {
        cleanUpSocket();
        stopSong();
        setUser(null);
      }
    } catch (error) {
      cleanUpSocket();
      stopSong();
      setUser(null);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size='sm'
          variant='ghost'
          className={cn(
            'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-10 md:p-2',
            !fromSidebar && 'rounded-full h-10 w-10'
          )}
        >
          <Avatar className={`h-8 w-8 ${fromSidebar ? '' : 'rounded-full'}`}>
            <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
            <AvatarFallback className='rounded-lg'>
              {user.name[0]}
              {user.name[1]}
            </AvatarFallback>
          </Avatar>
          {fromSidebar && (
            <>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>{user.name}</span>
                <span className='truncate text-xs'>{user.email}</span>
              </div>
              <ChevronsUpDown className='ml-auto size-4' />
            </>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
        side='bottom'
        align='end'
        sideOffset={4}
      >
        <DropdownMenuLabel className='p-0 font-normal'>
          <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
            <Avatar className='h-10 w-10'>
              <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
              <AvatarFallback className='rounded-lg'>CN</AvatarFallback>
            </Avatar>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-semibold'>{user.name}</span>
              <span className='truncate text-xs'>{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              toggleTheme();
            }}
            className='cursor-pointer'
          >
            {isDark ? <Sun /> : <Moon />}
            {isDark ? 'Light' : 'Dark'} mode
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              navigate('/profile');
            }}
            className='cursor-pointer'
          >
            <BadgeCheck />
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className='cursor-pointer'>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdownMenu;
