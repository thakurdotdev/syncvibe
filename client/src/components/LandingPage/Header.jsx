import { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useProfile } from '@/Context/Context';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';

const Header = memo(() => {
  const { user } = useProfile();
  const navigate = useNavigate();

  return (
    <header className='fixed top-0 left-0 right-0 z-50 h-16 border-b border-zinc-800/60 bg-[#050505]/80 backdrop-blur-xl transition-all'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between'>
        {/* Brand Logo */}
        <Link to='/' className='flex items-center gap-2.5 group'>
          <img
            src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg'
            height={30}
            width={30}
            alt='SyncVibe'
            className='w-7.5 h-7.5 rounded-lg object-cover ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105'
          />
          <span className='text-base font-semibold text-white tracking-tight'>SyncVibe</span>
        </Link>

        {/* Navigation Links */}
        <nav className='hidden md:flex items-center gap-7'>
          <a
            href='#features'
            className='text-xs font-medium text-zinc-400 hover:text-white transition-colors'
          >
            Features
          </a>
          <a
            href='#how-it-works'
            className='text-xs font-medium text-zinc-400 hover:text-white transition-colors'
          >
            How it Works
          </a>
          <Link
            to='/download'
            className='text-xs font-medium text-zinc-400 hover:text-white transition-colors'
          >
            App
          </Link>
          <a
            href='#pricing'
            className='text-xs font-medium text-zinc-400 hover:text-white transition-colors'
          >
            Pricing
          </a>
          <a
            href='#faq'
            className='text-xs font-medium text-zinc-400 hover:text-white transition-colors'
          >
            FAQ
          </a>
        </nav>

        {/* Auth Actions */}
        <div className='flex items-center gap-3'>
          {user?.userid ? (
            <div
              className='flex items-center gap-2.5 cursor-pointer py-1 px-2.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors'
              onClick={() => navigate('/feed')}
            >
              <Avatar className='h-6.5 w-6.5'>
                <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
                <AvatarFallback className='text-[10px] font-semibold bg-zinc-800 text-white'>
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className='text-xs font-medium text-zinc-200'>Dashboard</span>
              <ArrowRight size={12} className='text-zinc-400' />
            </div>
          ) : (
            <>
              <Link to='/login'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full h-8 px-3.5'
                >
                  Sign In
                </Button>
              </Link>
              <Link to='/register'>
                <Button
                  size='sm'
                  className='rounded-full h-8 px-4 text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all cursor-pointer'
                >
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
export default Header;
