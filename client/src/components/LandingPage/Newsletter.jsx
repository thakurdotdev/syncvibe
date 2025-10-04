import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

const Newsletter = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    if (email?.trim() === '') {
      toast.error('Email is required');
      return;
    }
    e.preventDefault();
    setLoading(true);

    // Simulate API request
    setTimeout(() => {
      setLoading(false);
      setEmail('');
      toast.success('Subscribed successfully!');
    }, 2000);
  };
  return (
    <section className='py-32 bg-gradient-to-b from-purple-900/20 to-black'>
      <div className='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
        <div className='space-y-8'>
          <h2 className='text-3xl md:text-4xl font-bold text-white'>Stay in the Loop</h2>
          <p className='text-xl text-white/70'>Get early access to new features and updates</p>
          <form className='flex flex-col sm:flex-row items-center gap-4'>
            <input
              type='email'
              placeholder='Enter your email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='flex-1 px-6 py-2 bg-white/5 rounded-full border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-white placeholder-white/50'
            />
            <Button
              onClick={handleSubmit}
              disabled={loading}
              type='button'
              className='px-8 py-4 rounded-full flex items-center gap-2'
            >
              {loading && <Loader2 className='w-6 h-6 animate-spin' />}
              {loading ? 'Subscribing...' : 'Subscribe'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
