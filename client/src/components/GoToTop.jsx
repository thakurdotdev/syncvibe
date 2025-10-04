import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from './ui/button';

const GoToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  return (
    <div className='fixed bottom-6 right-6'>
      {isVisible && (
        <Button
          onClick={scrollToTop}
          className='p-3 rounded-full shadow-md transition-transform transform hover:scale-110'
          aria-label='Go to Top'
        >
          <ArrowUp className='w-6 h-6' />
        </Button>
      )}
    </div>
  );
};

export default GoToTop;
