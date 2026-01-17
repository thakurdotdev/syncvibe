import { getOptimizedImageUrl, getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { Heart, MessageCircle, Share2 } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { handleLikeDislike } from "../../Utils/LikeDislike"
import { TimeAgo } from "../../Utils/TimeAgo"
import ImageGallery from "../Chat/ImageGallery"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import BlurFade from "../ui/blur-fade"
import { Card } from "../ui/card"
import NumberTicker from "../ui/number-ticker"
import CommentDrawer from "./CommentDrawer"
import ShareDrawer from "./ShareDrawer"

const PostCard = ({ post, setPosts }) => {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imagesToShow, setImagesToShow] = useState([])
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false)
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false)
  const [loadedImages, setLoadedImages] = useState(new Set())

  const toggleExpand = useCallback(() => setIsExpanded((prev) => !prev), [])

  const handleLikeDislikePost = useCallback(
    async (postid) => {
      try {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postid === postid
              ? {
                  ...post,
                  likesCount: post.likedByCurrentUser
                    ? Number(post.likesCount) - 1
                    : Number(post.likesCount) + 1,
                  likedByCurrentUser: !post.likedByCurrentUser,
                }
              : post,
          ),
        )
        await handleLikeDislike({ postid })
      } catch (error) {
        console.error("Error handling like/dislike:", error)
      }
    },
    [setPosts],
  )

  // Prepare optimized image URLs for gallery view
  const galleryImages = useMemo(() => {
    return post.images.map((img) => ({
      ...img,
      image: getOptimizedImageUrl(img.image, { thumbnail: false }),
    }))
  }, [post.images])

  const handleImageLoad = (imageId) => {
    setLoadedImages((prev) => new Set([...prev, imageId]))
  }

  return (
    <Card className="mb-3 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Avatar className="mr-4">
              <AvatarImage
                src={getProfileCloudinaryUrl(post?.profilepic)}
                alt={post?.name}
                className="w-12 h-12 rounded-full mr-4 cursor-pointer border hover:opacity-70 border-gray-300 dark:border-gray-700"
                onClick={() =>
                  navigate(`/user/${post?.username}`, {
                    state: { user: { userid: post?.createdby } },
                  })
                }
              />
              <AvatarFallback
                className="w-12 h-12 rounded-full cursor-pointer border hover:opacity-70 border-gray-300 dark:border-gray-700"
                title={post?.name}
                onClick={() =>
                  navigate(`/user/${post?.username}`, {
                    state: { user: { userid: post?.createdby } },
                  })
                }
              >
                {post?.name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-bold text-lg">{post.name}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{TimeAgo(post.postedtime)}</p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div
            className={`${isExpanded ? "" : "line-clamp-3"} dark:text-gray-100 whitespace-pre-line`}
          >
            {post?.title}
          </div>
          {post?.title?.length > 100 && (
            <button
              onClick={toggleExpand}
              className="text-blue-500 dark:text-blue-400 hover:underline mt-2"
            >
              {isExpanded ? "Read Less" : "Read More"}
            </button>
          )}
        </div>

        {post.images.length > 0 && (
          <div
            className={`my-4 grid gap-1 ${
              post.images.length === 1
                ? "grid-cols-1"
                : post.images.length === 2
                  ? "grid-cols-2"
                  : post.images.length === 3
                    ? "grid-cols-2"
                    : "grid-cols-2"
            }`}
          >
            {post.images.map((image, idx) => (
              <BlurFade key={image.id} delay={0.25 + idx * 0.05} inView>
                <div className="relative">
                  {!loadedImages.has(image.id) && (
                    <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg" />
                  )}
                  <img
                    key={image.id}
                    src={getOptimizedImageUrl(image.image, { thumbnail: true })}
                    alt={`Post ${idx + 1}`}
                    className={`w-full rounded-lg cursor-pointer hover:opacity-75 transition duration-200 ease-in-out ${
                      post.images.length === 1
                        ? "max-h-[512px] object-contain"
                        : "h-64 object-cover"
                    } ${loadedImages.has(image.id) ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => handleImageLoad(image.id)}
                    onClick={() => {
                      setSelectedImageIndex(idx)
                      setShowGallery(true)
                      setImagesToShow(galleryImages.map((img) => img.image))
                    }}
                  />
                </div>
              </BlurFade>
            ))}
          </div>
        )}
      </div>

      <div className="flex border-t border-gray-200 dark:border-gray-700">
        <button
          className="flex-1 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-200 flex items-center justify-center dark:text-gray-200"
          onClick={() => handleLikeDislikePost(post.postid)}
        >
          <Heart
            className={`w-5 h-5 mr-2 ${
              post.likedByCurrentUser
                ? "fill-current text-red-500"
                : "text-gray-600 dark:text-gray-100"
            }`}
          />
          <NumberTicker value={post.likesCount} />
        </button>
        <button
          className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-200 flex items-center justify-center"
          onClick={() => setIsCommentDrawerOpen(true)}
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          <NumberTicker value={post.commentsCount} />
        </button>
        <button
          className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-200 flex items-center justify-center"
          onClick={() => setIsShareDrawerOpen(true)}
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share
        </button>
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
        setPosts={setPosts}
      />

      <ShareDrawer
        isOpen={isShareDrawerOpen}
        onClose={() => setIsShareDrawerOpen(false)}
        postid={post.postid}
      />
    </Card>
  )
}

export default PostCard
