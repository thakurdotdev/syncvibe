import { cn } from "@/lib/utils"
import { getOptimizedImageUrl, getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { yupResolver } from "@hookform/resolvers/yup"
import axios from "axios"
import { ArrowLeft, Heart, Loader2, MessageSquare, Send, Share2 } from "lucide-react"
import { useContext, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import * as Yup from "yup"
import { Context } from "../../Context/Context"
import { getLikeDislikeStatus, handleLikeDislike } from "../../Utils/LikeDislike"
import { TimeAgo } from "../../Utils/TimeAgo"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Input } from "../ui/input"
import RichTextContent from "../ui/RichTextContent"
import ShareDrawer from "./ShareDrawer"

const validationSchema = Yup.object().shape({
  comment: Yup.string()
    .required("Comment is required")
    .min(1, "Comment cannot be empty"),
})

const PostDetail = () => {
  const navigate = useNavigate()
  const { user } = useContext(Context)
  const { postid } = useParams()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState("")
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(validationSchema),
  })

  useEffect(() => {
    getPostById()
    getComments()
  }, [postid])

  useEffect(() => {
    getLikeDislikeStatus({ postid }).then((res) => setLiked(res))
  }, [postid])

  const handleLikeDislikes = async () => {
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1))
    await handleLikeDislike({ postid })
  }

  const getPostById = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/post/${postid}`, {
        withCredentials: true,
      })
      if (response.status === 200) {
        setPost(response.data.post)
        setLikesCount(Number(response.data.post?.likes) || 0)
        setFollowing(response.data?.post?.isFollowing)
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to load post")
    } finally {
      setLoading(false)
    }
  }

  const getComments = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/get/comment/${postid}`,
        {
          withCredentials: true,
        },
      )
      if (response.status === 200) {
        setComments(response.data.comments || [])
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleCommentSubmit = async (data) => {
    try {
      const newComment = {
        id: comments.length + 1,
        comment: data.comment,
        postid: post.postid,
        createdat: new Date().toISOString(),
        createdby: user.userid,
        user: {
          name: user.name,
          profilepic: user.profilepic,
          username: user.username,
        },
      }

      setComments((prev) => [newComment, ...prev])
      reset()
      setCommentText("")

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/comment/add`,
        {
          postid: post.postid,
          comment: data.comment,
        },
        {
          withCredentials: true,
        },
      )
      getComments()
    } catch (error) {
      toast.error("Failed to post comment")
    }
  }

  const handleFollow = async (followid) => {
    try {
      setFollowing(!following)
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/user/follow/${followid}`,
        {
          withCredentials: true,
        },
      )
      if (response.status === 200) {
        toast.success(response.data.message)
      }
    } catch (error) {
      setFollowing(following)
      toast.error("Failed to follow user")
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <p className="text-muted-foreground text-sm">Post not found or has been removed.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/feed")} className="rounded-xl">
          Back to feed
        </Button>
      </div>
    )
  }

  const images = post?.images || []

  return (
    <div className="max-w-xl md:max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-32 sm:pb-20 space-y-4">
      {/* Back Button Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-xl h-8 px-2.5 cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Back</span>
        </Button>
      </div>

      {/* Main Post Card */}
      <Card className="rounded-2xl border-border/80 bg-card/60 backdrop-blur-xl shadow-xs overflow-hidden p-4 sm:p-5 space-y-4">
        {/* Author Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar
              className="h-10 w-10 sm:h-11 sm:w-11 cursor-pointer ring-1.5 ring-border/60 hover:ring-primary/40 transition-all shrink-0"
              onClick={() =>
                navigate(`/user/${post?.user?.username || post?.username}`, {
                  state: { user: { userid: post?.createdby } },
                })
              }
            >
              <AvatarImage
                src={getProfileCloudinaryUrl(post?.user?.profilepic || post?.profilepic)}
                alt={post?.user?.name || post?.name}
              />
              <AvatarFallback className="text-xs sm:text-sm font-semibold bg-primary/10 text-primary">
                {(post?.user?.name || post?.name)?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col min-w-0">
              <span
                className="font-semibold text-sm sm:text-[14.5px] text-foreground hover:underline cursor-pointer truncate"
                onClick={() =>
                  navigate(`/user/${post?.user?.username || post?.username}`, {
                    state: { user: { userid: post?.createdby } },
                  })
                }
              >
                {post?.user?.name || post?.name}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {(post?.user?.username || post?.username) && (
                  <span className="truncate">@{post?.user?.username || post?.username}</span>
                )}
                <span className="text-muted-foreground/50">•</span>
                <span className="shrink-0 tabular-nums">{TimeAgo(post?.postedtime)}</span>
              </div>
            </div>
          </div>

          {user?.userid !== post?.createdby && (
            <Button
              variant={following ? "outline" : "default"}
              size="sm"
              className="rounded-xl h-8 px-3 text-xs font-semibold cursor-pointer"
              onClick={() => handleFollow(post?.user?.userid || post?.createdby)}
            >
              {following ? "Following" : "Follow"}
            </Button>
          )}
        </div>

        {/* Formatted Post Content */}
        {post?.title && (
          <div className="pt-1">
            <RichTextContent
              content={post.title}
              className="text-sm sm:text-base text-foreground leading-relaxed font-normal"
              expandable={false}
            />
          </div>
        )}

        {/* Media Grid / Images */}
        {images.length > 0 && (
          <div className="rounded-2xl border border-border/50 overflow-hidden bg-black/40">
            {images.length === 1 ? (
              <img
                src={getOptimizedImageUrl(images[0].image, { thumbnail: false })}
                alt="Post media"
                className="w-full max-h-[500px] object-contain"
              />
            ) : (
              <div className="grid gap-1 grid-cols-2">
                {images.map((img, i) => (
                  <img
                    key={img.id || i}
                    src={getOptimizedImageUrl(img.image, { thumbnail: true })}
                    alt={`Media ${i + 1}`}
                    className="w-full h-56 sm:h-64 object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-6 pt-2 border-t border-border/40">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-transform active:scale-90"
            onClick={handleLikeDislikes}
            aria-label="Like post"
          >
            <Heart
              className={cn(
                "h-4.5 w-4.5 transition-all duration-200",
                liked
                  ? "fill-rose-500 text-rose-500 scale-110"
                  : "text-muted-foreground hover:text-rose-500",
              )}
            />
            <span className={cn("tabular-nums", liked ? "text-rose-500 font-semibold" : "text-muted-foreground")}>
              {likesCount}
            </span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-4.5 w-4.5 text-muted-foreground" />
            <span className="tabular-nums">{comments?.length || 0}</span>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setIsShareDrawerOpen(true)}
            aria-label="Share post"
          >
            <Share2 className="h-4.5 w-4.5 hover:text-emerald-500 transition-colors" />
          </button>
        </div>

        {/* Add Comment Input */}
        <form onSubmit={handleSubmit(handleCommentSubmit)} className="relative pt-2">
          <Input
            placeholder="Write a comment..."
            {...register("comment")}
            className="pr-10 rounded-xl bg-muted/40 border-border/50 text-xs sm:text-sm h-10"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={isSubmitting}
            className="absolute right-1 top-3.5 h-7 w-7 rounded-lg text-primary hover:text-primary/80 hover:bg-primary/10 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        {errors.comment && <p className="text-xs text-destructive">{errors.comment.message}</p>}

        {/* Comments Section */}
        <div className="pt-3 border-t border-border/40 space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Comments ({comments.length})
          </h4>

          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 py-3 text-center">No comments yet. Be the first to reply!</p>
          ) : (
            <div className="divide-y divide-border/30">
              {comments.map((comment) => (
                <div key={comment?.id} className="flex items-start gap-3 py-3">
                  <Avatar className="h-8 w-8 ring-1 ring-border/50 shrink-0 mt-0.5">
                    <AvatarImage
                      src={getProfileCloudinaryUrl(comment?.user?.profilepic)}
                      alt={comment?.user?.name}
                    />
                    <AvatarFallback className="text-[11px] font-semibold bg-muted">
                      {comment?.user?.name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 space-y-0.5 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">
                        {comment?.user?.name}
                      </span>
                      <span className="text-muted-foreground/60 text-[10px]">•</span>
                      <span className="text-[10.5px] text-muted-foreground tabular-nums">
                        {TimeAgo(comment?.createdat)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] text-foreground/90 leading-relaxed break-words">
                      {comment?.comment}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ShareDrawer
        isOpen={isShareDrawerOpen}
        onClose={() => setIsShareDrawerOpen(false)}
        postid={post.postid}
      />
    </div>
  )
}

export default PostDetail
