import { getOptimizedImageUrl } from "@/Utils/Cloudinary";
import axios from "axios";
import {
  Calendar,
  Clock,
  Eye,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Share,
  Trash2,
} from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { Context } from "../../Context/Context";
import { TimeAgo } from "../../Utils/TimeAgo";
import ImageGallery from "../Chat/ImageGallery";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ScrollArea } from "../ui/scroll-area";
import UpdatePost from "./UpdatePost";

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

  const groupedPosts = useMemo(() => {
    const groups = {};
    posts.forEach((post) => {
      const date = new Date(post.postedtime);
      const today = new Date();
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const postMonth = new Date(date.getFullYear(), date.getMonth(), 1);

      let dateKey;
      if (postMonth.getTime() === currentMonth.getTime()) {
        dateKey = "This Month";
      } else if (postMonth.getTime() === lastMonth.getTime()) {
        dateKey = "Last Month";
      } else {
        dateKey = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(post);
    });

    // Sort groups by date (newest first)
    const sortedGroups = {};
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "This Month") return -1;
      if (b === "This Month") return 1;
      if (a === "Last Month") return -1;
      if (b === "Last Month") return 1;
      return new Date(b + " 1") - new Date(a + " 1");
    });

    sortedKeys.forEach((key) => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [posts]);

  const handleDelete = async (postid) => {
    const result = await Swal.fire({
      title: "Delete Post",
      text: "Are you sure you want to delete this post? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "hsl(var(--destructive))",
      cancelButtonColor: "hsl(var(--muted))",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      customClass: {
        popup: "rounded-2xl",
        confirmButton: "rounded-lg",
        cancelButton: "rounded-lg",
      },
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

  const PostCard = ({ post, index, size = "normal" }) => {
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
      normal: "col-span-1 row-span-1",
      wide: "col-span-2 row-span-1",
      tall: "col-span-1 row-span-2",
      big: "col-span-2 row-span-2",
    };

    return (
      <Card
        className={`group relative overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-lg hover:-translate-y-1 bg-card border-border shadow-sm hover:shadow-primary/5 ${sizeClasses[size]}`}
        onClick={handleCardClick}
        style={{
          borderRadius: "16px",
        }}
      >
        {/* Main Content */}
        <div className="relative w-full h-full min-h-[200px] overflow-hidden">
          {hasImages ? (
            <>
              <img
                src={getOptimizedImageUrl(post.images[0].image, {
                  thumbnail: true,
                  width: size === "big" || size === "wide" ? "800" : "400",
                  height: size === "big" || size === "tall" ? "600" : "400",
                })}
                alt={post.title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                loading="lazy"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Multiple Images Badge */}
              {hasMultipleImages && (
                <Badge
                  variant="secondary"
                  className="absolute top-3 right-3 bg-background/80 hover:bg-background/90 text-foreground border-border backdrop-blur-sm transition-all duration-200"
                >
                  <ImageIcon className="w-3 h-3 mr-1" />
                  {post.images.length}
                </Badge>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted p-6">
              <div className="text-center max-w-full">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <MessageCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <p className="text-foreground font-medium line-clamp-4 text-sm leading-relaxed">
                  {post.title}
                </p>
              </div>
            </div>
          )}

          {/* Hover Actions */}
          <div className="absolute inset-0 flex items-end justify-between p-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-base mb-2 line-clamp-2 drop-shadow-lg">
                {post.title}
              </h3>
              <div className="flex items-center gap-3 text-white/90 text-sm">
                <div className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-red-400" />
                  <span className="font-medium">{post.likesCount || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="font-medium">{post.commentsCount || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs">{TimeAgo(post.postedtime)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 ml-3 flex-shrink-0">
              {hasImages && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 backdrop-blur-xl border-0 text-white rounded-full"
                  onClick={handleGalleryOpen}
                  title="View gallery"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 backdrop-blur-xl border-0 text-white rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-xl shadow-lg border"
                >
                  <DropdownMenuItem
                    onClick={handleEdit}
                    className="flex items-center gap-3 py-3"
                  >
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
                    className="flex items-center gap-3 py-3 text-destructive focus:text-destructive focus:bg-destructive/10"
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

  const PostDetailModal = ({ post, isOpen, onClose }) => {
    if (!post) return null;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-xl">
          <div className="flex flex-col md:flex-row h-full">
            {/* Image Section */}
            <div className="flex-1 bg-muted rounded-l-2xl flex items-center justify-center p-4">
              {post.images?.length > 0 ? (
                <img
                  src={getOptimizedImageUrl(post.images[0].image, {
                    width: "800",
                    height: "600",
                  })}
                  alt={post.title}
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg opacity-75">Text Post</p>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="w-96 bg-card rounded-r-2xl flex flex-col">
              <DialogHeader className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold">
                    Post Details
                  </DialogTitle>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 bg-red-500/10 rounded-full mb-2">
                        <Heart className="w-6 h-6 text-red-500" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {post.likesCount || 0} likes
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-2">
                        <MessageCircle className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {post.commentsCount || 0} comments
                      </p>
                    </div>
                    {post.images?.length > 0 && (
                      <div className="text-center">
                        <div className="flex items-center justify-center w-12 h-12 bg-accent rounded-full mb-2">
                          <ImageIcon className="w-6 h-6 text-accent-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.images.length}{" "}
                          {post.images.length === 1 ? "image" : "images"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Post Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(post.postedtime).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{TimeAgo(post.postedtime)}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <h4 className="font-semibold mb-2 text-foreground">
                      Content
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      {post.title}
                    </p>
                  </div>

                  {/* Image Gallery */}
                  {post.images?.length > 1 && (
                    <div>
                      <h4 className="font-semibold mb-3 text-foreground">
                        All Images
                      </h4>
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
                              setImagesToShow(
                                post.images.map((img) => img.image),
                              );
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="p-6 border-t">
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
                    className="flex-1 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10"
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

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card
          className="max-w-lg w-full p-12 text-center border shadow-lg bg-card"
          style={{ borderRadius: "24px" }}
        >
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <ImageIcon className="w-12 h-12 text-primary-foreground" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-4">
            No posts yet
          </h3>
          <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
            Start sharing your moments with the world. Your posts will appear
            here in a beautiful gallery.
          </p>
          <Link to="/feed">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all duration-300 rounded-xl px-8 py-6 text-lg"
            >
              <Plus className="w-5 h-5 mr-3" />
              Create Your First Post
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />

        <h3 className="text-xl font-semibold text-foreground mb-2">
          Loading your posts...
        </h3>
        <p className="text-muted-foreground">
          Please wait while we fetch your beautiful memories...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-row sm:items-center justify-between gap-4 mb-12">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              My Posts
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              {posts.length} {posts.length === 1 ? "memory" : "memories"}{" "}
              captured
            </p>
          </div>

          {/* Posts by Month */}
          <div className="space-y-12">
            {Object.entries(groupedPosts).map(([monthKey, monthPosts]) => (
              <div key={monthKey} className="space-y-6">
                {/* Month Header */}
                <div className="flex items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    {monthKey}
                  </h2>
                  <div className="flex-1 h-px bg-border"></div>
                  <Badge
                    variant="secondary"
                    className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm"
                  >
                    {monthPosts.length}{" "}
                    {monthPosts.length === 1 ? "post" : "posts"}
                  </Badge>
                </div>

                {/* Posts Grid */}
                <div
                  className={
                    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
                  }
                >
                  {monthPosts.map((post, index) => (
                    <PostCard
                      key={post.postid}
                      post={post}
                      index={index}
                      size={"normal"}
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
