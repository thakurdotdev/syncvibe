import { memo } from 'react';
import LazyImage from '../LazyImage';
import { Button } from '../ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile } from '@/Context/Context';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const Header = memo(() => {
  const { user } = useProfile();
  const navigate = useNavigate();

  return (
    <header className='fixed top-0 left-0 right-0 z-50'>
      <div className='absolute inset-0 bg-[#050505]/80 backdrop-blur-2xl border-b border-white/[0.05]' />
      <nav className='relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between'>
        {/* Logo */}
        <Link to='/' className='flex items-center gap-2.5'>
          <LazyImage
            src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp'
            height={36}
            width={36}
            alt='SyncVibe'
            className='w-9 h-9 rounded-xl'
          />
          <span className='text-lg font-bold text-white'>SyncVibe</span>
        </Link>

        {/* Desktop Nav */}
        <div className='hidden md:flex items-center gap-8'>
          <a href='#features' className='text-sm text-white/50 hover:text-white transition-colors'>
            Features
          </a>
          <a href='#download' className='text-sm text-white/50 hover:text-white transition-colors'>
            Download
          </a>
        </div>

        {/* Auth */}
        <div className='flex items-center gap-3'>
          {user?.userid ? (
            <Avatar
              className='h-8 w-8 rounded-full cursor-pointer'
              onClick={() => navigate('/feed')}
              title='Go to Feed'
              aria-label='Go to Feed'
            >
              <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
              <AvatarFallback className='rounded-lg'>
                {user.name[0]}
                {user.name[1]}
              </AvatarFallback>
            </Avatar>
          ) : (
            <>
              <Link to='/login' className='hidden sm:block'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-white/60 hover:text-white hover:bg-white/5 rounded-xl'
                >
                  Log in
                </Button>
              </Link>
              <Link to='/register'>
                <Button
                  size='sm'
                  className='rounded-xl px-5 bg-white text-black hover:bg-white/90 font-medium'
                >
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
});

export default Header;
