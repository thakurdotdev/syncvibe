import { getOptimizedImageUrl } from "@/Utils/Cloudinary";
import axios from "axios";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Share,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useContext, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { Context } from "../../Context/Context";
import { TimeAgo } from "../../Utils/TimeAgo";
import ImageGallery from "../Chat/ImageGallery";
import UpdatePost from "./UpdatePost";
import { Card } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";

const UserPosts = () => {
  const { user } = useContext(Context);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imagesToShow, setImagesToShow] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState('masonry'); // 'masonry' or 'grid'

  const handleEditModal = () => {
    setEditModalOpen(!editModalOpen);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      if (user.userid) {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/user/posts/${user.userid}`,
          { withCredentials: true },
        );
        if (response.status === 200) {
          const sortedPosts = (response?.data?.posts || []).sort(
            (a, b) => new Date(b.postedtime) - new Date(a.postedtime),
          );
          setPosts(sortedPosts);
        }
      }
    } catch (error) {
      console.error("Error fetching posts:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Group posts by date
  const groupedPosts = useMemo(() => {
    const groups = {};
    posts.forEach(post => {
      const date = new Date(post.postedtime);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateKey;
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(post);
    });
    
    return groups;
  }, [posts]);

  const handleDelete = async (postid) => {
    const result = await Swal.fire({
      title: "Delete Post",
      text: "Are you sure you want to delete this post? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg',
        cancelButton: 'rounded-lg'
      }
    });

    if (result.isConfirmed) {
      try {
        const response = await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/post/delete/${postid}`,
          {
            withCredentials: true,
          },
        );
        if (response.status === 200) {
          toast.success("Post deleted successfully");
          setPosts(posts.filter((post) => post.postid !== postid));
          if (selectedPost?.postid === postid) {
            setShowDetailModal(false);
            setSelectedPost(null);
          }
        }
      } catch (error) {
        console.error("Error deleting post:", error);
        toast.error("Failed to delete post");
      }
    }
  };

  const getCardSize = (index, hasImages) => {
    if (!hasImages) return 'normal';
    
    // Create more dynamic sizing like Google Photos
    const patterns = [
      'big', 'normal', 'normal', 'wide', 'normal', 'tall', 'normal', 'normal',
      'normal', 'normal', 'big', 'normal', 'wide', 'normal', 'normal', 'tall'
    ];
    
    return patterns[index % patterns.length];
  };

  const PostCard = ({ post, index, size = 'normal' }) => {
    const hasMultipleImages = post?.images?.length > 1;
    const hasImages = post?.images?.length > 0;

    const handleGalleryOpen = (e) => {
      e.stopPropagation();
      setSelectedImageIndex(0);
      setShowGallery(true);
      setImagesToShow(post.images.map((img) => img.image));
    };

    const handleCardClick = () => {
      setSelectedPost(post);
      setShowDetailModal(true);
    };

    const handleEdit = (e) => {
      e.stopPropagation();
      setEditPost(post);
      handleEditModal();
    };

    const handleDeleteClick = (e) => {
      e.stopPropagation();
      handleDelete(post.postid);
    };

    const sizeClasses = {
      normal: 'col-span-1 row-span-1',
      wide: 'col-span-2 row-span-1',
      tall: 'col-span-1 row-span-2',
      big: 'col-span-2 row-span-2'
    };

    return (
      <Card 
        className={`group relative overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white dark:bg-gray-900 border-0 shadow-md hover:shadow-black/10 dark:hover:shadow-white/5 ${sizeClasses[size]}`}
        onClick={handleCardClick}
        style={{
          borderRadius: '24px',
        }}
      >
        {/* Main Content */}
        <div className="relative w-full h-full min-h-[200px] overflow-hidden">
          {hasImages ? (
            <>
              <img
                src={getOptimizedImageUrl(post.images[0].image, {
                  thumbnail: true,
                  width: size === 'big' || size === 'wide' ? "800" : "400",
                  height: size === 'big' || size === 'tall' ? "600" : "400",
                })}
                alt={post.title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                loading="lazy"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Multiple Images Badge */}
              {hasMultipleImages && (
                <Badge 
                  variant="secondary" 
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/60 text-white border-0 backdrop-blur-md transition-all duration-200"
                >
                  <ImageIcon className="w-3 h-3 mr-1" />
                  {post.images.length}
                </Badge>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 p-6">
              <div className="text-center max-w-full">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-700 dark:text-gray-200 font-medium line-clamp-4 text-sm leading-relaxed">
                  {post.title}
                </p>
              </div>
            </div>
          )}

          {/* Hover Actions */}
          <div className="absolute inset-0 flex items-end justify-between p-6 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2 drop-shadow-lg">
                {post.title}
              </h3>
              <div className="flex items-center gap-4 text-white/90">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium">{post.likesCount || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{post.commentsCount || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{TimeAgo(post.postedtime)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 ml-4">
              {hasImages && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-10 w-10 p-0 bg-white/10 hover:bg-white/20 backdrop-blur-xl border-0 text-white rounded-full"
                  onClick={handleGalleryOpen}
                  title="View gallery"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-10 w-10 p-0 bg-white/10 hover:bg-white/20 backdrop-blur-xl border-0 text-white rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-0">
                  <DropdownMenuItem onClick={handleEdit} className="flex items-center gap-3 py-3">
                    <Pencil className="w-4 h-4" />
                    Edit post
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-3 py-3">
                    <Share className="w-4 h-4" />
                    Share post
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleDeleteClick} 
                    className="flex items-center gap-3 py-3 text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Detail Modal Component
  const PostDetailModal = ({ post, isOpen, onClose }) => {
    if (!post) return null;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 gap-0 rounded-3xl border-0 shadow-2xl">
          <div className="flex h-full">
            {/* Image Section */}
            <div className="flex-1 bg-black rounded-l-3xl flex items-center justify-center p-4">
              {post.images?.length > 0 ? (
                <img
                  src={getOptimizedImageUrl(post.images[0].image, {
                    width: "800",
                    height: "600",
                  })}
                  alt={post.title}
                  className="max-w-full max-h-full object-contain rounded-2xl"
                />
              ) : (
                <div className="text-center text-white">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg opacity-75">Text Post</p>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="w-96 bg-white dark:bg-gray-900 rounded-r-3xl flex flex-col">
              <DialogHeader className="p-6 border-b dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold">{post.title}</DialogTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onClose}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full mb-2">
                        <Heart className="w-6 h-6 text-red-500" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{post.likesCount || 0} likes</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-2">
                        <MessageCircle className="w-6 h-6 text-blue-500" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{post.commentsCount || 0} comments</p>
                    </div>
                    {post.images?.length > 0 && (
                      <div className="text-center">
                        <div className="flex items-center justify-center w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-full mb-2">
                          <ImageIcon className="w-6 h-6 text-purple-500" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{post.images.length} {post.images.length === 1 ? 'image' : 'images'}</p>
                      </div>
                    )}
                  </div>

                  {/* Post Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(post.postedtime).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>{TimeAgo(post.postedtime)}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Content</h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {post.title}
                    </p>
                  </div>

                  {/* Image Gallery */}
                  {post.images?.length > 1 && (
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">All Images</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {post.images.slice(1).map((img, index) => (
                          <img
                            key={index}
                            src={getOptimizedImageUrl(img.image, {
                              thumbnail: true,
                              width: "200",
                              height: "200",
                            })}
                            alt={`Image ${index + 2}`}
                            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setSelectedImageIndex(index + 1);
                              setShowGallery(true);
                              setImagesToShow(post.images.map((img) => img.image));
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="p-6 border-t dark:border-gray-800">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setEditPost(post);
                      handleEditModal();
                      onClose();
                    }}
                    className="flex-1 rounded-xl"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleDelete(post.postid)}
                    className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Empty State
  if (posts.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full p-12 text-center border-0 shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl" style={{ borderRadius: '32px' }}>
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-blue-500/25">
            <ImageIcon className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            No posts yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed text-lg">
            Start sharing your moments with the world. Your posts will appear here in a beautiful gallery.
          </p>
          <Link to="/feed">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-2xl shadow-blue-500/25 transition-all duration-300 rounded-2xl px-8 py-6 text-lg"
            >
              <Plus className="w-5 h-5 mr-3" />
              Create Your First Post
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/25">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Loading your posts</h3>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch your beautiful memories...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent mb-3">
                My Posts
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {posts.length} {posts.length === 1 ? 'memory' : 'memories'} captured
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant={viewMode === 'masonry' ? 'default' : 'outline'}
                onClick={() => setViewMode('masonry')}
                className="rounded-xl"
              >
                <Zap className="w-4 h-4 mr-2" />
                Smart
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                onClick={() => setViewMode('grid')}
                className="rounded-xl"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Grid
              </Button>
            </div>
          </div>

          {/* Posts by Date */}
          <div className="space-y-12">
            {Object.entries(groupedPosts).map(([dateKey, datePosts]) => (
              <div key={dateKey} className="space-y-6">
                {/* Date Header */}
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {dateKey}
                  </h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent dark:from-gray-700"></div>
                  <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full px-4 py-1">
                    {datePosts.length} {datePosts.length === 1 ? 'post' : 'posts'}
                  </Badge>
                </div>

                {/* Posts Grid */}
                <div className={
                  viewMode === 'masonry' 
                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 auto-rows-max gap-4 md:gap-6"
                    : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6"
                }>
                  {datePosts.map((post, index) => (
                    <PostCard 
                      key={post.postid} 
                      post={post} 
                      index={index}
                      size={viewMode === 'masonry' ? getCardSize(index, post.images?.length > 0) : 'normal'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Post Detail Modal */}
      <PostDetailModal 
        post={selectedPost}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPost(null);
        }}
      />

      {/* Image Gallery Modal */}
      {imagesToShow.length > 0 && showGallery && (
        <ImageGallery
          onClose={() => {
            setShowGallery(false);
            setImagesToShow([]);
          }}
          images={imagesToShow}
          initialIndex={selectedImageIndex}
        />
      )}

      {/* Edit Post Modal */}
      {editModalOpen && (
        <UpdatePost
          isOpen={editModalOpen}
          toggleDialog={handleEditModal}
          post={editPost}
          getAllPosts={fetchPosts}
        />
      )}
    </>
  );
};

export default UserPosts;
