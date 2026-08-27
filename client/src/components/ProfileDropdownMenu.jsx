import { useState, useContext, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeftRight,
  BadgeCheck,
  ChevronsUpDown,
  CreditCard,
  Laptop,
  LogOut,
  Moon,
  Sun,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { ChatContext } from '@/Context/ChatContext';
import { Context } from '@/Context/Context';
import { usePlayerStore } from '@/stores/playerStore';
import { useTheme } from '@/Context/ThemeProvider';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useAppModeStore } from '@/stores/appModeStore';
import { cn } from '@/lib/utils';

const ProfileDropdownMenu = ({ fromSidebar = true }) => {
  const { user, setUser } = useContext(Context);
  const stopSong = usePlayerStore((s) => s.stopSong);
  const { cleanUpSocket } = useContext(ChatContext);
  const { theme, setTheme } = useTheme();
  const resetMode = useAppModeStore((s) => s.resetMode);
  const navigate = useNavigate();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    try {
      const { status } = await axios.get(`${import.meta.env.VITE_API_URL}/api/logout`, {
        withCredentials: true,
      });

      if (status === 200) {
        cleanUpSocket();
        stopSong();
        setUser(null);
        navigate('/login');
      }
    } catch (error) {
      cleanUpSocket();
      stopSong();
      setUser(null);
      navigate('/login');
    }
  };

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Laptop },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {fromSidebar ? (
            <SidebarMenuButton
              size='lg'
              variant='ghost'
              className='h-12 w-full p-2 rounded-xl hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer transition-colors'
            >
              <Avatar className='h-8.5 w-8.5 rounded-full ring-1.5 ring-primary/20 shrink-0'>
                <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
                <AvatarFallback className='rounded-full bg-primary/10 text-primary text-xs font-semibold'>
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className='grid flex-1 text-left text-xs leading-tight min-w-0 pl-1'>
                <div className='flex items-center gap-1 min-w-0'>
                  <span className='truncate font-semibold text-sm'>{user.name}</span>
                  {user.verified && (
                    <BadgeCheck className='text-blue-500 fill-blue-500/20 shrink-0' size={14} />
                  )}
                </div>
                <span className='truncate text-muted-foreground text-[11px]'>
                  @{user.username || user.email?.split('@')[0]}
                </span>
              </div>
              <ChevronsUpDown className='ml-auto size-4 text-muted-foreground/70 shrink-0' />
            </SidebarMenuButton>
          ) : (
            <button
              type='button'
              className='relative rounded-full ring-2 ring-primary/20 hover:ring-primary/50 transition-all cursor-pointer focus-visible:outline-none p-0.5'
              aria-label='User profile menu'
            >
              <Avatar className='h-8.5 w-8.5 rounded-full'>
                <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
                <AvatarFallback className='rounded-full bg-primary/10 text-primary text-xs font-semibold'>
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className='w-68 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl p-2 space-y-1.5'
          side={fromSidebar ? 'top' : 'bottom'}
          align={fromSidebar ? 'start' : 'end'}
          sideOffset={8}
        >
          {/* User Identity Header */}
          <DropdownMenuLabel className='p-2 font-normal'>
            <div className='flex items-center gap-3 text-left'>
              <Avatar className='h-10 w-10 rounded-full ring-2 ring-primary/15 shrink-0'>
                <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
                <AvatarFallback className='rounded-full bg-primary/10 text-primary font-semibold'>
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col min-w-0'>
                <div className='flex items-center gap-1 min-w-0'>
                  <span className='truncate font-semibold text-sm text-foreground'>
                    {user.name}
                  </span>
                  {user.verified && (
                    <BadgeCheck className='text-blue-500 fill-blue-500/20 shrink-0' size={14} />
                  )}
                </div>
                <span className='truncate text-xs text-muted-foreground font-normal'>
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className='bg-border/60' />

          {/* Theme Segmented Control */}
          <div className='px-2 py-1.5 space-y-1.5'>
            <div className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider'>
              Theme
            </div>
            <div className='grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-xl border border-border/40'>
              {themes.map(({ value, label, icon: Icon }) => {
                const isActive = theme === value;
                return (
                  <button
                    key={value}
                    type='button'
                    onClick={(e) => {
                      e.preventDefault();
                      setTheme(value);
                    }}
                    className={cn(
                      'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      isActive
                        ? 'bg-background text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <Icon size={13} className={isActive ? 'text-primary' : ''} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <DropdownMenuSeparator className='bg-border/60' />

          {/* Nav Actions */}
          <DropdownMenuGroup className='space-y-0.5'>
            <DropdownMenuItem
              onClick={() => navigate('/profile')}
              className='gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer'
            >
              <User size={15} className='text-muted-foreground' />
              <span>Profile & Settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => navigate('/payments/history')}
              className='gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer'
            >
              <CreditCard size={15} className='text-muted-foreground' />
              <span>Payment History</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={resetMode}
              className='gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer'
            >
              <ArrowLeftRight size={15} className='text-muted-foreground' />
              <span>Switch Mode</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className='bg-border/60' />

          {/* Logout Action */}
          <DropdownMenuItem
            onClick={() => setIsLogoutOpen(true)}
            className='gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive cursor-pointer'
          >
            <LogOut size={15} />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={isLogoutOpen} onOpenChange={setIsLogoutOpen}>
        <AlertDialogContent className='max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-lg font-semibold'>
              Log out of SyncVibe?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-sm text-muted-foreground'>
              You will be signed out of your current session. You will need to log back in to access
              your playlists, chats, and custom settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='gap-2 sm:gap-0 mt-4'>
            <AlertDialogCancel className='rounded-xl h-9 text-xs font-medium cursor-pointer'>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className='rounded-xl h-9 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer'
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(ProfileDropdownMenu);
