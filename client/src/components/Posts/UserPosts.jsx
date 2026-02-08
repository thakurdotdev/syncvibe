import { getOptimizedImageUrl } from "@/Utils/Cloudinary"
import axios from "axios"
import {
  Calendar,
  Heart,
  Image as ImageIcon,
  Images,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useContext, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import Swal from "sweetalert2"
import { Context } from "../../Context/Context"
import { TimeAgo } from "../../Utils/TimeAgo"
import ImageGallery from "../Chat/ImageGallery"
import { Button } from "../ui/button"
import { Dialog, DialogContent } from "../ui/dialog"
import { ScrollArea } from "../ui/scroll-area"
import UpdatePost from "./UpdatePost"

const formatNumber = (num) => {
  const n = Number(num) || 0
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

const UserPosts = () => {
  const { user } = useContext(Context)
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showGallery, setShowGallery] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imagesToShow, setImagesToShow] = useState([])
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editPost, setEditPost] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalImages: 0,
  })

  useEffect(() => {
    fetchPosts(1)
  }, [])

  const fetchPosts = async (pageNum = 1) => {
    if (pageNum === 1) setIsLoading(true)
    try {
      if (user.userid) {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/user/posts/${user.userid}?page=${pageNum}&limit=12`,
          { withCredentials: true },
        )
        if (response.status === 200) {
          const { posts: newPosts, stats: newStats, hasMore: moreAvailable } = response.data

          if (pageNum === 1) {
            setPosts(newPosts)
          } else {
            setPosts((prev) => [...prev, ...newPosts])
          }

          setStats(newStats)
          setHasMore(moreAvailable)
        }
      }
    } catch (error) {
      console.error("Error fetching posts:", error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (postid) => {
    const result = await Swal.fire({
      title: "Delete Post",
      text: "Are you sure? This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
    })

    if (result.isConfirmed) {
      try {
        const response = await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/post/delete/${postid}`,
          { withCredentials: true },
        )
        if (response.status === 200) {
          toast.success("Post deleted")
          setPosts(posts.filter((p) => p.postid !== postid))
          // Update total count locally
          setStats((prev) => ({ ...prev, totalPosts: prev.totalPosts - 1 }))
          if (selectedPost?.postid === postid) {
            setShowDetailModal(false)
            setSelectedPost(null)
          }
        }
      } catch {
        toast.error("Failed to delete post")
      }
    }
  }

  if (isLoading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <ImageIcon className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Posts Yet</h2>
        <p className="text-muted-foreground mb-6 text-center">
          Share your first moment with the world
        </p>
        <Link to="/feed">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Post
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="px-4 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold">My Posts</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>{stats.totalPosts} posts</span>
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-red-500" />
              {formatNumber(stats.totalLikes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {formatNumber(stats.totalComments)}
            </span>
            <span className="flex items-center gap-1">
              <Images className="w-3.5 h-3.5" />
              {stats.totalImages}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {posts.map((post) => {
            const hasImages = post?.images?.length > 0
            const hasMultiple = post?.images?.length > 1

            return (
              <div
                key={post.postid}
                className="relative aspect-square bg-muted cursor-pointer group overflow-hidden rounded-lg"
                onClick={() => {
                  setSelectedPost(post)
                  setShowDetailModal(true)
                }}
              >
                {hasImages ? (
                  <img
                    src={getOptimizedImageUrl(post.images[0].image, {
                      thumbnail: true,
                      width: "300",
                      height: "300",
                    })}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted p-3">
                    <p className="text-xs text-center text-muted-foreground line-clamp-4">
                      {post.title}
                    </p>
                  </div>
                )}

                {hasMultiple && (
                  <div className="absolute top-2 right-2">
                    <svg
                      className="w-5 h-5 text-white drop-shadow-lg"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
                    </svg>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1 text-white text-sm font-semibold">
                    <Heart className="w-5 h-5 fill-white" />
                    {formatNumber(post.likesCount)}
                  </div>
                  <div className="flex items-center gap-1 text-white text-sm font-semibold">
                    <MessageCircle className="w-5 h-5 fill-white" />
                    {formatNumber(post.commentsCount)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={() => {
                const nextPage = page + 1
                setPage(nextPage)
                fetchPosts(nextPage)
              }}
              className="px-8"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                `Load More (${stats.totalPosts - posts.length} remaining)`
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showDetailModal} onOpenChange={() => setShowDetailModal(false)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedPost && (
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px]">
                {selectedPost.images?.length > 0 ? (
                  <img
                    src={getOptimizedImageUrl(selectedPost.images[0].image, {
                      width: "800",
                      height: "800",
                    })}
                    alt=""
                    className="max-w-full max-h-[70vh] object-contain cursor-pointer"
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

              <div className="w-full md:w-80 flex flex-col bg-background">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedPost.postedtime).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    <span className="text-muted-foreground/50">•</span>
                    {TimeAgo(selectedPost.postedtime)}
                  </div>
                </div>

                <ScrollArea className="flex-1 max-h-[300px] md:max-h-[400px]">
                  <div className="p-4">
                    <p className="text-sm leading-relaxed">{selectedPost.title}</p>

                    {selectedPost.images?.length > 1 && (
                      <div className="mt-4 grid grid-cols-3 gap-1">
                        {selectedPost.images.slice(1).map((img, idx) => (
                          <img
                            key={idx}
                            src={getOptimizedImageUrl(img.image, {
                              thumbnail: true,
                              width: "100",
                              height: "100",
                            })}
                            alt=""
                            className="aspect-square object-cover cursor-pointer hover:opacity-80"
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditPost(selectedPost)
                        setEditModalOpen(true)
                        setShowDetailModal(false)
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => handleDelete(selectedPost.postid)}
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
        <div className="fixed inset-0 z-100">
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

      {editModalOpen && (
        <UpdatePost
          isOpen={editModalOpen}
          toggleDialog={() => setEditModalOpen(false)}
          post={editPost}
          getAllPosts={() => {
            // Reset to first page on update
            setPage(1)
            fetchPosts(1)
          }}
        />
      )}
    </>
  )
}

export default UserPosts
