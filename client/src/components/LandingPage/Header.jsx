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
    <header className='fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/60 bg-background/85 backdrop-blur-xl transition-all'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between'>
        {/* Brand Logo */}
        <Link to='/' className='flex items-center gap-2.5 group'>
          <img
            src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg'
            height={30}
            width={30}
            alt='SyncVibe'
            className='w-7.5 h-7.5 rounded-lg object-cover ring-1 ring-primary/30 transition-transform duration-200 group-hover:scale-105'
          />
          <span className='text-base font-semibold text-foreground tracking-tight'>SyncVibe</span>
        </Link>

        {/* Navigation Links */}
        <nav className='hidden md:flex items-center gap-7'>
          <a
            href='#features'
            className='text-xs font-medium text-muted-foreground hover:text-primary transition-colors'
          >
            Features
          </a>
          <a
            href='#how-it-works'
            className='text-xs font-medium text-muted-foreground hover:text-primary transition-colors'
          >
            How it Works
          </a>
          <Link
            to='/download'
            className='text-xs font-medium text-muted-foreground hover:text-primary transition-colors'
          >
            App
          </Link>
          <a
            href='#pricing'
            className='text-xs font-medium text-muted-foreground hover:text-primary transition-colors'
          >
            Pricing
          </a>
          <a
            href='#faq'
            className='text-xs font-medium text-muted-foreground hover:text-primary transition-colors'
          >
            FAQ
          </a>
        </nav>

        {/* Auth Actions */}
        <div className='flex items-center gap-3'>
          {user?.userid ? (
            <div
              className='flex items-center gap-2.5 cursor-pointer py-1 px-2.5 rounded-full bg-secondary border border-border hover:border-primary/40 transition-colors'
              onClick={() => navigate('/feed')}
            >
              <Avatar className='h-6.5 w-6.5'>
                <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt={user.name} />
                <AvatarFallback className='text-[10px] font-semibold bg-muted text-foreground'>
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className='text-xs font-medium text-foreground'>Dashboard</span>
              <ArrowRight size={12} className='text-muted-foreground' />
            </div>
          ) : (
            <>
              <Link to='/login'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full h-8 px-3.5'
                >
                  Sign In
                </Button>
              </Link>
              <Link to='/register'>
                <Button
                  size='sm'
                  className='rounded-full h-8 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all cursor-pointer shadow-sm shadow-primary/20'
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
