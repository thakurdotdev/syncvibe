import { ChatContext } from '@/Context/ChatContext';
import { usePlayer } from '@/Context/PlayerContext';
import { cn } from '@/lib/utils';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import axios from 'axios';
import {
  BadgeCheck,
  Camera,
  CheckCircle,
  Loader2,
  LockKeyhole,
  LogOutIcon,
  Settings,
  Shield,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Context } from '../../Context/Context';
import getFollowList from '../../Utils/getFollowList';
import DeleteAccount from '../Modals/DeleteAccount';
import DisableTwoFactor from '../Modals/DisableTwoFactor';
import Followers from '../Modals/Followers';
import Followings from '../Modals/Followings';
import ImageUpload from '../Modals/ImageUpload';
import LoginLogs from '../Modals/LoginLogs';
import TwoFactorAuth from '../Modals/TwoFactorAuth';
import UpdatePassword from '../Modals/UpdatePassword';
import UpdateProfileModel from '../Modals/UpdateProfileModel';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader } from '../ui/dialog';
import DotPattern from '../ui/dot-pattern';
import PasskeyManager from './PasskeyManager';

const ProfileSection = ({ title, icon, children }) => (
  <Card className='rounded-xl shadow-md p-6 mb-6'>
    <div className='flex items-center mb-4'>
      {icon}
      <h2 className='text-xl font-semibold ml-3 text-gray-800 dark:text-gray-200'>{title}</h2>
    </div>
    {children}
  </Card>
);

const Profile = () => {
  const { user, setUser, getProfile } = useContext(Context);
  const { stopSong } = usePlayer();
  const { cleanUpSocket } = useContext(ChatContext);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoginLogsOpen, setIsLoginLogsOpen] = useState(false);
  const [isUpdateProfileOpen, setIsUpdateProfileOpen] = useState(false);
  const [loginLogs, setLoginLogs] = useState([]);
  const [updatePassword, setUpdatePassword] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [isDisable2FAOpen, setIsDisable2FAOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);

  const toggleUpdatePassword = () => {
    setUpdatePassword((prev) => !prev);
  };

  const toggleLoginLogs = () => {
    setIsLoginLogsOpen((prev) => !prev);
  };

  const toggleUpdateProfile = () => {
    setIsUpdateProfileOpen((prev) => !prev);
  };

  const toggle2FASetup = () => {
    setIs2FASetupOpen((prev) => !prev);
  };

  const toggleDisable2FA = () => {
    setIsDisable2FAOpen((prev) => !prev);
  };

  const handle2FASuccess = (token) => {
    setTwoFactorEnabled(true);
    setUser((prevUser) => ({ ...prevUser, twoFactorEnabled: true }));
    if (token) {
      console.log('Login token received:', token);
    }
    toast.success('Two-Factor Authentication enabled successfully!');
  };

  const handleDisable2FASuccess = () => {
    setTwoFactorEnabled(false);
    setUser((prevUser) => ({ ...prevUser, twoFactorEnabled: false }));
    toast.success('Two-Factor Authentication disabled successfully!');
  };

  useEffect(() => {
    setFollowersLoading(true);
    getFollowList(user.userid)
      .then(({ followers, following }) => {
        setFollowersLoading(false);
        setFollowers(followers);
        setFollowing(following);
      })
      .catch((error) => {
        console.error('Error fetching followers and following:', error);
        setFollowersLoading(false);
      });
  }, [user.userid]);

  useEffect(() => {
    getLoginLogs();
  }, []);

  const getLoginLogs = async () => {
    try {
      setIsLogsLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/login-logs`, {
        withCredentials: true,
      });
      if (response.status === 200) {
        setLoginLogs(response.data);
        setIsLogsLoading(false);
      }
    } catch (error) {
      setIsLogsLoading(false);
      console.error('Error fetching login logs:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const { status } = await axios.get(`${import.meta.env.VITE_API_URL}/api/logout`, {
        withCredentials: true,
      });
      if (status === 200) {
        cleanUpSocket();
        stopSong();
        setUser(null);
      }
    } catch (error) {
      cleanUpSocket();
      stopSong();
      setUser(null);
    }
  };

  const handleProfilePicUpdate = useCallback(
    async (croppedImageUrl) => {
      try {
        setLoading(true);
        const response = await fetch(croppedImageUrl);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append('profilepic', blob, 'profile.jpg');

        const { status, data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/update-profilepic`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            withCredentials: true,
          }
        );

        if (status === 200) {
          setUser((prevUser) => ({ ...prevUser, profilepic: data.profilepic }));
          toast.success('Profile picture updated successfully');
          setIsDialogOpen(false);
        }
      } catch (error) {
        console.error('Error updating profile picture:', error);
        toast.error(error.response?.data?.message || 'Failed to update profile picture');
      } finally {
        setLoading(false);
      }
    },
    [setUser]
  );

  const toggleDialog = useCallback(() => {
    setIsDialogOpen((prev) => !prev);
  }, []);

  return (
    <>
      <div className='p-4'>
        <DotPattern
          className={cn('[mask-image:radial-gradient(550px_circle_at_center,white,transparent)]')}
        />
        <div className=' w-full max-w-4xl mx-auto z-10'>
          {/* Profile Header */}
          <Card className='rounded-xl shadow-md p-6 mb-6'>
            <div className='flex flex-col md:flex-row items-center md:items-start'>
              <div className='relative mb-6 md:mb-0 md:mr-8'>
                <Avatar className='w-48 h-48 rounded-full overflow-hidden shadow-lg relative'>
                  <AvatarImage
                    src={getProfileCloudinaryUrl(user?.profilepic)}
                    alt={user?.name}
                    className='w-full h-full object-cover'
                  />
                  <AvatarFallback className='w-full h-full'>CN</AvatarFallback>
                </Avatar>

                <Button
                  onClick={toggleDialog}
                  variant='ghost'
                  className='absolute bottom-2 w-10 h-10 right-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition duration-300 shadow-md'
                >
                  <Camera />
                </Button>
              </div>
              <div className='flex-1'>
                <div className='mb-4'>
                  <h1 className='text-3xl font-semibold text-slate-700 dark:text-slate-300 flex items-center'>
                    {user?.name}
                    {user.verified && <BadgeCheck className='text-green-500 ml-2' size={30} />}
                  </h1>
                  <p className='text-gray-600 dark:text-gray-400 text-lg'>@{user?.username}</p>
                </div>
                <p className='text-gray-700 dark:text-gray-300 text-lg mb-4'>{user?.bio}</p>
                <div className='flex space-x-4'>
                  {followersLoading ? (
                    <>
                      <Button
                        disabled={followers.length === 0}
                        className='px-4 py-2 rounded-full'
                        variant='outline'
                      >
                        <Loader2 size={20} className='animate-spin' />
                        Followers
                      </Button>
                      <Button
                        disabled={following.length === 0}
                        className='px-4 py-2 rounded-full'
                        variant='outline'
                      >
                        <Loader2 size={20} className='animate-spin' />
                        Following
                      </Button>
                    </>
                  ) : (
                    <>
                      <Followers followers={followers} />
                      <Followings following={following} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Profile Management Sections */}
          <div className='grid md:grid-cols-2 gap-6'>
            <ProfileSection
              title='Profile Settings'
              icon={<UserIcon size={24} className='text-blue-500' />}
            >
              <div className='space-y-4'>
                <Button
                  variant='secondary'
                  onClick={toggleUpdateProfile}
                  className='w-full flex items-center justify-between p-4'
                >
                  <div className='flex items-center'>
                    <Settings size={20} className='mr-3 text-gray-400' />
                    <span>Edit Profile</span>
                  </div>
                  <UserIcon size={20} className='text-gray-400' />
                </Button>
              </div>
            </ProfileSection>

            <ProfileSection
              title='Account Security'
              icon={<Shield size={24} className='text-green-500' />}
            >
              <div className='space-y-4'>
                <Button
                  variant='secondary'
                  onClick={toggleUpdatePassword}
                  className='w-full flex items-center justify-between'
                >
                  <div className='flex items-center'>
                    <LockKeyhole size={20} className='mr-3 text-gray-400' />
                    <span>Change Password</span>
                  </div>
                </Button>
                {twoFactorEnabled ? (
                  <div className='space-y-2'>
                    <div className='w-full flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg'>
                      <div className='flex items-center'>
                        <Shield size={20} className='mr-3 text-green-600' />
                        <span className='text-green-800 dark:text-green-200'>
                          Two-Factor Authentication
                        </span>
                      </div>
                      <CheckCircle size={20} className='text-green-500' />
                    </div>
                    <Button
                      variant='outline'
                      onClick={toggleDisable2FA}
                      className='w-full flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50'
                    >
                      <XCircle size={16} className='mr-2' />
                      Disable 2FA
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant='secondary'
                    onClick={toggle2FASetup}
                    className='w-full flex items-center justify-between'
                  >
                    <div className='flex items-center'>
                      <Shield size={20} className='mr-3 text-gray-400' />
                      <span>Two-Factor Authentication</span>
                    </div>
                    <XCircle size={20} className='text-red-500' />
                  </Button>
                )}
                <Button
                  variant='secondary'
                  onClick={toggleLoginLogs}
                  className='w-full flex items-center justify-between'
                  disabled={isLogsLoading}
                >
                  <div className='flex items-center'>
                    {isLogsLoading ? (
                      <Loader2 size={20} className='mr-3 text-gray-400 animate-spin' />
                    ) : (
                      <Shield size={20} className='mr-3 text-gray-400' />
                    )}
                    <span>Login History</span>
                  </div>
                </Button>
                <Button
                  variant='destructive'
                  onClick={handleLogout}
                  className='w-full flex items-center justify-between'
                >
                  <div className='flex items-center'>
                    <LogOutIcon size={20} className='mr-3 text-gray-400' />
                    <span>Logout</span>
                  </div>
                </Button>
              </div>
            </ProfileSection>
          </div>

          <div className='grid'>
            <div className='space-y-2'>
              <PasskeyManager getProfile={getProfile} />
            </div>
          </div>

          {/* Danger Zone */}
          <div className='bg-red-50 dark:bg-red-900/20 rounded-xl p-6 mt-6'>
            <div className='flex justify-between items-center'>
              <div>
                <h3 className='text-2xl font-semibold text-red-700 dark:text-red-300'>
                  Delete Account
                </h3>
                <p className='text-red-600 dark:text-red-400 text-sm'>
                  Permanently remove your account and all associated data
                </p>
              </div>
              <Button onClick={() => setDeleteAccount(true)} variant='destructive'>
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Picture Update Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={toggleDialog}>
        <DialogContent>
          <DialogHeader>Update Profile Picture</DialogHeader>
          <ImageUpload onImageUpdate={handleProfilePicUpdate} />
        </DialogContent>
      </Dialog>

      <UpdateProfileModel
        isOpen={isUpdateProfileOpen}
        toggleDialog={toggleUpdateProfile}
        user={user}
        setUser={setUser}
      />

      <LoginLogs isOpen={isLoginLogsOpen} toggleDialog={toggleLoginLogs} loginLogs={loginLogs} />
      <UpdatePassword isOpen={updatePassword} toggleDialog={toggleUpdatePassword} />

      <DeleteAccount open={deleteAccount} setOpen={setDeleteAccount} handleLogout={handleLogout} />

      <TwoFactorAuth
        isOpen={is2FASetupOpen}
        onClose={toggle2FASetup}
        userId={user?.userid}
        onSuccess={handle2FASuccess}
        isSetup={!twoFactorEnabled}
      />

      <DisableTwoFactor
        isOpen={isDisable2FAOpen}
        onClose={toggleDisable2FA}
        onSuccess={handleDisable2FASuccess}
      />
    </>
  );
};

export default Profile;
