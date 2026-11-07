import { memo } from 'react';
import { Link } from 'react-router-dom';
import { LOGO_URL } from '@/components/shell/nav';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      ['How it works', '/#how-it-works', true],
      ['Features', '/#features', true],
      ['Pricing', '/#pricing', true],
      ['FAQ', '/#faq', true],
    ],
  },
  {
    title: 'Get the app',
    links: [
      ['Android app', '/download'],
      ['Release notes', '/releases'],
      ['Plans', '/plans'],
    ],
  },
  {
    title: 'Account',
    links: [
      ['Create account', '/register'],
      ['Sign in', '/login'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Privacy', '/privacy-policy'],
      ['Terms', '/terms-of-services'],
      ['Refunds', '/refund-policy'],
    ],
  },
];

const SOCIALS = [
  {
    label: 'SyncVibe creator on X',
    href: 'https://x.com/thakurdotdev',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    label: 'SyncVibe creator on GitHub',
    href: 'https://github.com/thakurdotdev',
    path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  },
];

const LINK = 'text-muted-foreground transition-colors hover:text-foreground';

const Footer = memo(() => (
  <footer className='overflow-hidden bg-background text-sm'>
    <div className='hairline-glow' />
    <div className='mx-auto max-w-7xl px-4 pt-14 sm:px-6 sm:pt-16'>
      <div className='grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'>
        <div>
          <Link
            to='/'
            onClick={() => window.scrollTo({ top: 0 })}
            className='flex w-fit items-center gap-2.5'
          >
            <img src={LOGO_URL} alt='' className='h-8 w-8 rounded-lg' />
            <span className='font-display text-xl font-semibold'>SyncVibe</span>
          </Link>
          <p className='mt-4 max-w-xs text-[15px] leading-relaxed text-muted-foreground'>
            Listen to the same song at the same second with your friends, on the web and Android.
          </p>
          <div className='mt-5 flex items-center gap-2'>
            {SOCIALS.map(({ label, href, path }) => (
              <a
                key={href}
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={label}
                className='btn-surface grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground'
              >
                <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true' className='h-4 w-4'>
                  <path d={path} />
                </svg>
              </a>
            ))}
          </div>
        </div>

        <nav aria-label='Footer' className='grid grid-cols-2 gap-8 sm:grid-cols-4'>
          {COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <p className='font-medium'>{title}</p>
              <ul className='mt-3.5 space-y-2.5'>
                {links.map(([label, to, isAnchor]) => (
                  <li key={label}>
                    {isAnchor ? (
                      <a href={to} className={LINK}>
                        {label}
                      </a>
                    ) : (
                      <Link to={to} className={LINK}>
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className='relative mt-12 sm:mt-16'>
        <p className='mb-3 text-xs text-muted-foreground sm:absolute sm:right-0 sm:bottom-3 sm:mb-0 sm:text-right'>
          © {new Date().getFullYear()} SyncVibe. Built by{' '}
          <a
            href='https://thakur.dev'
            target='_blank'
            rel='noopener noreferrer'
            className='text-foreground hover:underline'
          >
            Pankaj Thakur
          </a>
          .
        </p>
        <p
          aria-hidden='true'
          className='font-display -mb-[0.14em] bg-gradient-to-b from-foreground/14 to-foreground/0 bg-clip-text pb-[0.14em] text-[min(25vw,22rem)] leading-none font-bold tracking-[-0.03em] whitespace-nowrap text-transparent select-none'
        >
          SyncVibe
        </p>
      </div>
    </div>
  </footer>
));

Footer.displayName = 'Footer';
export default Footer;
