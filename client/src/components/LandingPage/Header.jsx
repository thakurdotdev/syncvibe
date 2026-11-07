import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/Context/Context';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { paths } from '@/lib/paths';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  NavItems,
  Navbar,
} from '../ui/resizable-navbar';

// Full paths, because the header also appears on /plans, /download and the legal pages.
const NAV_ITEMS = [
  { name: 'How it works', link: '/#how-it-works' },
  { name: 'Features', link: '/#features' },
  { name: 'Android', link: '/#android' },
  { name: 'Pricing', link: '/#pricing' },
  { name: 'FAQ', link: '/#faq' },
];

const Brand = () => (
  <Link
    to='/'
    onClick={() => window.scrollTo({ top: 0 })}
    className='relative z-10 flex items-center gap-2.5'
  >
    <img
      src='https://res.cloudinary.com/dr7lkelwl/image/upload/v1793889692/profiles/profiles_6_1793889690_21ee9015425b6812.jpg'
      height={30}
      width={30}
      alt=''
      className='h-7.5 w-7.5 rounded-lg object-cover'
    />
    <span className='font-display text-lg font-bold'>SyncVibe</span>
  </Link>
);

const Account = () => {
  const { user } = useProfile();

  if (user?.userid) {
    return (
      <Link
        to={paths.home}
        className='press relative z-10 flex items-center gap-2 rounded-full bg-secondary py-1 pr-3.5 pl-1 text-sm font-medium hover:bg-accent'
      >
        <Avatar className='h-7 w-7'>
          <AvatarImage src={getProfileCloudinaryUrl(user.profilepic)} alt='' />
          <AvatarFallback className='bg-muted text-[10px] font-semibold text-foreground'>
            {user.name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        Open app
      </Link>
    );
  }

  return (
    <div className='relative z-10 flex items-center gap-1.5'>
      <Button asChild variant='ghost' size='sm' className='rounded-lg px-3.5'>
        <Link to='/login'>Sign in</Link>
      </Button>
      <Button asChild size='sm' className='rounded-lg px-4 font-semibold'>
        <Link to='/register'>Get started</Link>
      </Button>
    </div>
  );
};

const Header = memo(() => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Navbar>
      <NavBody>
        <Brand />
        <NavItems items={NAV_ITEMS} />
        <Account />
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <Brand />
          <div className='flex items-center gap-1'>
            <Account />
            <MobileNavToggle isOpen={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
          </div>
        </MobileNavHeader>
        <MobileNavMenu isOpen={menuOpen}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.link}
              href={item.link}
              onClick={() => setMenuOpen(false)}
              className='rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent'
            >
              {item.name}
            </a>
          ))}
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
});

Header.displayName = 'Header';
export default Header;
