import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Globe, HelpCircle, Loader2, LogOut, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const API = `${import.meta.env.VITE_API_URL}/api/user/sessions`;

const LOGIN_METHODS = {
  password: 'Password',
  'password-2fa': 'Password + 2FA',
  'backup-code': 'Backup code',
  google: 'Google',
  passkey: 'Passkey',
  'email-code': 'Email code',
};

const DAY = 24 * 60 * 60 * 1000;

/** Day-level wording: the server only records activity about once a day. */
const lastActive = (value) => {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / DAY);
  if (days <= 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  if (days < 7) return `Active ${days} days ago`;
  return `Active ${new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const DeviceIcon = ({ session }) => {
  const Icon = session.kind === 'unknown' ? HelpCircle : session.mobile ? Smartphone : Monitor;
  return (
    <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted'>
      <Icon className='h-4.5 w-4.5 text-foreground' />
    </div>
  );
};

const messageOf = (error, fallback) => error?.response?.data?.message || fallback;

const SignedInDevices = () => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // { type: 'one', session } | { type: 'others', count }
  const [confirm, setConfirm] = useState(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(API, { withCredentials: true });
      setSessions(data.sessions);
    } catch (error) {
      toast.error(messageOf(error, 'Failed to load your signed-in devices'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const others = sessions.filter((s) => !s.isCurrent);

  const revoke = async () => {
    if (!confirm) return;
    setIsRevoking(true);
    try {
      if (confirm.type === 'one') {
        await axios.delete(`${API}/${encodeURIComponent(confirm.session.id)}`, {
          withCredentials: true,
        });
        setSessions((prev) => prev.filter((s) => s.id !== confirm.session.id));
        toast.success('Device signed out');
      } else {
        await axios.delete(API, { withCredentials: true });
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        toast.success('Signed out of your other devices');
      }
      setConfirm(null);
    } catch (error) {
      toast.error(messageOf(error, 'Failed to sign out'));
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <Card className='border-border/80 bg-card/60 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden'>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <CardTitle className='text-base font-semibold'>Signed-in devices</CardTitle>
            <CardDescription className='text-xs text-muted-foreground mt-0.5'>
              Places where your account is signed in. Sign out any you don’t recognise.
            </CardDescription>
          </div>
          {others.length > 0 && (
            <Button
              variant='outline'
              size='sm'
              onClick={() => setConfirm({ type: 'others', count: others.length })}
              className='h-8.5 px-3.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0 cursor-pointer gap-1.5'
            >
              <LogOut className='h-3.5 w-3.5' />
              Sign out others
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className='p-0'>
        {isLoading ? (
          <div className='flex justify-center py-8 border-t border-border/50'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          sessions.map((session) => {
            const method = LOGIN_METHODS[session.loginMethod];
            const details = [
              session.detail,
              session.location,
              method && `via ${method}`,
              !session.isCurrent && lastActive(session.lastActiveAt),
            ].filter(Boolean);

            return (
              <div
                key={session.id}
                className='flex items-center gap-3 px-4 sm:px-6 py-3.5 border-t border-border/50'
              >
                <DeviceIcon session={session} />
                <div className='min-w-0 flex-1 space-y-0.5'>
                  <div className='flex items-center gap-2'>
                    <span className='truncate text-sm font-medium text-foreground'>
                      {session.name}
                    </span>
                    {session.isCurrent && (
                      <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-foreground/10 text-foreground border border-foreground/20'>
                        This device
                      </span>
                    )}
                  </div>
                  <p className='truncate text-xs text-muted-foreground'>{details.join(' · ')}</p>
                  {session.ipAddress && (
                    <p className='flex items-center gap-1 text-[11px] text-muted-foreground/80'>
                      <Globe className='h-3 w-3' />
                      {session.ipAddress} · Signed in {formatDate(session.createdAt)}
                    </p>
                  )}
                </div>
                {!session.isCurrent && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setConfirm({ type: 'one', session })}
                    className='h-8 px-3 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer'
                  >
                    Sign out
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && !isRevoking && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === 'one'
                ? `Sign out ${confirm.session.name}?`
                : 'Sign out other devices?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'one'
                ? 'That device will need to sign in again. If you don’t recognise it, change your password too.'
                : `${confirm?.count === 1 ? 'Your other device' : `Your ${confirm?.count} other devices`} will need to sign in again. This browser stays signed in.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                revoke();
              }}
              disabled={isRevoking}
              className='bg-destructive text-white hover:bg-destructive/90'
            >
              {isRevoking && <Loader2 className='h-4 w-4 animate-spin mr-2' />}
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default SignedInDevices;
