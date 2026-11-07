import { forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import googleIcon from '/google.png?url';

/**
 * Building blocks shared by the auth pages, in the app's Mono style: cards on bg-card,
 * rounded-xl controls and bold display headings.
 */

export const authInputClass = 'h-11 rounded-xl bg-card px-3.5';

export const AuthHeader = ({ icon: Icon, title, description }) => (
  <header className='mb-8'>
    {Icon && (
      <span className='mb-5 grid h-11 w-11 place-items-center rounded-xl bg-raised'>
        <Icon className='h-5 w-5' />
      </span>
    )}
    <h1 className='text-3xl font-bold md:text-4xl'>{title}</h1>
    {description && <p className='mt-2 text-sm text-muted-foreground'>{description}</p>}
  </header>
);

/** Full-width primary action with an optional spinner. */
export const AuthSubmit = ({ loading, loadingText, children, className, ...props }) => (
  <Button size='lg' className={cn('press w-full gap-2 rounded-xl', className)} {...props}>
    {loading && <Loader2 className='h-4 w-4 animate-spin' />}
    {loading && loadingText ? loadingText : children}
  </Button>
);

export const AuthSecondary = ({ className, ...props }) => (
  <Button
    variant='outline'
    size='lg'
    className={cn('press w-full gap-2.5 rounded-xl bg-card', className)}
    {...props}
  />
);

export const GoogleButton = ({ children = 'Continue with Google', ...props }) => (
  <AuthSecondary {...props}>
    <img src={googleIcon} alt='' className='h-5 w-5 object-contain' />
    {children}
  </AuthSecondary>
);

export const OrDivider = () => (
  <div className='my-6 flex items-center gap-3 text-xs text-muted-foreground'>
    <span className='h-px flex-1 bg-border' />
    or
    <span className='h-px flex-1 bg-border' />
  </div>
);

export const PasswordInput = forwardRef(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className='relative'>
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn(authInputClass, 'pr-12', className)}
        {...props}
      />
      <button
        type='button'
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className='absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
      >
        {visible ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

export const OtpField = ({ length = 6, ...props }) => (
  <InputOTP maxLength={length} containerClassName='justify-center' {...props}>
    <InputOTPGroup className='gap-2'>
      {Array.from({ length }, (_, index) => (
        <InputOTPSlot
          key={index}
          index={index}
          className='h-12 w-11 rounded-xl border bg-card text-lg font-semibold first:rounded-xl last:rounded-xl sm:w-12'
        />
      ))}
    </InputOTPGroup>
  </InputOTP>
);

/** "New to SyncVibe? Create an account" line under a form. */
export const AuthSwitch = ({ prompt, to, children }) => (
  <p className='mt-6 text-center text-sm text-muted-foreground'>
    {prompt}{' '}
    <Link to={to} className='font-semibold text-foreground underline-offset-4 hover:underline'>
      {children}
    </Link>
  </p>
);

export const TextAction = ({ className, ...props }) => (
  <button
    type='button'
    className={cn(
      'text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
);

/** Centered result screen, such as an expired link or a finished reset. */
export const AuthStatus = ({ icon: Icon, tone = 'default', title, description, children }) => (
  <div className='flex flex-col items-center text-center'>
    <span
      className={cn(
        'mb-6 grid h-16 w-16 place-items-center rounded-2xl border',
        tone === 'destructive'
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : 'border-border bg-raised'
      )}
    >
      <Icon className='h-7 w-7' />
    </span>
    <h1 className='text-2xl font-bold md:text-3xl'>{title}</h1>
    <p className='mb-8 mt-2 text-sm text-muted-foreground'>{description}</p>
    {children}
  </div>
);
