import { lazy, Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LOGO_URL } from '@/components/shell/nav';
import useMediaQuery from '@/hooks/use-media-query';

const AuthShowcase = lazy(() => import('./AuthShowcase'));

/**
 * Frame for the sign-in pages. Same layering as the app shell: the canvas behind, the form on
 * the content panel, and a live room as a second panel on wide screens.
 */
const AuthLayout = () => {
  const { pathname } = useLocation();
  const isRegister = pathname === '/register';
  // The showcase is hidden below this width, so phones skip its code and artwork entirely.
  const isWide = useMediaQuery('(min-width: 1024px)');

  return (
    <div className='flex min-h-dvh w-full gap-2 bg-canvas text-foreground md:p-2'>
      <div className='flex min-w-0 flex-1 flex-col bg-background lg:w-[max(420px,30%)] lg:flex-none md:rounded-[20px] md:border md:border-border/60 md:shadow-[0_1px_0_0_hsl(var(--foreground)/0.03)]'>
        <header className='flex h-16 items-center justify-between px-5 md:px-8'>
          <Link to='/' aria-label='SyncVibe home' className='flex items-center gap-2.5'>
            <img src={LOGO_URL} alt='' className='h-7 w-7 rounded-full' />
            <span className='font-display text-lg font-bold tracking-tight'>SyncVibe</span>
          </Link>
          <Link
            to={isRegister ? '/login' : '/register'}
            className='press rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            {isRegister ? 'Sign in' : 'Sign up'}
          </Link>
        </header>

        <main className='flex flex-1 items-center justify-center px-5 py-8 md:px-8'>
          <div className='w-full max-w-[400px]'>
            <Outlet />
          </div>
        </main>

        <footer className='flex items-center justify-between px-5 pb-5 text-xs text-muted-foreground md:px-8 md:pb-6'>
          <span>© {new Date().getFullYear()} SyncVibe</span>
          <nav className='flex gap-4'>
            <Link to='/privacy-policy' className='hover:text-foreground'>
              Privacy
            </Link>
            <Link to='/terms-of-services' className='hover:text-foreground'>
              Terms
            </Link>
          </nav>
        </footer>
      </div>

      <aside
        aria-label='A live SyncVibe room you can try'
        className='relative hidden overflow-hidden rounded-[20px] border border-border/60 min-w-0 lg:block lg:flex-1'
      >
        {isWide && (
          <Suspense fallback={null}>
            <AuthShowcase />
          </Suspense>
        )}
      </aside>
    </div>
  );
};

export default AuthLayout;
