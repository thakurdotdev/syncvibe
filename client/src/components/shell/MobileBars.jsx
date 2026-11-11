import { Search } from 'lucide-react';
import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProfileDropdownMenu from '@/components/ProfileDropdownMenu';
import { paths } from '@/lib/paths';
import { useChatStore } from '@/stores/chatStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { LOGO_URL } from './nav';

/**
 * The tab bar steps aside when a screen needs the bottom edge for its own input:
 * an open conversation, or an active room (which has its own tabs and composer).
 */
export const useTabBarVisible = () => {
  const { pathname } = useLocation();
  const currentChat = useChatStore((s) => s.activeId != null);
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  if (pathname.startsWith(paths.messages) && currentChat) return false;
  if (pathname.startsWith(paths.rooms) && inRoom) return false;
  return true;
};

export const MobileTopBar = memo(() => {
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  return (
    <header className='flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4'>
      <Link to={paths.home} className='flex items-center gap-2' aria-label='SyncVibe home'>
        <img src={LOGO_URL} alt='' className='h-7 w-7 rounded-full' />
        <span className='font-display text-lg font-bold tracking-tight'>SyncVibe</span>
      </Link>
      <div className='flex items-center gap-1.5'>
        <button
          type='button'
          onClick={() => setSearchOpen(true)}
          aria-label='Search music'
          className='grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground'
        >
          <Search className='h-[18px] w-[18px]' />
        </button>
        <ProfileDropdownMenu fromSidebar={false} />
      </div>
    </header>
  );
});
