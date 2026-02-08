import { getOptimizedImageUrl, getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { Heart, MessageCircle, Send } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { TimeAgo } from "../../Utils/TimeAgo"
import ImageGallery from "../Chat/ImageGallery"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import RichTextContent from "../ui/RichTextContent"
import CommentDrawer from "./CommentDrawer"
import ShareDrawer from "./ShareDrawer"
import { useLikeDislikeMutation } from "@/hooks/mutations/usePostMutations"
import { postKeys } from "@/api/posts"

const formatCount = (count) => {
  const n = Number(count) || 0
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

const PostCard = ({ post }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showGallery, setShowGallery] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imagesToShow, setImagesToShow] = useState([])
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false)
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false)

  const [optimisticLiked, setOptimisticLiked] = useState(post.likedByCurrentUser)
  const [optimisticCount, setOptimisticCount] = useState(Number(post.likesCount) || 0)

  const likeMutation = useLikeDislikeMutation()

  const handleLike = () => {
    if (likeMutation.isPending) return

    const wasLiked = optimisticLiked
    setOptimisticLiked(!wasLiked)
    setOptimisticCount((prev) => (wasLiked ? prev - 1 : prev + 1))

    likeMutation.mutate(post.postid, {
      onError: () => {
        setOptimisticLiked(wasLiked)
        setOptimisticCount((prev) => (wasLiked ? prev + 1 : prev - 1))
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: postKeys.all })
      },
    })
  }

  const galleryImages = useMemo(() => {
    return post.images.map((img) => ({
      ...img,
      image: getOptimizedImageUrl(img.image, { thumbnail: false }),
    }))
  }, [post.images])

  const goToProfile = () => {
    navigate(`/user/${post?.username}`, {
      state: { user: { userid: post?.createdby } },
    })
  }

  const goToPost = () => {
    navigate(`/feed/post/${post.postid}`)
  }

  const imageCount = post.images?.length || 0

  return (
    <article className="bg-card rounded-xl border overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Avatar
          className="h-10 w-10 cursor-pointer ring-2 ring-primary/10 hover:ring-primary/30 transition-all"
          onClick={goToProfile}
        >
          <AvatarImage src={getProfileCloudinaryUrl(post?.profilepic)} alt={post?.name} />
          <AvatarFallback className="text-sm font-medium">{post?.name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm hover:underline cursor-pointer"
              onClick={goToProfile}
            >
              {post.name}
            </span>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-muted-foreground text-xs">{TimeAgo(post.postedtime)}</span>
          </div>
          {post.username && <p className="text-muted-foreground text-xs">@{post.username}</p>}
        </div>
      </div>

      {post?.title && (
        <div className="px-4 pb-3">
          <RichTextContent
            content={post.title}
            className="text-sm leading-relaxed"
            maxLength={280}
          />
        </div>
      )}

      {imageCount > 0 && (
        <div className="bg-black/5 dark:bg-white/5">
          {imageCount === 1 ? (
            <img
              src={getOptimizedImageUrl(post.images[0].image, { thumbnail: true })}
              alt="Post"
              className="w-full max-h-[480px] object-contain cursor-pointer"
              onClick={() => {
                setSelectedImageIndex(0)
                setShowGallery(true)
                setImagesToShow(galleryImages.map((img) => img.image))
              }}
            />
          ) : (
            <div className={`grid gap-0.5 ${imageCount >= 2 ? "grid-cols-2" : ""}`}>
              {post.images.slice(0, 4).map((image, idx) => (
                <div
                  key={image.id}
                  className={`relative cursor-pointer overflow-hidden ${
                    imageCount === 3 && idx === 0 ? "row-span-2" : ""
                  }`}
                  onClick={() => {
                    setSelectedImageIndex(idx)
                    setShowGallery(true)
                    setImagesToShow(galleryImages.map((img) => img.image))
                  }}
                >
                  <img
                    src={getOptimizedImageUrl(image.image, { thumbnail: true })}
                    alt={`Post ${idx + 1}`}
                    className={`w-full object-cover hover:opacity-90 transition-opacity ${
                      imageCount === 3 && idx === 0
                        ? "h-full min-h-[240px]"
                        : "h-[180px] sm:h-[220px]"
                    }`}
                  />
                  {idx === 3 && imageCount > 4 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">+{imageCount - 4}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              className={`group flex items-center gap-2 transition-transform active:scale-90 ${
                likeMutation.isPending ? "pointer-events-none" : ""
              }`}
              onClick={handleLike}
            >
              <Heart
                className={`h-6 w-6 transition-colors ${
                  optimisticLiked
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground group-hover:text-red-500"
                }`}
              />
              {optimisticCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {formatCount(optimisticCount)}
                </span>
              )}
            </button>
            <button
              className="group flex items-center gap-2"
              onClick={() => setIsCommentDrawerOpen(true)}
            >
              <MessageCircle className="h-6 w-6 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              {post.commentsCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {formatCount(post.commentsCount)}
                </span>
              )}
            </button>
            <button className="group" onClick={() => setIsShareDrawerOpen(true)}>
              <Send className="h-5 w-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {imagesToShow.length > 0 && showGallery && (
        <ImageGallery
          onClose={() => {
            setShowGallery(false)
            setImagesToShow([])
          }}
          images={imagesToShow}
          initialIndex={selectedImageIndex}
        />
      )}

      <CommentDrawer
        isOpen={isCommentDrawerOpen}
        onClose={() => setIsCommentDrawerOpen(false)}
        postid={post.postid}
      />

      <ShareDrawer
        isOpen={isShareDrawerOpen}
        onClose={() => setIsShareDrawerOpen(false)}
        postid={post.postid}
      />
    </article>
  )
}

export default PostCard
