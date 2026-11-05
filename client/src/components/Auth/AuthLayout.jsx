import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import authImage from '@/assets/auth.png';

const AuthLayout = () => {
  const location = useLocation();
  const isRegister = location.pathname === '/register';
  const headerLinkPath = isRegister ? '/login' : '/register';
  const headerLinkLabel = isRegister ? 'Log in' : 'Sign up';

  return (
    <div className='min-h-screen w-full flex flex-col md:flex-row bg-background text-foreground'>
      {/* Left Column - Form */}
      <div className='flex-1 flex flex-col justify-between p-6 sm:p-8 md:p-12 lg:p-16 bg-muted/40 dark:bg-background transition-colors duration-300'>
        <div className='max-w-[420px] w-full mx-auto flex-1 flex flex-col justify-between gap-8'>
          {/* Top Header Row */}
          <header className='flex items-center justify-between w-full'>
            <Link to='/' className='flex items-center gap-2.5 group'>
              <img
                src='https://res.cloudinary.com/dr7lkelwl/image/upload/v1793889692/profiles/profiles_6_1793889690_21ee9015425b6812.jpg'
                alt='SyncVibe'
                className='w-8 h-8 rounded-xl object-cover shadow-sm transition-transform group-hover:scale-105'
              />
              <span className='text-xl font-bold tracking-tight text-foreground'>SyncVibe</span>
            </Link>
            <Link
              to={headerLinkPath}
              className='text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors'
            >
              {headerLinkLabel}
            </Link>
          </header>

          {/* Center Auth Form */}
          <main className='w-full my-auto py-4 flex flex-col justify-center'>
            <Outlet />
          </main>

          {/* Footer Row */}
          <footer className='flex items-center justify-between w-full text-xs text-muted-foreground'>
            <span>© 2026 SyncVibe</span>
            <div className='flex gap-4'>
              <Link to='/privacy' className='hover:text-muted-foreground transition-colors'>
                Privacy
              </Link>
              <Link to='/terms' className='hover:text-muted-foreground transition-colors'>
                Terms
              </Link>
            </div>
          </footer>
        </div>
      </div>

      {/* Right Column - Image */}
      <div className='hidden md:block md:w-[50%] lg:w-[55%] relative p-4 bg-muted dark:bg-background'>
        <div className='w-full h-full relative overflow-hidden rounded-[2rem] border border-border/50 shadow-md'>
          <img
            src={authImage}
            alt='SyncVibe Scene'
            className='w-full h-full object-cover select-none'
            loading='eager'
          />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
