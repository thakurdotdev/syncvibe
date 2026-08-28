import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter } from 'lucide-react';

const Footer = memo(() => {
  return (
    <footer className='border-t border-border/60 bg-background text-muted-foreground text-xs'>
      <div className='max-w-5xl mx-auto px-4 sm:px-6 py-14'>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-8'>
          {/* Brand Column (5 cols) */}
          <div className='md:col-span-6 space-y-3.5'>
            <Link to='/' className='flex items-center gap-2'>
              <img
                src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg'
                alt='SyncVibe'
                className='w-6 h-6 rounded-md object-cover ring-1 ring-primary/20'
              />
              <span className='text-sm font-semibold text-foreground tracking-tight'>SyncVibe</span>
            </Link>

            <p className='text-xs text-muted-foreground leading-relaxed max-w-sm font-normal'>
              Real-time synchronized music streaming, collaborative queues, and group voice/video
              rooms.
            </p>

            <div className='flex items-center gap-2.5 pt-1'>
              <a
                href='https://x.com/thakurdotdev'
                target='_blank'
                rel='noopener noreferrer'
                className='w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors'
                aria-label='Twitter / X'
              >
                <Twitter size={13} />
              </a>
              <a
                href='https://github.com/thakurdotdev'
                target='_blank'
                rel='noopener noreferrer'
                className='w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors'
                aria-label='GitHub'
              >
                <Github size={13} />
              </a>
            </div>
          </div>

          {/* Product Links (3 cols) */}
          <div className='md:col-span-3 space-y-2.5'>
            <h4 className='text-xs font-mono font-medium text-foreground uppercase tracking-wider'>
              Product
            </h4>
            <ul className='space-y-2 text-xs'>
              <li>
                <a href='#features' className='hover:text-primary transition-colors'>
                  Features
                </a>
              </li>
              <li>
                <a href='#how-it-works' className='hover:text-primary transition-colors'>
                  How It Works
                </a>
              </li>
              <li>
                <Link to='/download' className='hover:text-primary transition-colors'>
                  Android APK & Releases
                </Link>
              </li>
              <li>
                <Link to='/plans' className='hover:text-primary transition-colors'>
                  Pricing & Plans
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links (3 cols) */}
          <div className='md:col-span-3 space-y-2.5'>
            <h4 className='text-xs font-mono font-medium text-foreground uppercase tracking-wider'>
              Legal
            </h4>
            <ul className='space-y-2 text-xs'>
              <li>
                <Link to='/privacy-policy' className='hover:text-primary transition-colors'>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to='/terms-of-services' className='hover:text-primary transition-colors'>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to='/refund-policy' className='hover:text-primary transition-colors'>
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className='mt-12 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground'>
          <p>© {new Date().getFullYear()} SyncVibe. All rights reserved.</p>
          <p>
            Built by{' '}
            <a
              href='https://thakur.dev'
              target='_blank'
              rel='noopener noreferrer'
              className='text-foreground hover:text-primary transition-colors'
            >
              Pankaj Thakur
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';
export default Footer;
