import { PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ProfileDropdownMenu from '@/components/ProfileDropdownMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { useUserPlaylistsQuery } from '@/hooks/queries/usePlaylistQueries';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { getPlaylistImageUrl } from '@/Pages/Music/Cards';
import { useUiStore } from '@/stores/uiStore';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { LOGO_URL, NAV_ITEMS } from './nav';
import { LiveRoom, NowPlayingDock } from './SidebarLive';
import { useChatSummary } from './useShellData';

const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

/** Wraps rail items in a tooltip so icon-only buttons still announce where they go. */
const RailTip = ({ show, label, children }) =>
  show ? (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side='right' sideOffset={10} className='text-xs'>
        {label}
      </TooltipContent>
    </Tooltip>
  ) : (
    children
  );

const SectionHeading = ({ children, action }) => (
  <div className='flex items-center justify-between px-2.5 pb-1.5'>
    <h2 className='font-sans text-xs font-medium tracking-normal text-muted-foreground'>
      {children}
    </h2>
    {action}
  </div>
);

const NavList = ({ collapsed, unread }) => {
  const { pathname } = useLocation();
  const inRoom = Boolean(useGroupMusic().currentGroup);

  return (
    <nav aria-label='Main' className='space-y-0.5'>
      {NAV_ITEMS.map(({ key, label, icon: Icon, path, match }) => {
        const active = match(pathname);
        const badge = key === 'messages' && unread > 0 ? unread : null;
        const live = key === 'rooms' && inRoom;
        return (
          <RailTip key={key} show={collapsed} label={label}>
            <Link
              to={path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 items-center rounded-xl text-sm transition-colors',
                collapsed ? 'mx-auto w-11 justify-center' : 'gap-3 px-2.5',
                active
                  ? 'bg-sidebar-accent font-semibold text-foreground'
                  : 'font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
              )}
            >
              {active && !collapsed && (
                <span className='absolute -left-3 top-2.5 h-5 w-1 rounded-r-full bg-primary' />
              )}
              <span className='relative'>
                <Icon
                  className={cn('h-[19px] w-[19px]', active && 'text-primary')}
                  strokeWidth={active ? 2.25 : 1.9}
                />
                {live && (
                  <span className='live-dot absolute -right-1 -top-1 h-2 w-2 rounded-full bg-live' />
                )}
                {badge && collapsed && (
                  <span className='absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground'>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {!collapsed && <span className='flex-1'>{label}</span>}
              {!collapsed && badge && (
                <span className='grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground'>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {!collapsed && live && (
                <span className='text-[11px] font-semibold text-live'>Live</span>
              )}
            </Link>
          </RailTip>
        );
      })}
    </nav>
  );
};

const RecentChats = ({ chats, collapsed }) => {
  const navigate = useNavigate();
  if (!chats.length) return null;

  const open = (chat) => navigate(paths.messages, { state: { chatData: { chatid: chat.chatid } } });

  return (
    <section>
      {!collapsed && <SectionHeading>Recent chats</SectionHeading>}
      <ul className={cn(collapsed ? 'space-y-2' : 'space-y-0.5')}>
        {chats.map((chat) => {
          const other = chat.otherUser || {};
          return (
            <li key={chat.chatid}>
              <RailTip show={collapsed} label={other.name}>
                <button
                  type='button'
                  onClick={() => open(chat)}
                  className={cn(
                    'flex w-full items-center rounded-xl text-left transition-colors hover:bg-sidebar-accent/60',
                    collapsed ? 'mx-auto h-11 w-11 justify-center' : 'gap-2.5 px-2.5 py-1.5'
                  )}
                >
                  <span className='relative shrink-0'>
                    <Avatar className='h-7 w-7'>
                      <AvatarImage src={getProfileCloudinaryUrl(other.profilepic)} alt='' />
                      <AvatarFallback className='text-[10px]'>
                        {other.name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    {chat.isOnline && (
                      <span className='absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-500' />
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className='min-w-0 flex-1'>
                        <span
                          className={cn(
                            'block truncate text-[13px]',
                            chat.unreadCount > 0
                              ? 'font-semibold'
                              : 'font-medium text-foreground/85'
                          )}
                        >
                          {other.name}
                        </span>
                        {chat.isTyping && (
                          <span className='block text-[11px] text-emerald-500'>typing…</span>
                        )}
                      </span>
                      {chat.unreadCount > 0 && (
                        <span className='h-2 w-2 shrink-0 rounded-full bg-primary' />
                      )}
                    </>
                  )}
                </button>
              </RailTip>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const PinnedPlaylists = () => {
  const navigate = useNavigate();
  const { data: playlists = [] } = useUserPlaylistsQuery();
  const list = playlists.slice(0, 5);

  return (
    <section>
      <SectionHeading
        action={
          <button
            type='button'
            onClick={() => navigate(paths.library, { state: { createPlaylist: true } })}
            aria-label='New playlist'
            className='grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          >
            <Plus className='h-3.5 w-3.5' />
          </button>
        }
      >
        Your playlists
      </SectionHeading>
      {list.length === 0 ? (
        <p className='px-2.5 text-xs text-muted-foreground'>Playlists you make show up here.</p>
      ) : (
        <ul className='space-y-0.5'>
          {list.map((pl) => {
            const img =
              getPlaylistImageUrl(pl.previewSongs?.[0]?.image) || getPlaylistImageUrl(pl.image);
            return (
              <li key={pl.id}>
                <Link
                  to={paths.myPlaylist(pl.id)}
                  className='flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-sidebar-accent/60'
                >
                  {img ? (
                    <img src={img} alt='' className='h-7 w-7 shrink-0 rounded-md object-cover' />
                  ) : (
                    <span className='grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 font-display text-xs font-bold text-primary'>
                      {pl.name?.[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className='min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/85'>
                    {pl.name}
                  </span>
                  <span className='text-[11px] tabular-nums text-muted-foreground'>
                    {pl.songCount ?? ''}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/**
 * Desktop sidebar. Expanded it shows navigation, your live room, playlists, recent chats and
 * the docked player; collapsed it becomes a 76px rail with the same live signals as icons.
 */
const Sidebar = ({ collapsed, canExpand }) => {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const { unread, recent } = useChatSummary(collapsed ? 3 : 4);

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-300 ease-premium',
          collapsed ? 'w-[76px]' : 'w-[272px]'
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center',
            collapsed ? 'justify-center' : 'justify-between pl-5 pr-3'
          )}
        >
          <Link to={paths.home} className='flex items-center gap-2.5' aria-label='SyncVibe home'>
            <img src={LOGO_URL} alt='' className='h-8 w-8 rounded-full' />
            {!collapsed && (
              <span className='font-display text-[19px] font-bold tracking-tight'>SyncVibe</span>
            )}
          </Link>
          {!collapsed && canExpand && (
            <button
              type='button'
              onClick={toggleSidebar}
              aria-label='Collapse sidebar'
              className='grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            >
              <PanelLeftClose className='h-4 w-4' />
            </button>
          )}
        </div>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-3',
            collapsed ? 'px-2' : 'px-3'
          )}
        >
          <RailTip show={collapsed} label='Search'>
            <button
              type='button'
              onClick={() => setSearchOpen(true)}
              className={cn(
                'flex h-10 items-center rounded-xl border border-sidebar-border bg-background/60 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground',
                collapsed ? 'mx-auto w-11 justify-center' : 'w-full gap-2.5 px-3'
              )}
            >
              <Search className='h-4 w-4 shrink-0' />
              {!collapsed && (
                <>
                  <span className='flex-1 text-left'>Search music</span>
                  <kbd className='rounded-md border border-sidebar-border px-1.5 py-0.5 font-sans text-[10px]'>
                    {isMac ? '⌘K' : 'Ctrl K'}
                  </kbd>
                </>
              )}
            </button>
          </RailTip>

          <NavList collapsed={collapsed} unread={unread} />
          <LiveRoom collapsed={collapsed} />
          {!collapsed && <PinnedPlaylists />}
          <RecentChats chats={recent} collapsed={collapsed} />
        </div>

        <div className={cn('space-y-2 pb-3 pt-2', collapsed ? 'px-2' : 'px-3')}>
          <NowPlayingDock collapsed={collapsed} />
          {collapsed && canExpand && (
            <RailTip show label='Expand sidebar'>
              <button
                type='button'
                onClick={toggleSidebar}
                aria-label='Expand sidebar'
                className='mx-auto grid h-10 w-11 place-items-center rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              >
                <PanelLeftOpen className='h-4 w-4' />
              </button>
            </RailTip>
          )}
          <div className={cn(collapsed && 'flex justify-center')}>
            <ProfileDropdownMenu fromSidebar collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default memo(Sidebar);
