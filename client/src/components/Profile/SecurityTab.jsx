import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PasskeyManager from '@/components/Auth/PasskeyManager';
import SignedInDevices from '@/components/Auth/SignedInDevices';

const SecurityTab = memo(
  ({ twoFactorEnabled, hasPassword, onUpdatePassword, onSetup2FA, onDisable2FA }) => {
    return (
      <div className='space-y-6'>
        {/* Core Authentication Settings Card */}
        <Card className='border-border/80 bg-card/60 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden'>
          <CardHeader className='pb-4'>
            <CardTitle className='text-base font-semibold'>Account Security</CardTitle>
            <CardDescription className='text-xs text-muted-foreground'>
              Manage your password and two-factor authentication
            </CardDescription>
          </CardHeader>

          <CardContent className='p-0'>
            {/* Password Row */}
            {hasPassword && (
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4.5 border-t border-border/50'>
                <div className='space-y-1 max-w-md'>
                  <div className='text-sm font-medium text-foreground'>Password</div>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Ensure your account has a strong, unique password to prevent unauthorized
                    access.
                  </p>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={onUpdatePassword}
                  className='h-8.5 px-3.5 rounded-xl text-xs font-medium shrink-0 cursor-pointer self-start sm:self-auto'
                >
                  Change password
                </Button>
              </div>
            )}

            {/* Two-Factor Authentication Row */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4.5 border-t border-border/50'>
              <div className='space-y-1 max-w-md'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium text-foreground'>
                    Two-Factor Authentication
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                      twoFactorEnabled
                        ? 'bg-foreground/10 text-foreground border border-foreground/20'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {twoFactorEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className='text-xs text-muted-foreground leading-relaxed'>
                  {twoFactorEnabled
                    ? 'Your account is protected by an authenticator code required at every login.'
                    : 'Add an extra layer of defense requiring a verification code when signing in.'}
                </p>
              </div>

              {twoFactorEnabled ? (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={onDisable2FA}
                  className='h-8.5 px-3.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0 cursor-pointer self-start sm:self-auto'
                >
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  variant='default'
                  size='sm'
                  onClick={onSetup2FA}
                  className='h-8.5 px-3.5 rounded-xl text-xs font-medium shrink-0 cursor-pointer self-start sm:self-auto'
                >
                  Enable 2FA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Passkeys Management */}
        <PasskeyManager />

        <SignedInDevices />
      </div>
    );
  }
);

SecurityTab.displayName = 'SecurityTab';
export default SecurityTab;
