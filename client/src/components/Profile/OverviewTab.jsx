import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const OverviewTab = memo(({ user, onEditProfile }) => {
  return (
    <div className='space-y-6'>
      {/* Account Details Card */}
      <Card className='border-border/80 bg-card/60 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden'>
        <CardHeader className='pb-4'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-base font-semibold'>Personal Information</CardTitle>
              <CardDescription className='text-xs text-muted-foreground mt-0.5'>
                Your public profile details and account identity
              </CardDescription>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={onEditProfile}
              className='h-8 px-3 rounded-xl cursor-pointer text-xs font-medium'
            >
              Edit profile
            </Button>
          </div>
        </CardHeader>

        <CardContent className='p-0'>
          <div className='grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50 border-t border-border/50'>
            {/* Full Name */}
            <div className='px-6 py-4 space-y-1'>
              <div className='text-xs text-muted-foreground font-medium'>Full Name</div>
              <p className='text-sm font-semibold text-foreground'>
                {user?.name || 'Not provided'}
              </p>
            </div>

            {/* Username */}
            <div className='px-6 py-4 space-y-1'>
              <div className='text-xs text-muted-foreground font-medium'>Username</div>
              <p className='text-sm font-semibold text-foreground'>
                @{user?.username || 'not_set'}
              </p>
            </div>
          </div>

          <div className='grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50 border-t border-border/50'>
            {/* Email Address */}
            <div className='px-6 py-4 space-y-1'>
              <div className='text-xs text-muted-foreground font-medium'>Email Address</div>
              <p className='text-sm font-semibold text-foreground truncate'>
                {user?.email || 'Not provided'}
              </p>
            </div>

            {/* Verification Status */}
            <div className='px-6 py-4 space-y-1'>
              <div className='text-xs text-muted-foreground font-medium'>Account Status</div>
              <div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    user?.verified
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {user?.verified ? 'Verified Account' : 'Standard Account'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About & Bio Card */}
      <Card className='border-border/80 bg-card/60 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base font-semibold'>About You</CardTitle>
          <CardDescription className='text-xs text-muted-foreground'>
            A short description displayed on your public profile
          </CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='p-4 rounded-xl bg-muted/20 border border-border/40'>
            {user?.bio ? (
              <p className='text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed'>
                {user.bio}
              </p>
            ) : (
              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground italic'>
                  You haven't written a bio yet.
                </p>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={onEditProfile}
                  className='text-xs text-primary h-7 px-2.5'
                >
                  Add bio
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

OverviewTab.displayName = 'OverviewTab';
export default OverviewTab;
