import { BadgeCheck, Camera, Edit3, Loader2, LogOut } from 'lucide-react';
import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Followers from '@/components/Modals/Followers';
import Followings from '@/components/Modals/Followings';
import { cn } from '@/lib/utils';

const ProfileHeader = memo(
  ({
    user,
    followers,
    following,
    followersLoading,
    loading,
    onOpenPhotoDialog,
    onEditProfile,
    onLogout,
  }) => {
    return (
      <div className='relative rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden mb-6'>
        {/* Banner Gradient Mesh */}
        <div className='h-28 sm:h-36 w-full bg-gradient-to-r from-primary/25 via-primary/10 to-transparent relative'>
          <div className='absolute inset-0 bg-radial-gradient opacity-30' />
        </div>

        {/* Profile Content */}
        <div className='px-4 sm:px-8 pb-5 sm:pb-7 pt-0 relative'>
          {/* Avatar & Header Action Buttons Row */}
          <div className='flex items-end justify-between -mt-12 sm:-mt-16 gap-3 mb-4'>
            {/* Avatar with Camera Trigger */}
            <div className='relative group/avatar shrink-0'>
              <Avatar
                className={cn(
                  'w-24 h-24 sm:w-32 sm:h-32 rounded-full ring-4 ring-background shadow-xl transition-all duration-300',
                  loading && 'ring-primary/50 animate-pulse'
                )}
              >
                <AvatarImage
                  src={user?.profilepic}
                  alt={user?.name}
                  className='w-full h-full object-cover'
                />
                <AvatarFallback className='w-full h-full text-2xl sm:text-3xl font-bold bg-primary/10 text-primary'>
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>

              {/* Uploading Spinner Overlay */}
              {loading && (
                <div className='absolute inset-0 flex items-center justify-center bg-black/50 rounded-full backdrop-blur-xs'>
                  <Loader2 size={24} className='text-white animate-spin' />
                </div>
              )}

              {/* Camera Button */}
              <button
                type='button'
                onClick={onOpenPhotoDialog}
                disabled={loading}
                className='absolute bottom-0 right-0 h-7 w-7 sm:h-8.5 sm:w-8.5 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200 cursor-pointer disabled:pointer-events-none ring-2 ring-background'
                title='Change profile picture'
              >
                <Camera size={14} className='sm:w-4 sm:h-4' />
              </button>
            </div>

            {/* Actions: Edit Profile & Logout */}
            <div className='flex items-center gap-2 shrink-0 pt-2 sm:pt-0'>
              <Button
                variant='outline'
                size='sm'
                onClick={onEditProfile}
                className='gap-1.5 h-8 sm:h-9 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium cursor-pointer'
              >
                <Edit3 size={13} className='sm:w-3.5 sm:h-3.5' />
                <span>Edit Profile</span>
              </Button>

              <Button
                variant='ghost'
                size='icon'
                onClick={onLogout}
                className='h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0'
                title='Log out of your account'
              >
                <LogOut size={15} />
              </Button>
            </div>
          </div>

          {/* User Info Stack */}
          <div className='text-left space-y-2.5'>
            <div>
              <div className='flex items-center gap-1.5 flex-wrap'>
                <h1 className='text-xl sm:text-2xl font-bold text-foreground tracking-tight'>
                  {user?.name || 'User'}
                </h1>
                {user?.verified && (
                  <BadgeCheck className='text-blue-500 fill-blue-500/20 shrink-0' size={20} />
                )}
              </div>
              <p className='text-xs sm:text-sm font-medium text-muted-foreground mt-0.5'>
                @{user?.username}
              </p>
            </div>

            {/* Bio */}
            {user?.bio ? (
              <p className='text-xs sm:text-sm text-foreground/85 max-w-2xl leading-relaxed whitespace-pre-wrap'>
                {user.bio}
              </p>
            ) : (
              <p className='text-xs text-muted-foreground/60 italic'>No bio added yet.</p>
            )}

            {/* Followers / Following Stats */}
            <div className='flex items-center gap-2 pt-1'>
              {followersLoading ? (
                <div className='flex items-center gap-2'>
                  <Button variant='outline' size='sm' disabled className='rounded-xl h-7 text-xs'>
                    <Loader2 size={12} className='animate-spin mr-1' />
                    Followers
                  </Button>
                  <Button variant='outline' size='sm' disabled className='rounded-xl h-7 text-xs'>
                    <Loader2 size={12} className='animate-spin mr-1' />
                    Following
                  </Button>
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  <Followers followers={followers} />
                  <Followings following={following} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ProfileHeader.displayName = 'ProfileHeader';
export default ProfileHeader;
