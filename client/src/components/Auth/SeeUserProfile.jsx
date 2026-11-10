import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import axios from 'axios';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Context } from '../../Context/Context';
import getFollowList from '../../Utils/getFollowList';
import Followers from '../Modals/Followers';
import Followings from '../Modals/Followings';
import { Button } from '../ui/button';
import { Loader2, MessageCircle, UserCheck, UserPlus } from 'lucide-react';
import { paths } from '@/lib/paths';

const SeeUserProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: CurrUser } = useContext(Context);
  const userid = location.state?.user?.userid;
  const [userData, setUserData] = useState({
    user: null,
    followers: [],
    following: [],
    isFollowing: false,
  });
  const [loading, setLoading] = useState(Boolean(userid));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [userResponse, followListResponse] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/user/profile/${userid}`, {
          withCredentials: true,
        }),
        getFollowList(userid),
      ]);

      setUserData({
        user: userResponse.data,
        followers: followListResponse.followers,
        following: followListResponse.following,
        isFollowing: followListResponse.followers.some(
          (follower) => follower?.followerDetail?.userid === CurrUser?.userid
        ),
      });
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error('Error fetching data:', error);
      toast.error('Failed to load user data');
    }
  }, [userid, CurrUser]);

  useEffect(() => {
    if (userid) fetchData();
  }, [fetchData, userid]);

  const handleFollow = async () => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/user/follow/${userid}`,
        null,
        { withCredentials: true }
      );

      if (response.status === 200) {
        const updatedFollowList = await getFollowList(userid);
        setUserData((prev) => ({
          ...prev,
          followers: updatedFollowList.followers,
          isFollowing: updatedFollowList.followers.some(
            (follower) => follower?.followerDetail?.userid === CurrUser?.userid
          ),
        }));
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading)
    return (
      <div className='grid h-[60vh] place-items-center'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );

  if (!userid || !userData.user) {
    return (
      <div className='mx-auto max-w-md px-6 py-24 text-center'>
        <h1 className='text-2xl font-bold'>Profile unavailable</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Open a profile from a conversation or a followers list to see it here.
        </p>
        <Button className='mt-6 rounded-full' onClick={() => navigate(paths.messages)}>
          Go to messages
        </Button>
      </div>
    );
  }

  const isSelf = Number(CurrUser?.userid) === Number(userid);
  const profile = userData.user;

  return (
    <div className='mx-auto w-full max-w-2xl px-4 py-8 md:py-14'>
      <div className='relative overflow-hidden rounded-3xl border border-border bg-card'>
        <img
          src={getProfileCloudinaryUrl(profile.profilepic)}
          alt=''
          aria-hidden='true'
          className='pointer-events-none absolute inset-x-0 top-0 h-40 w-full scale-125 object-cover opacity-40 blur-3xl'
        />
        <div className='relative flex flex-col items-center px-6 pb-8 pt-12 text-center'>
          <img
            src={getProfileCloudinaryUrl(profile.profilepic)}
            alt={profile.name}
            className='h-28 w-28 rounded-full object-cover ring-4 ring-card shadow-xl md:h-32 md:w-32'
          />
          <h1 className='mt-4 text-3xl font-bold'>{profile.name}</h1>
          <p className='text-sm text-muted-foreground'>@{profile.username}</p>
          {profile.bio && <p className='mt-3 max-w-md text-sm leading-relaxed'>{profile.bio}</p>}

          <div className='mt-4 flex gap-1'>
            <Followers followers={userData.followers} />
            <Followings following={userData.following} />
          </div>

          {!isSelf && (
            <div className='mt-6 flex w-full max-w-xs gap-2'>
              <Button
                variant={userData.isFollowing ? 'secondary' : 'default'}
                onClick={handleFollow}
                className='flex-1 gap-2 rounded-full'
              >
                {userData.isFollowing ? (
                  <UserCheck className='h-4 w-4' />
                ) : (
                  <UserPlus className='h-4 w-4' />
                )}
                {userData.isFollowing ? 'Following' : 'Follow'}
              </Button>
              {userData.isFollowing && (
                <Button
                  variant='outline'
                  onClick={() => navigate(paths.messages, { state: { userId: profile.userid } })}
                  className='flex-1 gap-2 rounded-full'
                >
                  <MessageCircle className='h-4 w-4' />
                  Message
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeeUserProfile;
