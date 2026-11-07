import { Loader2 } from 'lucide-react';
import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ActiveGroupBar from '@/components/ActiveGroupBar';
import IncomingCallNotification from '@/components/Chat/IncomingCall';
import VideoCallUI from '@/components/Chat/VideoCall';
import { useProfileSuspenseQuery } from '@/hooks/queries/useProfileQuery';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import BottomPlayer from '@/Pages/Music/BottomPlayer';
import MusicCommand from '@/Pages/Music/MusicCommand';
import { useVideoCallStore } from '@/stores/videoCallStore';
import { MobileTabBar, MobileTopBar, useTabBarVisible } from './MobileBars';
import Sidebar from './Sidebar';
import { useShellLayout } from './useShellLayout';

/** Routes that manage their own height and scrolling (they fill the panel exactly). */
const FULL_HEIGHT_PREFIXES = [paths.rooms, paths.messages];

const ProfileLoader = ({ children }) => {
  useProfileSuspenseQuery();
  return children;
};

const PanelFallback = () => (
  <div className='grid h-full place-items-center'>
    <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
  </div>
);

/**
 * Signed-in app frame: sidebar (or mobile tab bar) on the canvas, page content in an inset panel.
 * The panel is the scroll container, so the sidebar and player never move.
 */
const AppShell = () => {
  const { pathname } = useLocation();
  const { hasSidebar, canExpand, isExpanded, isMobile } = useShellLayout();
  const tabBarVisible = useTabBarVisible();
  const scrollRef = useRef(null);
  const { incomingCall, isInCall, answerCall, rejectCall } = useVideoCallStore();

  const fullHeight = FULL_HEIGHT_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Only here, inside the signed-in app: public pages never ask for permissions.
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className='flex h-dvh w-full overflow-hidden bg-canvas'>
      {hasSidebar && <Sidebar collapsed={!isExpanded} canExpand={canExpand} />}

      <main className='flex min-w-0 flex-1 flex-col md:py-2 md:pr-2'>
        <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-[20px] md:border md:border-border/60 md:shadow-[0_1px_0_0_hsl(var(--foreground)/0.03)]'>
          {isMobile && !fullHeight && <MobileTopBar />}
          <div
            ref={scrollRef}
            id='app-scroll'
            className={cn(
              'min-h-0 flex-1',
              !fullHeight && 'overflow-y-auto overscroll-contain',
              isMobile && tabBarVisible && (fullHeight ? 'pb-16' : 'pb-20')
            )}
          >
            <Suspense fallback={<PanelFallback />}>
              <ProfileLoader>
                <Outlet />
              </ProfileLoader>
            </Suspense>
          </div>
        </div>
      </main>

      {isMobile && tabBarVisible && <MobileTabBar />}
      <BottomPlayer />
      <ActiveGroupBar />
      <MusicCommand />
      <IncomingCallNotification
        incomingCall={incomingCall}
        answerCall={answerCall}
        endCall={rejectCall}
      />
      {isInCall && <VideoCallUI />}
    </div>
  );
};

export default AppShell;
