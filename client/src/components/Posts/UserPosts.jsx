import { getOptimizedImageUrl } from "@/Utils/Cloudinary";
import axios from "axios";
import {
  ChevronRight,
  Eye,
  Heart,
  Image,
  ImageIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { Context } from "../../Context/Context";
import { TimeAgo } from "../../Utils/TimeAgo";
import ImageGallery from "../Chat/ImageGallery";
import UpdatePost from "./UpdatePost";
import { Card } from "../ui/card";

const UserPosts = () => {
  const { user } = useContext(Context);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imagesToShow, setImagesToShow] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPost, setEditPost] = useState(null);

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

  const handleDelete = async (postid) => {
    const result = await Swal.fire({
      title: "Delete Post",
      text: "Are you sure you want to delete this post? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Delete Anyway",
      cancelButtonText: "Cancel",
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
          toast.success("Post Deleted Successfully");
          setPosts(posts.filter((post) => post.postid !== postid));
        }
      } catch (error) {
        console.error("Error deleting post:", error);
        toast.error("Error deleting post");
      }
    }
  };

  const PostCard = ({ key, post }) => {
    const hasMultipleImages = post?.images?.length > 1;

    const handleGalleryOpen = (e) => {
      e.stopPropagation();
      setSelectedImageIndex(0);
      setShowGallery(true);
      setImagesToShow(post.images.map((img) => img.image));
    };

    return (
      <div className="relative group cursor-pointer rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Post Image or Content */}
        <div className="aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
          {post?.images?.length > 0 ? (
            <>
              <img
                src={getOptimizedImageUrl(post.images[0].image, {
                  thumbnail: true,
                  width: "500",
                  height: "500",
                })}
                alt={`Post by ${post.name}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Multiple Images Indicator */}
              {hasMultipleImages && (
                <div className="absolute top-3 right-3 bg-black bg-opacity-60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-medium">
                    {post.images.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 p-4 line-clamp-4">
                {post.title}
              </p>
            </div>
          )}

          {/* Progress Dots for Multiple Images */}
          {hasMultipleImages && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1">
              {post.images.map((_, index) => (
                <div
                  key={index}
                  className="w-1.5 h-1.5 rounded-full bg-white bg-opacity-60"
                />
              ))}
            </div>
          )}
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 opacity-0 group-hover:opacity-100">
          {/* Title */}
          <div className="absolute top-0 left-0 right-0 p-4">
            <p className="text-white text-sm font-medium line-clamp-2">
              {post.title}
            </p>
          </div>

          {/* Stats */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex space-x-6 text-white">
            <div className="flex items-center space-x-2 backdrop-blur-sm bg-black bg-opacity-20 rounded-full px-3 py-1">
              <Heart className="w-5 h-5" color="red" fill="red" />
              <span className="text-sm font-medium">{post.likesCount}</span>
            </div>
            <div className="flex items-center space-x-2 backdrop-blur-sm bg-black bg-opacity-20 rounded-full px-3 py-1">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{post.commentsCount}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-center">
            <span className="text-white text-xs backdrop-blur-sm bg-black bg-opacity-20 rounded-full px-3 py-1">
              {TimeAgo(post.postedtime)}
            </span>

            <div className="flex space-x-2">
              <button
                className="p-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20 backdrop-blur-sm transition-all duration-200 group/btn"
                title="Edit post"
                onClick={() => {
                  setEditPost(post);
                  handleEditModal();
                }}
              >
                <Pencil className="w-4 h-4 text-white" />
              </button>
              <button
                className="p-2 rounded-full bg-red-500 bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm transition-all duration-200 group/btn"
                title="Delete post"
                onClick={() => handleDelete(post.postid)}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
              {post.images.length > 0 && (
                <button
                  onClick={handleGalleryOpen}
                  className="p-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20 backdrop-blur-sm transition-all duration-200 flex items-center space-x-1"
                  title="View all images"
                >
                  <Eye className="w-4 h-4 text-white" />
                  {hasMultipleImages && (
                    <ChevronRight className="w-4 h-4 text-white" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Card className="p-5 text-center">
          <Image className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h6 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
            No posts yet
          </h6>
          <Link to="/feed">
            <button className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors">
              Create First Post
            </button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-[95dvh] p-4">
        {isLoading && (
          <div className="flex items-center justify-center h-[90vh] w-full">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
        <div className="mx-auto">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {posts.map((post) => (
              <PostCard key={post.postid} post={post} />
            ))}
          </div>
        </div>
      </div>
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
      <UpdatePost
        isOpen={editModalOpen}
        toggleDialog={handleEditModal}
        post={editPost}
        getAllPosts={fetchPosts}
      />
    </>
  );
};

export default UserPosts;
