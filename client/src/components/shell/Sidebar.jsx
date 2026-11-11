import { MotionConfig, motion } from 'framer-motion';
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ProfileDropdownMenu from '@/components/ProfileDropdownMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserPlaylistsQuery } from '@/hooks/queries/usePlaylistQueries';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { getPlaylistImageUrl } from '@/Pages/Music/Cards';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { LOGO_URL, NAV_ITEMS } from './nav';
import { NowSlot } from './SidebarLive';
import { useChatSummary } from './useShellData';
import { SPRING } from '@/lib/motion';

const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
/** The playlist shelf shows this many (newest first); the rest are a click away in Library. */
const SHELF_SIZE = 6;
/** The collapsed rail shows fewer, as covers. */
const RAIL_SIZE = 5;
/** What a click on the collapsed rail leaves alone: it expands on anything else. */
const INTERACTIVE = 'a, button, input, [role="button"], [role="menuitem"], [role="menu"]';

const coverOf = (pl) =>
  getPlaylistImageUrl(pl.previewSongs?.[0]?.image) || getPlaylistImageUrl(pl.image);

/**
 * The active destination is drawn as a piece of the content panel's surface, lifted onto the
 * sidebar canvas, and it slides between items rather than blinking.
 */
const ActivePill = () => (
  <motion.span
    layoutId='sidebar-active'
    transition={SPRING}
    className='absolute inset-0 rounded-xl bg-background shadow-[0_0_0_1px_hsl(var(--border)/0.9),0_1px_2px_0_hsl(var(--foreground)/0.06),0_4px_12px_-6px_hsl(var(--foreground)/0.12)]'
  />
);

const Tip = ({ show = true, label, children, side = 'right' }) =>
  show ? (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={10} className='text-xs'>
        {label}
      </TooltipContent>
    </Tooltip>
  ) : (
    children
  );

const SectionLabel = ({ children, action }) => (
  <div className='flex h-7 items-center justify-between px-2.5'>
    <h2 className='font-sans text-xs font-medium tracking-normal text-muted-foreground'>
      {children}
    </h2>
    {action}
  </div>
);

const NavList = ({ collapsed, unread }) => {
  const { pathname } = useLocation();
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));

  return (
    <nav aria-label='Main' className='flex flex-col gap-0.5'>
      {NAV_ITEMS.map(({ key, label, icon: Icon, path, match }) => {
        const active = match(pathname);
        const badge = key === 'messages' && unread > 0 ? unread : null;
        const live = key === 'rooms' && inRoom;
        return (
          <Tip key={key} show={collapsed} label={label}>
            <Link
              to={path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-9 items-center rounded-xl text-[13.5px] transition-colors',
                collapsed ? 'mx-auto w-10 justify-center' : 'gap-3 px-2.5',
                active
                  ? 'font-semibold text-foreground'
                  : 'font-medium text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground'
              )}
            >
              {active && <ActivePill />}
              <span className='relative'>
                <Icon
                  className={cn('h-[18px] w-[18px]', active && 'text-primary')}
                  strokeWidth={active ? 2.2 : 1.8}
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
              {!collapsed && <span className='relative flex-1'>{label}</span>}
              {!collapsed && badge && (
                <span className='relative grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1.5 text-[10.5px] font-semibold tabular-nums text-primary-foreground'>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {!collapsed && live && (
                <span className='relative flex items-center gap-1 text-[11px] font-semibold text-live'>
                  <span className='live-dot h-1.5 w-1.5 rounded-full bg-live' />
                  Live
                </span>
              )}
            </Link>
          </Tip>
        );
      })}
    </nav>
  );
};

const Playlists = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: playlists = [], isLoading } = useUserPlaylistsQuery();

  return (
    <section className='flex min-h-0 flex-1 flex-col'>
      <SectionLabel
        action={
          <Tip label='New playlist' side='top'>
            <button
              type='button'
              onClick={() => navigate(paths.library, { state: { createPlaylist: true } })}
              aria-label='New playlist'
              className='grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
            >
              <Plus className='h-3.5 w-3.5' />
            </button>
          </Tip>
        }
      >
        Playlists
      </SectionLabel>

      {!isLoading && playlists.length === 0 ? (
        <p className='px-2.5 pt-1 text-xs leading-relaxed text-muted-foreground'>
          Save songs into playlists and they’ll live here.
        </p>
      ) : (
        <>
          <ul className='sidebar-scroll -mx-1 min-h-0 overflow-y-auto px-1'>
            {playlists.slice(0, SHELF_SIZE).map((pl) => {
              const to = paths.myPlaylist(pl.id);
              const active = pathname === to;
              const img = coverOf(pl);
              return (
                <li key={pl.id}>
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    title={`${pl.name} · ${Number(pl.songCount) || 0} songs`}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-xl px-2 transition-colors',
                      active ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.045]'
                    )}
                  >
                    {img ? (
                      <img src={img} alt='' className='h-6 w-6 shrink-0 rounded-md object-cover' />
                    ) : (
                      <span className='grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/15 font-display text-[11px] font-bold text-primary'>
                        {pl.name?.[0]?.toUpperCase()}
                      </span>
                    )}
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[13px]',
                        active ? 'font-semibold' : 'font-medium text-foreground/85'
                      )}
                    >
                      {pl.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {playlists.length > SHELF_SIZE && (
            <Link
              to={paths.library}
              className='mt-0.5 flex h-8 shrink-0 items-center gap-1 rounded-xl px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground'
            >
              <span className='flex-1'>All playlists</span>
              <span className='tabular-nums'>{playlists.length}</span>
              <ChevronRight className='h-3.5 w-3.5' />
            </Link>
          )}
        </>
      )}
    </section>
  );
};

/** Collapsed: the newest playlists as covers, so the rail isn't empty. */
const RailPlaylists = () => {
  const { pathname } = useLocation();
  const { data: playlists = [] } = useUserPlaylistsQuery();
  if (!playlists.length) return null;
  return (
    <ul className='flex flex-col items-center gap-1.5 border-t border-sidebar-border pt-3'>
      {playlists.slice(0, RAIL_SIZE).map((pl) => {
        const to = paths.myPlaylist(pl.id);
        const img = coverOf(pl);
        return (
          <li key={pl.id}>
            <Tip label={pl.name}>
              <Link
                to={to}
                aria-label={pl.name}
                aria-current={pathname === to ? 'page' : undefined}
                className={cn(
                  'block rounded-lg transition-transform hover:scale-105 active:scale-95',
                  pathname === to && 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-sidebar'
                )}
              >
                {img ? (
                  <img src={img} alt='' className='h-9 w-9 rounded-lg object-cover' />
                ) : (
                  <span className='grid h-9 w-9 place-items-center rounded-lg bg-primary/15 font-display text-xs font-bold text-primary'>
                    {pl.name?.[0]?.toUpperCase()}
                  </span>
                )}
              </Link>
            </Tip>
          </li>
        );
      })}
    </ul>
  );
};

const personStatus = (p) => {
  if (p.isTyping) return 'typing…';
  if (p.unreadCount > 0) return `${p.unreadCount} new`;
  return p.isOnline ? 'online' : null;
};

/**
 * Your conversations as one row of faces (who's waiting on a reply, who's online). It sits with
 * the library in the middle band, away from the room card, so it never reads as room members.
 */
const People = ({ people, total }) => {
  const navigate = useNavigate();
  if (!people.length) return null;

  const open = (p) => navigate(paths.messages, { state: { conversationId: p.id } });

  return (
    <section className='shrink-0 pb-3 [@media(max-height:720px)]:hidden'>
      <SectionLabel
        action={
          total > people.length && (
            <Link
              to={paths.messages}
              className='text-[11px] font-medium text-muted-foreground hover:text-foreground'
            >
              See all
            </Link>
          )
        }
      >
        Recent chats
      </SectionLabel>
      <ul className='flex gap-1.5 px-1.5 pt-1'>
        {people.map((p) => {
          const other = p.peer || {};
          const status = personStatus(p);
          const unread = p.unreadCount > 0;
          return (
            <li key={p.id}>
              <Tip label={status ? `${other.name}, ${status}` : other.name} side='top'>
                <button
                  type='button'
                  onClick={() => open(p)}
                  aria-label={`Chat with ${other.name}${status ? `, ${status}` : ''}`}
                  className='relative block rounded-full transition-transform hover:-translate-y-0.5 active:scale-95'
                >
                  <Avatar
                    className={cn(
                      'h-9 w-9',
                      unread && 'ring-2 ring-primary ring-offset-2 ring-offset-sidebar'
                    )}
                  >
                    <AvatarImage src={getProfileCloudinaryUrl(other.profilepic)} alt='' />
                    <AvatarFallback className='text-xs'>{other.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  {p.isTyping ? (
                    <span className='absolute -right-1 -top-1 flex h-3.5 items-center gap-[2px] rounded-full bg-foreground px-1'>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className='h-[3px] w-[3px] animate-bounce rounded-full bg-background'
                          style={{ animationDelay: `${i * 120}ms` }}
                        />
                      ))}
                    </span>
                  ) : (
                    p.isOnline && (
                      <span className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-foreground' />
                    )
                  )}
                </button>
              </Tip>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/**
 * Desktop sidebar in three bands: pinned navigation on top, a scrolling playlist shelf in the
 * middle, and a pinned "now" area (people, room or player, profile) at the bottom — so the live
 * room can never be scrolled out of view on short screens. Collapsed it is a 72px icon rail.
 */
const Sidebar = ({ collapsed, canExpand }) => {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const { unread, people, total } = useChatSummary(6);
  const railExpands = collapsed && canExpand;

  // Collapsed, the whole rail is the way to open it: a click anywhere but a link or button.
  const onRailClick = (e) => {
    if (!railExpands || e.target.closest(INTERACTIVE)) return;
    toggleSidebar();
  };

  return (
    <MotionConfig reducedMotion='user'>
      <TooltipProvider delayDuration={150}>
        {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a pointer shortcut; the Expand button below is the keyboard way */}
        <aside
          onClick={onRailClick}
          className={cn(
            'flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-300 ease-premium',
            collapsed ? 'w-[72px]' : 'w-[264px]',
            // The expand arrow over empty rail; links and buttons keep their own pointer.
            railExpands && 'cursor-e-resize [&_a]:cursor-pointer [&_button]:cursor-pointer'
          )}
        >
          {/* Top band */}
          <div className={cn('flex flex-col gap-3 pb-4', collapsed ? 'px-2' : 'px-3')}>
            <div
              className={cn(
                'flex h-14 items-center',
                collapsed ? 'justify-center' : 'justify-between pl-2'
              )}
            >
              <Link
                to={paths.home}
                className='flex items-center gap-2.5'
                aria-label='SyncVibe home'
              >
                <img src={LOGO_URL} alt='' className='h-7 w-7 rounded-full' />
                {!collapsed && (
                  <span className='font-display text-lg font-bold tracking-tight'>SyncVibe</span>
                )}
              </Link>
              {!collapsed && canExpand && (
                <Tip label='Collapse sidebar' side='bottom'>
                  <button
                    type='button'
                    onClick={toggleSidebar}
                    aria-label='Collapse sidebar'
                    className='grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
                  >
                    <PanelLeftClose className='h-4 w-4' />
                  </button>
                </Tip>
              )}
            </div>

            <Tip show={collapsed} label={`Search (${isMac ? '⌘K' : 'Ctrl K'})`}>
              <button
                type='button'
                onClick={() => setSearchOpen(true)}
                aria-label={collapsed ? 'Search' : undefined}
                className={cn(
                  'flex h-9 items-center rounded-xl text-[13.5px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground',
                  collapsed ? 'mx-auto w-10 justify-center' : 'w-full gap-3 px-2.5'
                )}
              >
                <Search className='h-[18px] w-[18px] shrink-0' strokeWidth={1.8} />
                {!collapsed && (
                  <>
                    <span className='flex-1 text-left font-medium'>Search</span>
                    <kbd className='rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-sans text-[10.5px] text-muted-foreground'>
                      {isMac ? '⌘K' : 'Ctrl K'}
                    </kbd>
                  </>
                )}
              </button>
            </Tip>

            <NavList collapsed={collapsed} unread={unread} />
          </div>

          {/* Middle band: the only part that scrolls */}
          {collapsed ? (
            <div className='flex min-h-0 flex-1 flex-col overflow-hidden px-2'>
              <RailPlaylists />
            </div>
          ) : (
            <div className='flex min-h-0 flex-1 flex-col border-t border-sidebar-border px-3 pt-3'>
              <People people={people} total={total} />
              <Playlists />
            </div>
          )}

          {/* Bottom band: always visible */}
          <div
            className={cn(
              'flex flex-col gap-3 pb-3 pt-3',
              collapsed ? 'items-center px-2' : 'border-t border-sidebar-border px-3'
            )}
          >
            <NowSlot collapsed={collapsed} />
            {collapsed && canExpand && (
              <Tip label='Expand sidebar'>
                <button
                  type='button'
                  onClick={toggleSidebar}
                  aria-label='Expand sidebar'
                  className='grid h-9 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
                >
                  <PanelLeftOpen className='h-4 w-4' />
                </button>
              </Tip>
            )}
            <div className={cn('w-full', collapsed && 'flex justify-center')}>
              <ProfileDropdownMenu fromSidebar collapsed={collapsed} />
            </div>
          </div>
        </aside>
      </TooltipProvider>
    </MotionConfig>
  );
};

export default memo(Sidebar);
