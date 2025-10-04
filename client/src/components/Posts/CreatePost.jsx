import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import axios from 'axios';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useContext, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Context } from '../../Context/Context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { PlusIcon } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_CONTENT_LENGTH = 500;
const MAX_IMAGES = 4;

const CreatePost = ({ openModal, setPosts }) => {
  const { user } = useContext(Context);
  const [open, setOpen] = useState(openModal || false);
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);

  const resetState = () => {
    setContent('');
    setImages([]);
    setCurrentImageIndex(0);

    setIsDragging(false);
  };

  const validateContent = () => {
    if (!content.trim() && images.length === 0) {
      toast.error('Please add some text or images to your post');
      return false;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      toast.error(`Content exceeds ${MAX_CONTENT_LENGTH} characters`);
      return false;
    }
    return true;
  };

  const validateImage = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(`${file.name} is not a supported image type`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name} exceeds 5MB limit`);
      return false;
    }
    return true;
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(validateImage).slice(0, MAX_IMAGES - images.length);

    if (imageFiles.length + images.length > MAX_IMAGES) {
      toast.warning(`Maximum ${MAX_IMAGES} images allowed`);
    }

    setImages((prev) => [...prev, ...imageFiles]);
  };

  const handleImageUpload = (event) => {
    const newImages = Array.from(event.target.files)
      .filter(validateImage)
      .slice(0, MAX_IMAGES - images.length);

    if (newImages.length + images.length > MAX_IMAGES) {
      toast.warning(`Maximum ${MAX_IMAGES} images allowed`);
    }

    setImages((prev) => [...prev, ...newImages]);
    event.target.value = '';
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const newImages = prev.filter((_, i) => i !== index);
      if (currentImageIndex >= newImages.length) {
        setCurrentImageIndex(Math.max(0, newImages.length - 1));
      }
      return newImages;
    });
  };

  const handleSubmit = async () => {
    if (!validateContent()) return;

    const formData = new FormData();
    formData.append('title', content);
    images.forEach((image) => formData.append('images', image));

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/create`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        setOpen(false);
        resetState();
        toast.success('Post created successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          resetState();
        }
        setOpen(newOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant='secondary'
          className='h-10 max-md:w-10 flex items-center gap-2 rounded-full'
          title='Create Post'
        >
          <PlusIcon />
          <span className='hidden md:block'>Create</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        ref={dialogRef}
        className={cn('sm:max-w-[600px] p-0', isDragging && 'ring-2 ring-blue-500 ring-inset')}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <DialogHeader className='p-4 border-b dark:border-gray-700'>
          <DialogTitle className='flex items-center space-x-2'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={getProfileCloudinaryUrl(user?.profilepic)} />
              <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <span className='ml-2 font-semibold'>Create Post</span>
          </DialogTitle>
        </DialogHeader>

        <div className='p-4 space-y-4'>
          {/* Content Input */}
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className='min-h-[100px] w-full'
            spellCheck='true'
          />

          <div className='text-sm text-gray-500 flex justify-between'>
            <span>
              {content.length} / {MAX_CONTENT_LENGTH}
            </span>
          </div>

          {/* Drag & Drop Zone */}
          {isDragging && (
            <div className='absolute inset-0 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none'>
              <div className='text-center space-y-2'>
                <Upload className='w-12 h-12 mx-auto text-blue-500' />
                <p className='text-lg font-medium'>Drop images here</p>
              </div>
            </div>
          )}

          {/* Image Preview */}
          {images.length > 0 && (
            <div className='relative rounded-lg overflow-hidden bg-black aspect-video'>
              <img
                src={URL.createObjectURL(images[currentImageIndex])}
                alt='Preview'
                className='w-full h-full object-contain'
              />

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <Button
                    variant='ghost'
                    size='icon'
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white',
                      currentImageIndex === 0 ? 'invisible' : 'left-2'
                    )}
                    onClick={() => setCurrentImageIndex((prev) => prev - 1)}
                    disabled={currentImageIndex === 0}
                  >
                    <ChevronLeft className='w-4 h-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white',
                      currentImageIndex === images.length - 1 ? 'invisible' : 'right-2'
                    )}
                    onClick={() => setCurrentImageIndex((prev) => prev + 1)}
                    disabled={currentImageIndex === images.length - 1}
                  >
                    <ChevronRight className='w-4 h-4' />
                  </Button>
                </>
              )}

              {/* Image Counter */}
              {images.length > 1 && (
                <div className='absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded-full text-sm'>
                  {currentImageIndex + 1} / {images.length}
                </div>
              )}

              {/* Remove Image Button */}
              <Button
                variant='destructive'
                size='icon'
                className='absolute top-4 left-4'
                onClick={() => removeImage(currentImageIndex)}
              >
                <Trash2 className='w-4 h-4' />
              </Button>
            </div>
          )}

          {/* Image Grid Preview */}
          {images.length > 1 && (
            <div className='grid grid-cols-4 gap-2'>
              {images.map((image, index) => (
                <div
                  key={index}
                  className={cn(
                    'relative aspect-square cursor-pointer rounded-md overflow-hidden',
                    currentImageIndex === index && 'ring-2 ring-blue-500'
                  )}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Preview ${index + 1}`}
                    className='w-full h-full object-cover'
                  />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className='flex items-center justify-between pt-2'>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= MAX_IMAGES || loading}
              title={
                images.length >= MAX_IMAGES ? `Maximum ${MAX_IMAGES} images allowed` : 'Add images'
              }
            >
              <ImagePlus className='w-5 h-5' />
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && images.length === 0)}
              className='min-w-[100px]'
            >
              {loading ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  Posting...
                </>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </div>

        <input
          type='file'
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple
          className='hidden'
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreatePost;
