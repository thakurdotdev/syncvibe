import { MotionConfig, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { memo, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProfileDropdownMenu from '@/components/ProfileDropdownMenu';
import { ChatContext } from '@/Context/ChatContext';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { LOGO_URL, NAV_ITEMS } from './nav';
import { useChatSummary } from './useShellData';

/**
 * The tab bar steps aside when a screen needs the bottom edge for its own input:
 * an open conversation, or an active room (which has its own tabs and composer).
 */
export const useTabBarVisible = () => {
  const { pathname } = useLocation();
  const currentChat = useContext(ChatContext)?.currentChat;
  const inRoom = Boolean(useGroupMusic().currentGroup);
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

export const MobileTabBar = memo(() => {
  const { pathname } = useLocation();
  const { unread } = useChatSummary();
  const inRoom = Boolean(useGroupMusic().currentGroup);

  return (
    <MotionConfig reducedMotion='user'>
      <nav
        aria-label='Main'
        className='fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden'
      >
        <div className='flex h-16 items-stretch'>
          {NAV_ITEMS.map(({ key, label, icon: Icon, path, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={key}
                to={path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors active:scale-95',
                  active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
                )}
              >
                <span className='relative grid h-7 w-12 place-items-center'>
                  {active && (
                    <motion.span
                      layoutId='tabbar-active'
                      transition={{ type: 'spring', stiffness: 560, damping: 40, mass: 0.7 }}
                      className='absolute inset-0 rounded-full bg-primary/15'
                    />
                  )}
                  <Icon
                    className={cn('relative h-5 w-5', active && 'text-primary')}
                    strokeWidth={active ? 2.25 : 1.9}
                  />
                  {key === 'rooms' && inRoom && (
                    <span className='live-dot absolute right-2 top-0.5 h-2 w-2 rounded-full bg-live' />
                  )}
                  {key === 'messages' && unread > 0 && (
                    <span className='absolute -top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground'>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </MotionConfig>
  );
});
