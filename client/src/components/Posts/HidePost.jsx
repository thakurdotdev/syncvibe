import axios from 'axios';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { EyeOff, Eye } from 'lucide-react';

const HidePost = ({ postid, getAllPosts, hidestatus }) => {
  const handleHide = async () => {
    const result = await Swal.fire({
      title: hidestatus ? 'Hide Post' : 'Show Post',
      text: hidestatus
        ? 'Are you sure you want to hide this post? It will not be visible to other users.'
        : 'Are you sure you want to show this post? It will be visible to other users.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: hidestatus ? 'Hide Anyway' : 'Show Anyway',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/post/hide/${postid}`,
          {
            withCredentials: true,
          }
        );
        if (response.status === 200) {
          toast.success(response.data.message);
          getAllPosts();
        }
      } catch (error) {
        console.error('Error toggling post visibility:', error);
        toast.error('An error occurred while updating the post visibility.');
      }
    }
  };

  return (
    <button onClick={handleHide} className='p-2 rounded-full text-primary hover:bg-primary-light'>
      {hidestatus ? (
        <EyeOff className='hover:text-teal-500 h-5 w-5' />
      ) : (
        <Eye className='hover:text-teal-500 h-5 w-5' />
      )}
    </button>
  );
};

export default HidePost;
