import { ChatContext } from '@/Context/ChatContext';
import { usePlayerStore } from '@/stores/playerStore';
import { uploadToCloudinary } from '@/Utils/cloudinaryUpload';
import axios from 'axios';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Context } from '../../Context/Context';
import getFollowList from '../../Utils/getFollowList';
import DeleteAccount from '../Modals/DeleteAccount';
import DisableTwoFactor from '../Modals/DisableTwoFactor';
import ImageUpload from '../Modals/ImageUpload';
import LoginLogs from '../Modals/LoginLogs';
import TwoFactorAuth from '../Modals/TwoFactorAuth';
import UpdatePassword from '../Modals/UpdatePassword';
import UpdateProfileModel from '../Modals/UpdateProfileModel';
import DangerZoneTab from '../Profile/DangerZoneTab';
import OverviewTab from '../Profile/OverviewTab';
import ProfileHeader from '../Profile/ProfileHeader';
import SecurityTab from '../Profile/SecurityTab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const Profile = () => {
  const { user, setUser, getProfile } = useContext(Context);
  const navigate = useNavigate();
  const stopSong = usePlayerStore((s) => s.stopSong);
  const { cleanUpSocket } = useContext(ChatContext);

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dialog & Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoginLogsOpen, setIsLoginLogsOpen] = useState(false);
  const [isUpdateProfileOpen, setIsUpdateProfileOpen] = useState(false);
  const [loginLogs, setLoginLogs] = useState([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [updatePassword, setUpdatePassword] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [isDisable2FAOpen, setIsDisable2FAOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);
  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = useState(false);

  const toggleUpdatePassword = () => setUpdatePassword((prev) => !prev);
  const toggleLoginLogs = () => setIsLoginLogsOpen((prev) => !prev);
  const toggleUpdateProfile = () => setIsUpdateProfileOpen((prev) => !prev);
  const toggle2FASetup = () => setIs2FASetupOpen((prev) => !prev);
  const toggleDisable2FA = () => setIsDisable2FAOpen((prev) => !prev);

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
    if (!user?.userid) return;
    setFollowersLoading(true);
    getFollowList(user.userid)
      .then(({ followers, following }) => {
        setFollowersLoading(false);
        setFollowers(followers || []);
        setFollowing(following || []);
      })
      .catch((error) => {
        console.error('Error fetching followers and following:', error);
        setFollowersLoading(false);
      });
  }, [user?.userid]);

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
      await axios.get(`${import.meta.env.VITE_API_URL}/api/logout`, {
        withCredentials: true,
      });
    } catch (error) {
      console.error('Logout request failed; clearing local session anyway:', error);
    } finally {
      cleanUpSocket();
      stopSong();
      setUser(null);
      navigate('/login', { replace: true });
    }
  };

  const handleProfilePicUpdate = useCallback(
    async (croppedImageUrl, file) => {
      setIsDialogOpen(false);
      setLoading(true);

      try {
        const uploadResult = await uploadToCloudinary(file, 'profile');

        const { status, data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/update-profilepic`,
          { profilepic: uploadResult.image },
          {
            headers: { 'Content-Type': 'application/json' },
            withCredentials: true,
          }
        );

        if (status === 200) {
          setUser((prevUser) => ({ ...prevUser, profilepic: data.profilepic }));
          toast.success('Profile picture updated!');
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
    if (loading) return;
    setIsDialogOpen((prev) => !prev);
  }, [loading]);

  return (
    <div className='w-full min-h-full py-4 sm:py-8 px-3 sm:px-6 pb-32 sm:pb-16'>
      <div className='w-full max-w-4xl mx-auto space-y-5 sm:space-y-6'>
        {/* Profile Header Hero */}
        <ProfileHeader
          user={user}
          followers={followers}
          following={following}
          followersLoading={followersLoading}
          loading={loading}
          onOpenPhotoDialog={toggleDialog}
          onEditProfile={toggleUpdateProfile}
          onLogout={() => setIsLogoutAlertOpen(true)}
        />

        {/* Tabbed Navigation */}
        <Tabs defaultValue='overview' className='space-y-6'>
          <div className='flex justify-center sm:justify-start'>
            <TabsList className='grid w-full sm:w-auto grid-cols-3 sm:inline-flex h-10 p-1 bg-muted/40 backdrop-blur-md rounded-xl border border-border/50'>
              <TabsTrigger
                value='overview'
                className='rounded-lg text-xs font-semibold px-4 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-sm'
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value='security'
                className='rounded-lg text-xs font-semibold px-4 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-sm'
              >
                Security
              </TabsTrigger>
              <TabsTrigger
                value='danger'
                className='rounded-lg text-xs font-semibold px-4 cursor-pointer text-destructive/80 data-[state=active]:text-destructive data-[state=active]:bg-background data-[state=active]:shadow-sm'
              >
                Danger Zone
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab Content */}
          <TabsContent value='overview' className='mt-0 focus-visible:outline-none'>
            <OverviewTab user={user} onEditProfile={toggleUpdateProfile} />
          </TabsContent>

          {/* Security Tab Content */}
          <TabsContent value='security' className='mt-0 focus-visible:outline-none'>
            <SecurityTab
              twoFactorEnabled={twoFactorEnabled}
              onUpdatePassword={toggleUpdatePassword}
              onSetup2FA={toggle2FASetup}
              onDisable2FA={toggleDisable2FA}
              onViewLogs={toggleLoginLogs}
              isLogsLoading={isLogsLoading}
              getProfile={getProfile}
            />
          </TabsContent>

          {/* Danger Zone Tab Content */}
          <TabsContent value='danger' className='mt-0 focus-visible:outline-none'>
            <DangerZoneTab onDeleteAccount={() => setDeleteAccount(true)} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Logout Confirmation Alert Dialog */}
      <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
        <AlertDialogContent className='max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-lg font-semibold'>
              Log out of SyncVibe?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-sm text-muted-foreground'>
              You will be signed out of your current session. You will need to log back in to access
              your playlists, chats, and custom settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='gap-2 sm:gap-0 mt-4'>
            <AlertDialogCancel className='rounded-xl h-9 text-xs font-medium cursor-pointer'>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className='rounded-xl h-9 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer'
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Picture Upload Modal */}
      <Dialog open={isDialogOpen} onOpenChange={toggleDialog}>
        <DialogContent className='sm:max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl'>
          <DialogHeader>
            <DialogTitle className='text-lg font-semibold'>Update Profile Picture</DialogTitle>
          </DialogHeader>
          <ImageUpload onImageUpdate={handleProfilePicUpdate} loading={loading} />
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <UpdateProfileModel
        isOpen={isUpdateProfileOpen}
        toggleDialog={toggleUpdateProfile}
        user={user}
        setUser={setUser}
      />

      {/* Login History Logs Modal */}
      <LoginLogs isOpen={isLoginLogsOpen} toggleDialog={toggleLoginLogs} loginLogs={loginLogs} />

      {/* Change Password Modal */}
      <UpdatePassword isOpen={updatePassword} toggleDialog={toggleUpdatePassword} />

      {/* Delete Account Confirmation Modal */}
      <DeleteAccount open={deleteAccount} setOpen={setDeleteAccount} handleLogout={handleLogout} />

      {/* 2FA Setup Modal */}
      <TwoFactorAuth
        isOpen={is2FASetupOpen}
        onClose={toggle2FASetup}
        userId={user?.userid}
        onSuccess={handle2FASuccess}
        isSetup={!twoFactorEnabled}
      />

      {/* 2FA Disable Modal */}
      <DisableTwoFactor
        isOpen={isDisable2FAOpen}
        onClose={toggleDisable2FA}
        onSuccess={handleDisable2FASuccess}
      />
    </div>
  );
};

export default Profile;
