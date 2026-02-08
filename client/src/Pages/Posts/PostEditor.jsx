import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react"
import { useContext, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import RichTextEditor from "@/components/ui/RichTextEditor"
import { cn } from "@/lib/utils"
import { getOptimizedImageUrl, getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { Context } from "@/Context/Context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { usePostDetailQuery } from "@/hooks/queries/usePostQueries"
import useUploadStore from "@/stores/uploadStore"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_IMAGES = 4

const PostEditor = () => {
  const { postid } = useParams()
  const isEditMode = Boolean(postid)
  const navigate = useNavigate()
  const { user } = useContext(Context)
  const submitPost = useUploadStore((state) => state.submitPost)

  const [content, setContent] = useState("")
  const [images, setImages] = useState([])
  const [existingImages, setExistingImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const { data: postData, isLoading: isLoadingPost } = usePostDetailQuery(postid, {
    enabled: isEditMode,
  })

  useEffect(() => {
    if (postData?.post) {
      setContent(postData.post.title || "")
      setExistingImages(postData.post.images || [])
    }
  }, [postData])

  const validateImage = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(`${file.name} is not a supported image type`)
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name} exceeds 5MB limit`)
      return false
    }
    return true
  }

  const totalImages = images.length + existingImages.length

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(validateImage).slice(0, MAX_IMAGES - totalImages)

    if (imageFiles.length + totalImages > MAX_IMAGES) {
      toast.warning(`Maximum ${MAX_IMAGES} images allowed`)
    }

    setImages((prev) => [...prev, ...imageFiles])
  }

  const handleImageUpload = (event) => {
    const newImages = Array.from(event.target.files)
      .filter(validateImage)
      .slice(0, MAX_IMAGES - totalImages)

    if (newImages.length + totalImages > MAX_IMAGES) {
      toast.warning(`Maximum ${MAX_IMAGES} images allowed`)
    }

    setImages((prev) => [...prev, ...newImages])
    event.target.value = ""
  }

  const removeNewImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!content.trim() && totalImages === 0) {
      toast.error("Please add some text or images to your post")
      return
    }

    setSubmitting(true)

    submitPost({
      content,
      images,
      existingImages,
      isEditMode,
      postid,
    })

    if (isEditMode) {
      navigate(-1)
    } else {
      navigate("/feed")
    }
  }

  if (isEditMode && isLoadingPost) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="max-w-2xl mx-auto p-4 pb-20"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">{isEditMode ? "Edit Post" : "Create Post"}</h1>
      </div>

      <Card className={cn("p-4 relative", isDragging && "ring-2 ring-blue-500")}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getProfileCloudinaryUrl(user?.profilepic)} />
            <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user?.name}</p>
            <p className="text-sm text-muted-foreground">@{user?.username}</p>
          </div>
        </div>

        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="What's on your mind?"
          className="mb-4"
        />

        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none rounded-lg z-10">
            <div className="text-center space-y-2">
              <ImagePlus className="w-12 h-12 mx-auto text-blue-500" />
              <p className="text-lg font-medium">Drop images here</p>
            </div>
          </div>
        )}

        {(existingImages.length > 0 || images.length > 0) && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {existingImages.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-video rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={getOptimizedImageUrl(image.image, { thumbnail: true })}
                  alt={`Existing ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => removeExistingImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {images.map((image, index) => (
              <div
                key={index}
                className="relative aspect-video rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={URL.createObjectURL(image)}
                  alt={`New ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => removeNewImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={totalImages >= MAX_IMAGES || submitting}
          >
            <ImagePlus className="w-4 h-4 mr-2" />
            Add Images ({totalImages}/{MAX_IMAGES})
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={submitting || (!content.trim() && totalImages === 0)}
            className="min-w-[100px]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : isEditMode ? (
              "Update"
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </Card>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
      />
    </div>
  )
}

export default PostEditor
