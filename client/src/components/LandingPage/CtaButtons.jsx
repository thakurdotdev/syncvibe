import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';

// Shorter labels on phones keep both buttons on one line.
const CtaButtons = ({ className }) => (
  <div className={className}>
    <div className='flex gap-2 sm:gap-2.5'>
      <Button
        asChild
        size='lg'
        className='min-w-0 flex-1 rounded-xl px-2 text-[13px] font-semibold min-[360px]:px-3 min-[360px]:text-sm sm:flex-none sm:px-6'
      >
        <Link to='/register'>Create free account</Link>
      </Button>
      <Button
        asChild
        size='lg'
        variant='outline'
        className='min-w-0 flex-1 rounded-xl px-2 text-[13px] min-[360px]:px-3 min-[360px]:text-sm sm:flex-none sm:px-5'
      >
        <Link to='/download'>
          <Download className='mr-1.5 h-4 w-4 shrink-0 sm:mr-2' />
          <span className='sm:hidden'>Android app</span>
          <span className='hidden sm:inline'>Get the Android app</span>
        </Link>
      </Button>
    </div>
  </div>
);

export default CtaButtons;
