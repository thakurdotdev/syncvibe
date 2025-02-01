import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary";
import axios from "axios";
import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Context } from "../../Context/Context";
import getFollowList from "../../Utils/getFollowList";
import LoadingScreen from "../Loader";
import Followers from "../Modals/Followers";
import Followings from "../Modals/Followings";
import PostCard from "../Posts/PostCard";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

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
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [userResponse, postsResponse, followListResponse] =
        await Promise.all([
          axios.get(
            `${import.meta.env.VITE_API_URL}/api/user/profile/${userid}`,
            { withCredentials: true },
          ),
          axios.get(
            `${import.meta.env.VITE_API_URL}/api/user/posts/${userid}`,
            { withCredentials: true },
          ),
          getFollowList(userid),
        ]);

      setUserData({
        user: userResponse.data,
        followers: followListResponse.followers,
        following: followListResponse.following,
        isFollowing: followListResponse.followers.some(
          (follower) => follower?.followerDetail?.userid === CurrUser?.userid,
        ),
      });
      setPosts(postsResponse.data.posts);

      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error("Error fetching data:", error);
      toast.error("Failed to load user data");
    }
  }, [userid, CurrUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFollow = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/user/follow/${userid}`,
        { withCredentials: true },
      );

      if (response.status === 200) {
        const updatedFollowList = await getFollowList(userid);
        setUserData((prev) => ({
          ...prev,
          followers: updatedFollowList.followers,
          isFollowing: updatedFollowList.followers.some(
            (follower) => follower?.followerDetail?.userid === CurrUser?.userid,
          ),
        }));
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading)
    return (
      <div className="flex h-[90vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );

  return (
    <div className="flex justify-center my-10 px-1 sm:px-0">
      <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-xl max-w-xl w-full">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-row items-center justify-around gap-2 w-full">
            <img
              src={getProfileCloudinaryUrl(userData?.user?.profilepic)}
              alt="Profile"
              className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-gray-300 dark:border-gray-700 shadow-lg"
            />
            <div className="text-left">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {userData?.user?.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                @{userData?.user?.username}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                {userData?.user?.bio}
              </p>
              <div className="flex justify-stretch my-2 gap-1">
                <Followers followers={userData?.followers} />
                <Followings following={userData?.following} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-3 justify-center w-full">
            {Number(CurrUser?.userid) !== Number(userid) && (
              <Button
                variant="secondary"
                onClick={() => handleFollow(userid)}
                className="rounded-full w-full max-w-48"
              >
                {userData?.isFollowing ? "Following" : "Follow"}
              </Button>
            )}
            {Number(CurrUser?.userid) !== Number(userid) &&
              userData?.isFollowing && (
                <Button
                  onClick={() => {
                    navigate("/chat", {
                      state: { recieverid: userData?.user?.userid },
                    });
                  }}
                  className="rounded-full w-full max-w-48"
                >
                  Message
                </Button>
              )}
          </div>
        </div>

        {/* Follower and Following Stats */}

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

        {/* Posts Section */}
        <div className="">
          {posts.length === 0 ? (
            <p className="text-lg text-center text-gray-500 dark:text-gray-400 col-span-full">
              No posts yet
            </p>
          ) : (
            posts.map((post) => (
              <PostCard key={post.postid} post={post} setPosts={setPosts} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SeeUserProfile;
