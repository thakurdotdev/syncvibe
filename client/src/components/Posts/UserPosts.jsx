import {
  Heart,
  Image as ImageIcon,
  Images,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useContext, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useDeletePostMutation } from "@/hooks/mutations/usePostMutations"
import { useUserPostsInfiniteQuery } from "@/hooks/queries/usePostQueries"
import { getOptimizedImageUrl } from "@/Utils/Cloudinary"
import { Context } from "../../Context/Context"
import { TimeAgo } from "../../Utils/TimeAgo"
import ImageGallery from "../Chat/ImageGallery"
import { Button } from "../ui/button"
import { Dialog, DialogContent } from "../ui/dialog"
import RichTextContent from "../ui/RichTextContent"
import { ScrollArea } from "../ui/scroll-area"

const formatNumber = (num) => {
  const n = Number(num) || 0
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

const UserPosts = () => {
  const { user } = useContext(Context)
  const navigate = useNavigate()
  const [showGallery, setShowGallery] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imagesToShow, setImagesToShow] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useUserPostsInfiniteQuery(user?.userid)

  const deleteMutation = useDeletePostMutation()

  const posts = data?.pages?.flatMap((page) => page.posts) ?? []
  const stats = data?.pages?.[0]?.stats || {
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalImages: 0,
  }

  const handleDelete = (postid) => {
    if (confirm("Delete this post? This cannot be undone.")) {
      deleteMutation.mutate(postid, {
        onSuccess: () => {
          toast.success("Post deleted")
          setShowDetailModal(false)
          setSelectedPost(null)
        },
        onError: () => toast.error("Failed to delete post"),
      })
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <ImageIcon className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Posts Yet</h2>
        <p className="text-muted-foreground mb-6 text-center">
          Share your first moment with the world
        </p>
        <Button onClick={() => navigate("/post/create")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Post
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Posts</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{stats.totalPosts} posts</span>
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-red-500" />
                {formatNumber(stats.totalLikes)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                {formatNumber(stats.totalComments)}
              </span>
              <span className="flex items-center gap-1">
                <Images className="w-4 h-4" />
                {stats.totalImages}
              </span>
            </div>
          </div>
          <Button onClick={() => navigate("/post/create")}>
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {posts.map((post) => {
            const hasImages = post?.images?.length > 0
            const hasMultiple = post?.images?.length > 1

            return (
              <div
                key={post.postid}
                className="relative aspect-square bg-muted cursor-pointer group overflow-hidden rounded-sm sm:rounded-lg"
                onClick={() => {
                  setSelectedPost(post)
                  setShowDetailModal(true)
                }}
              >
                {hasImages ? (
                  <img
                    src={getOptimizedImageUrl(post.images[0].image, {
                      thumbnail: true,
                      width: "400",
                      height: "400",
                    })}
                    alt=""
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent p-4">
                    <p className="text-xs text-center text-muted-foreground line-clamp-4">
                      {post.title}
                    </p>
                  </div>
                )}

                {hasMultiple && (
                  <div className="absolute top-2 right-2">
                    <Images className="w-5 h-5 text-white drop-shadow-lg" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <Heart className="w-5 h-5 fill-white" />
                    {formatNumber(post.likesCount)}
                  </div>
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <MessageCircle className="w-5 h-5 fill-white" />
                    {formatNumber(post.commentsCount)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {hasNextPage && (
          <div className="flex justify-center mt-8">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-8"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedPost && (
            <div className="flex flex-col md:flex-row max-h-[85vh]">
              <div className="flex-1 bg-black flex items-center justify-center min-h-[250px] md:min-h-[450px]">
                {selectedPost.images?.length > 0 ? (
                  <img
                    src={getOptimizedImageUrl(selectedPost.images[0].image, {
                      width: "800",
                      height: "800",
                    })}
                    alt=""
                    className="max-w-full max-h-[60vh] object-contain cursor-pointer"
                    onClick={() => {
                      setSelectedImageIndex(0)
                      setShowGallery(true)
                      setImagesToShow(selectedPost.images.map((i) => i.image))
                    }}
                  />
                ) : (
                  <div className="text-white/50 text-center p-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2" />
                    <p>Text Post</p>
                  </div>
                )}
              </div>

              <div className="w-full md:w-72 flex flex-col bg-background">
                <div className="p-4 border-b">
                  <p className="text-xs text-muted-foreground">
                    {TimeAgo(selectedPost.postedtime)}
                  </p>
                </div>

                <ScrollArea className="flex-1 max-h-[200px] md:max-h-[350px]">
                  <div className="p-4">
                    <RichTextContent content={selectedPost.title} className="text-sm" />
                    {selectedPost.images?.length > 1 && (
                      <div className="mt-4 grid grid-cols-4 gap-1">
                        {selectedPost.images.slice(1).map((img, idx) => (
                          <img
                            key={idx}
                            src={getOptimizedImageUrl(img.image, {
                              thumbnail: true,
                              width: "80",
                              height: "80",
                            })}
                            alt=""
                            className="aspect-square object-cover rounded cursor-pointer hover:opacity-80"
                            onClick={() => {
                              setSelectedImageIndex(idx + 1)
                              setShowGallery(true)
                              setImagesToShow(selectedPost.images.map((i) => i.image))
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-red-500" />
                      {formatNumber(selectedPost.likesCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {formatNumber(selectedPost.commentsCount)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowDetailModal(false)
                        navigate(`/post/edit/${selectedPost.postid}`)
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => handleDelete(selectedPost.postid)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {imagesToShow.length > 0 && showGallery && (
        <div className="fixed inset-0 z-[100]">
          <ImageGallery
            onClose={() => {
              setShowGallery(false)
              setImagesToShow([])
            }}
            images={imagesToShow}
            initialIndex={selectedImageIndex}
          />
        </div>
      )}
    </>
  )
}

export default UserPosts
