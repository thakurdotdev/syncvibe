import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { yupResolver } from "@hookform/resolvers/yup";
import axios from "axios";
import { Heart, MessageSquare, Send, Smile } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import * as Yup from "yup";
import { Context } from "../../Context/Context";
import {
  getLikeDislikeStatus,
  handleLikeDislike,
} from "../../Utils/LikeDislike";
import { TimeAgo } from "../../Utils/TimeAgo";
import LoadingScreen from "../Loader";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Loader2 } from "lucide-react";

const validationSchema = Yup.object().shape({
  comment: Yup.string()
    .required("Comment is required")
    .min(2, "Comment must be at least 2 characters"),
});

const PostDetail = () => {
  const navigate = useNavigate();
  const { user } = useContext(Context);
  const { postid } = useParams();
  const [post, setPost] = useState();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    getPostById();
    getComments();
  }, [postid]);

  useEffect(() => {
    getLikeDislikeStatus({ postid }).then((res) => setLiked(res));
  }, [postid]);

  const handleLikeDislikes = async () => {
    setLiked(!liked);
    post.likes = liked ? post.likes - 1 : post.likes + 1;
    handleLikeDislike({ postid });
  };

  const getPostById = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/post/${postid}`,
        {
          withCredentials: true,
        },
      );
      if (response.status == 200) {
        setPost(response.data.post);
        setFollowing(response.data?.post?.isFollowing);
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      console.log(error.message);
    }
  };

  const getComments = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/get/comment/${postid}`,
        {
          withCredentials: true,
        },
      );
      if (response.status == 200) {
        setComments(response.data.comments);
      }
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleCommentSubmit = async () => {
    try {
      const newComment = {
        id: comments.length + 1,
        comment: commentText,
        postid: post.postid,
        createdat: new Date().toISOString(),
        createdby: user.userid,
        user: {
          name: user.name,
          profilepic: user.profilepic,
        },
      };

      setComments([newComment, ...comments]);
      toast.success("Comment Added");
      setCommentText("");
      setShowEmojiPicker(false);

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/post/comment`,
        {
          comment: commentText,
          postid: post.postid,
        },
        {
          withCredentials: true,
        },
      );
    } catch (error) {
      console.error("Error Commenting post:", error);
      toast.error(
        error.response.data.error ||
          "An error occurred while commenting the post.",
      );
    }
  };

  const handleFollow = async (followid) => {
    try {
      setFollowing(!following);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/user/follow/${followid}`,
        {
          withCredentials: true,
        },
      );
      if (response.status == 200) {
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error(error);
    }
  };

  if (loading)
    return (
      <div className="flex h-[90vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );

  return (
    <Card className="w-full max-w-lg mx-auto mb-20 mt-5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage
              src={post?.user?.profilepic}
              alt={post?.user?.name}
              onClick={() =>
                navigate(`/user/${post?.user?.username}`, {
                  state: { user: { userid: post?.createdby } },
                })
              }
            />
            <AvatarFallback>{post?.user?.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span
              as="button"
              onClick={() =>
                navigate(`/user/${post?.user?.username}`, {
                  state: { user: { userid: post?.createdby } },
                })
              }
              className="font-semibold"
            >
              {post?.user?.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {TimeAgo(post?.postedtime)}
            </span>
          </div>
        </div>
        {user?.userid !== post?.createdby && (
          <Button
            variant={following ? "outline" : "default"}
            onClick={() => handleFollow(post?.user?.userid)}
          >
            {following ? "Unfollow" : "Follow"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <h4 className="text-xl font-semibold">{post?.title}</h4>
        {post?.images.length > 0 && (
          <ScrollArea className="h-72 w-full">
            <div className="flex space-x-2">
              {post?.images.map((image, index) => (
                <img
                  key={index}
                  src={image?.image}
                  alt={`Post image ${index + 1}`}
                  className="h-full w-auto object-cover"
                />
              ))}
            </div>
          </ScrollArea>
        )}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center space-x-2"
            onClick={() => handleLikeDislikes()}
          >
            <Heart
              className={`w-5 h-5 ${liked ? "fill-current text-red-500" : ""}`}
            />
            <span>{post?.likes}</span>
          </Button>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>{comments?.length}</span>
          </div>
        </div>
        <form onSubmit={handleSubmit(handleCommentSubmit)} className="relative">
          <Input
            id="comment"
            placeholder="Add a comment..."
            {...register("comment")}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-8 top-1/2 transform -translate-y-1/2"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="w-5 h-5" />
          </Button>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 transform -translate-y-1/2"
          >
            <Send className="w-5 h-5" />
          </Button>
          {showEmojiPicker && (
            <div className="absolute top-full right-0 z-10 mt-2">
              <Picker
                data={data}
                onEmojiSelect={(emoji) =>
                  setCommentText(commentText + emoji.native)
                }
              />
            </div>
          )}
        </form>
        {errors.comment && (
          <p className="text-sm text-red-500">{errors.comment.message}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <Separator className="my-4" />
        <h4 className="text-lg font-semibold mb-4">Comments</h4>
        {comments.length <= 0 ? (
          <p className="text-muted-foreground">No comments yet</p>
        ) : (
          <ScrollArea className="h-[300px] w-full">
            {comments.map((comment) => (
              <div
                key={comment?.id}
                className="flex items-start space-x-4 mb-4"
              >
                <Avatar>
                  <AvatarImage
                    src={comment?.user?.profilepic}
                    alt={comment?.user?.name}
                  />
                  <AvatarFallback>
                    {comment?.user?.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold">{comment?.user?.name}</span>
                  <span className="text-sm">{comment?.comment}</span>
                  <span className="text-xs text-muted-foreground">
                    {TimeAgo(comment?.createdat)}
                  </span>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </CardFooter>
    </Card>
  );
};

export default PostDetail;
