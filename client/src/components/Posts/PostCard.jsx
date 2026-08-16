import { getOptimizedImageUrl, getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { Heart, MessageCircle, Share2 } from "lucide-react"
import { memo, useMemo, useState } from "react"
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
import { cn } from "@/lib/utils"

const formatCount = (count) => {
  const n = Number(count) || 0
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

const PostCard = memo(({ post }) => {
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

  const handleLike = (e) => {
    e?.stopPropagation?.()
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
    return (
      post.images?.map((img) => ({
        ...img,
        image: getOptimizedImageUrl(img.image, { thumbnail: false }),
      })) || []
    )
  }, [post.images])

  const goToProfile = (e) => {
    e?.stopPropagation?.()
    navigate(`/user/${post?.username}`, {
      state: { user: { userid: post?.createdby } },
    })
  }

  const goToPost = () => {
    navigate(`/feed/post/${post.postid}`)
  }

  const imageCount = post.images?.length || 0

  return (
    <article className="py-4.5 sm:py-5 px-3 sm:px-4 hover:bg-muted/15 transition-colors">
      <div className="flex items-start gap-3 sm:gap-3.5">
        {/* User Avatar */}
        <Avatar
          className="h-10 w-10 sm:h-11 sm:w-11 cursor-pointer ring-1 ring-border/60 hover:ring-primary/40 transition-all shrink-0 mt-0.5"
          onClick={goToProfile}
        >
          <AvatarImage src={getProfileCloudinaryUrl(post?.profilepic)} alt={post?.name} />
          <AvatarFallback className="text-xs sm:text-sm font-semibold bg-primary/10 text-primary">
            {post?.name?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        {/* Post Content Area */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header Row: Name, Username, Time */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              className="font-semibold text-sm sm:text-[14.5px] text-foreground hover:underline cursor-pointer truncate leading-tight"
              onClick={goToProfile}
            >
              {post.name}
            </span>
            {post.username && (
              <span className="text-muted-foreground text-xs truncate">@{post.username}</span>
            )}
            <span className="text-muted-foreground/50 text-xs">•</span>
            <span className="text-muted-foreground text-xs shrink-0 tabular-nums">
              {TimeAgo(post.postedtime)}
            </span>
          </div>

          {/* Caption */}
          {post?.title && (
            <div className="cursor-pointer" onClick={goToPost}>
              <RichTextContent
                content={post.title}
                className="text-sm sm:text-[14.5px] text-foreground/90 leading-relaxed font-normal"
                maxLength={360}
              />
            </div>
          )}

          {/* Media Container */}
          {imageCount > 0 && (
            <div className="rounded-2xl border border-border/50 overflow-hidden bg-black/40 mt-2">
              {imageCount === 1 ? (
                <img
                  src={getOptimizedImageUrl(post.images[0].image, { thumbnail: true })}
                  alt="Post media"
                  className="w-full max-h-[460px] sm:max-h-[500px] object-contain cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => {
                    setSelectedImageIndex(0)
                    setShowGallery(true)
                    setImagesToShow(galleryImages.map((img) => img.image))
                  }}
                />
              ) : (
                <div className={cn("grid gap-0.5 w-full", imageCount >= 2 && "grid-cols-2")}>
                  {post.images.slice(0, 4).map((image, idx) => (
                    <div
                      key={image.id || idx}
                      className={cn(
                        "relative cursor-pointer overflow-hidden group/img",
                        imageCount === 3 && idx === 0 && "row-span-2",
                      )}
                      onClick={() => {
                        setSelectedImageIndex(idx)
                        setShowGallery(true)
                        setImagesToShow(galleryImages.map((img) => img.image))
                      }}
                    >
                      <img
                        src={getOptimizedImageUrl(image.image, { thumbnail: true })}
                        alt={`Post media ${idx + 1}`}
                        className={cn(
                          "w-full object-cover group-hover/img:scale-102 transition-transform duration-300",
                          imageCount === 3 && idx === 0
                            ? "h-full min-h-[260px]"
                            : "h-[180px] sm:h-[220px]",
                        )}
                      />
                      {idx === 3 && imageCount > 4 && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                          <span className="text-white text-xl sm:text-2xl font-bold">
                            +{imageCount - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Simple 3 Actions: Like, Comment, Share */}
          <div className="flex items-center gap-7 pt-1.5">
            {/* Like */}
            <button
              type="button"
              className={cn(
                "group flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all active:scale-90",
                likeMutation.isPending && "pointer-events-none opacity-80",
              )}
              onClick={handleLike}
              aria-label="Like post"
            >
              <Heart
                className={cn(
                  "h-4.5 w-4.5 transition-all duration-200",
                  optimisticLiked
                    ? "fill-rose-500 text-rose-500 scale-110"
                    : "text-muted-foreground group-hover:text-rose-500 group-hover:scale-105",
                )}
              />
              {optimisticCount > 0 && (
                <span
                  className={cn(
                    "tabular-nums text-xs font-medium",
                    optimisticLiked ? "text-rose-500 font-semibold" : "text-muted-foreground",
                  )}
                >
                  {formatCount(optimisticCount)}
                </span>
              )}
            </button>

            {/* Comment */}
            <button
              type="button"
              className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-all active:scale-90"
              onClick={(e) => {
                e.stopPropagation()
                setIsCommentDrawerOpen(true)
              }}
              aria-label="Comments"
            >
              <MessageCircle className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary group-hover:scale-105 transition-all duration-200" />
              {post.commentsCount > 0 && (
                <span className="tabular-nums text-xs text-muted-foreground">
                  {formatCount(post.commentsCount)}
                </span>
              )}
            </button>

            {/* Share */}
            <button
              type="button"
              className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-all active:scale-90"
              onClick={(e) => {
                e.stopPropagation()
                setIsShareDrawerOpen(true)
              }}
              aria-label="Share post"
            >
              <Share2 className="h-4.5 w-4.5 text-muted-foreground group-hover:text-emerald-500 group-hover:scale-105 transition-all duration-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals & Drawers */}
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
})

PostCard.displayName = "PostCard"
export default PostCard
