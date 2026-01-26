import axios from "axios"
import { Loader2, Upload, X } from "lucide-react"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Context } from "@/Context/Context"
import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { uploadToCloudinary } from "@/Utils/cloudinaryUpload"
import { popularSongs } from "@/Utils/constant"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogTitle } from "../ui/revola"
import { Input } from "../ui/input"
import { Progress } from "../ui/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet"

const CreateStory = ({ onClose, isOpen, onSuccess }) => {
  const { user } = useContext(Context)

  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [isVideo, setIsVideo] = useState(false)

  const [selectedMusic, setSelectedMusic] = useState(null)
  const [isMusicSheetOpen, setIsMusicSheetOpen] = useState(false)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fileInputRef = useRef(null)

  const validateFile = useCallback((file) => {
    if (!file) {
      toast.error("Please select a file")
      return false
    }

    if (file.size > 30 * 1024 * 1024) {
      toast.error("File size should be less than 30MB")
      return false
    }

    const isValidFileType = file.type.startsWith("image/") || file.type.startsWith("video/")
    if (!isValidFileType) {
      toast.error("Only image or video files are allowed")
      return false
    }

    return true
  }, [])

  const handleFileSelect = useCallback(
    async (file) => {
      if (!validateFile(file)) return

      const isVideoFile = file.type.startsWith("video/")
      setIsVideo(isVideoFile)

      if (isVideoFile) {
        try {
          const video = document.createElement("video")
          video.preload = "metadata"

          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve
            video.onerror = reject
            video.src = URL.createObjectURL(file)
          })

          if (video.duration > 30) {
            toast.error("Video duration should be less than 30 seconds")
            URL.revokeObjectURL(video.src)
            return
          }

          URL.revokeObjectURL(video.src)
        } catch (err) {
          toast.error("Error processing video file")
          return
        }
      }

      if (preview) {
        URL.revokeObjectURL(preview)
      }

      const previewUrl = URL.createObjectURL(file)
      setSelectedFile(file)
      setPreview(previewUrl)
    },
    [preview, validateFile],
  )

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const uploadResult = await uploadToCloudinary(selectedFile, "story", (progress) =>
        setUploadProgress(progress),
      )

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/story/create`,
        {
          mediaUrl: uploadResult.image,
          mediaType: uploadResult.resourceType,
          musicId: selectedMusic?.id,
        },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      )

      if (response.status === 200) {
        toast.success("Story uploaded successfully")
        onSuccess()
        onClose()
        setSelectedFile(null)
        if (preview) URL.revokeObjectURL(preview)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.response?.data?.message || "Error uploading story")
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handleClose = () => {
    onClose()
    if (preview) URL.revokeObjectURL(preview)
    setSelectedFile(null)
    setSelectedMusic(null)
    setUploadProgress(0)
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={handleClose}>
      <ResponsiveDialogContent
        showCloseButton={false}
        className="p-0 sm:max-w-xl max-sm:h-auto max-sm:max-h-[90%] flex flex-col rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getProfileCloudinaryUrl(user?.profilepic)} />
            <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
          </Avatar>
          <ResponsiveDialogTitle className="text-xl font-semibold">
            Create Story
          </ResponsiveDialogTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-gray-800 rounded-full"
              onClick={handleClose}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <div className="flex-1 relative h-full overflow-hidden">
          <div className="relative w-full h-full">
            {!selectedFile ? (
              <div
                className="w-full h-full flex flex-col items-center justify-center space-y-4 p-4 text-center cursor-pointer hover:bg-black/75"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-16 w-16 text-gray-500" />
                <p className="text-xl text-white">Tap to upload image or video</p>
                <p className="text-sm text-gray-400">Maximum file size: 30MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="relative w-full h-full">
                {isVideo ? (
                  <video src={preview} className="w-full h-full object-contain" controls />
                ) : (
                  <img src={preview} className="w-full h-full object-contain" alt="Story preview" />
                )}
              </div>
            )}
          </div>
        </div>

        {selectedFile && (
          <div className="p-4 border-t space-y-3">
            {isUploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-gray-400 text-center">Uploading... {uploadProgress}%</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button className="flex-1 py-6" onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgress > 0 ? "Uploading..." : "Processing..."}</span>
                  </div>
                ) : (
                  <span>Share Story</span>
                )}
              </Button>
            </div>
          </div>
        )}

        <Sheet open={isMusicSheetOpen} onOpenChange={setIsMusicSheetOpen}>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Add Music</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Search for music" className="bg-gray-100 border-gray-300" />
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {popularSongs.map((song) => (
                  <Card
                    key={song.id}
                    className={`cursor-pointer ${
                      selectedMusic?.id === song.id ? "border-blue-500" : "border-transparent"
                    }`}
                    onClick={() => {
                      setSelectedMusic(song)
                      setIsMusicSheetOpen(false)
                    }}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium">{song.title}</span>
                        <span className="text-gray-600 text-xs">{song.artist}</span>
                      </div>
                      <span className="text-gray-500 text-xs">{song.duration}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

export default CreateStory
