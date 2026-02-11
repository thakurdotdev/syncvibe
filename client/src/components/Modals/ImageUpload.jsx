import { useState, useCallback, useRef } from "react"
import ReactCrop from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { Crop, ImagePlus, Loader2, RotateCcw, Upload, X, Check } from "lucide-react"
import { Button } from "../ui/button"

const ImageUpload = ({ onImageUpdate, maxFileSize = 5 * 1024 * 1024, loading = false }) => {
  const [image, setImage] = useState({
    preview: null,
    file: null,
    cropped: null,
  })
  const [cropConfig, setCropConfig] = useState({
    unit: "%",
    width: 80,
    x: 10,
    y: 10,
    aspect: 1,
  })
  const [uiState, setUiState] = useState({
    isDragging: false,
    showCropInterface: false,
    error: null,
  })

  const fileInputRef = useRef(null)
  const imageRef = useRef(null)
  const [completedCrop, setCompletedCrop] = useState(null)

  const validateFile = (file) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if (!allowedTypes.includes(file.type)) {
      return "Invalid file type. Please upload JPG, PNG, or WebP."
    }
    if (file.size > maxFileSize) {
      return `File is too large. Maximum size is ${maxFileSize / 1024 / 1024}MB.`
    }
    return null
  }

  const handleFileChange = useCallback(
    (file) => {
      if (!file) return
      const error = validateFile(file)
      if (error) {
        setUiState((prev) => ({ ...prev, error }))
        return
      }
      const previewUrl = URL.createObjectURL(file)
      setImage({ preview: previewUrl, file, cropped: null })
      setUiState({ isDragging: false, showCropInterface: true, error: null })
      setCompletedCrop(null)
    },
    [maxFileSize],
  )

  const handleDragEvents = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setUiState((prev) => ({
      ...prev,
      isDragging: e.type === "dragenter" || e.type === "dragover",
    }))
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setUiState((prev) => ({ ...prev, isDragging: false }))
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) handleFileChange(droppedFile)
    },
    [handleFileChange],
  )

  const getCroppedImage = useCallback(() => {
    if (!completedCrop || !imageRef.current) return null
    const canvas = document.createElement("canvas")
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height

    const pixelCrop = {
      x: completedCrop.x * scaleX,
      y: completedCrop.y * scaleY,
      width: completedCrop.width * scaleX,
      height: completedCrop.height * scaleY,
    }

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    const ctx = canvas.getContext("2d")
    ctx.drawImage(
      imageRef.current,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92)
    })
  }, [completedCrop])

  const handleCropComplete = useCallback((crop) => {
    setCompletedCrop(crop)
  }, [])

  const saveCroppedImage = useCallback(async () => {
    const croppedBlob = await getCroppedImage()
    if (!croppedBlob) return
    const croppedUrl = URL.createObjectURL(croppedBlob)
    setImage((prev) => ({ ...prev, cropped: croppedUrl, croppedBlob }))
    setUiState((prev) => ({ ...prev, showCropInterface: false }))
  }, [getCroppedImage])

  const uploadImage = useCallback(async () => {
    let fileToUpload = image.file

    if (image.croppedBlob) {
      fileToUpload = new File([image.croppedBlob], "profile.jpg", { type: "image/jpeg" })
    } else if (image.cropped) {
      const response = await fetch(image.cropped)
      const blob = await response.blob()
      fileToUpload = new File([blob], "profile.jpg", { type: "image/jpeg" })
    }

    if (fileToUpload) {
      onImageUpdate(image.cropped || image.preview, fileToUpload)
    }
  }, [image, onImageUpdate])

  const resetImage = useCallback(() => {
    if (image.preview) URL.revokeObjectURL(image.preview)
    if (image.cropped) URL.revokeObjectURL(image.cropped)
    setImage({ preview: null, file: null, cropped: null })
    setUiState({ isDragging: false, showCropInterface: false, error: null })
    setCompletedCrop(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [image])

  const isDisabled = loading

  return (
    <div className="w-full space-y-4">
      {uiState.error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
          <X size={16} className="shrink-0" />
          <span>{uiState.error}</span>
        </div>
      )}

      {!image.preview ? (
        <div
          onDragEnter={handleDragEvents}
          onDragOver={handleDragEvents}
          onDragLeave={handleDragEvents}
          onDrop={handleDrop}
          onClick={() => !isDisabled && fileInputRef.current?.click()}
          className={`
            group relative flex flex-col items-center justify-center
            w-full h-56 border-2 border-dashed rounded-2xl cursor-pointer
            transition-all duration-300 ease-out
            ${
              uiState.isDragging
                ? "border-blue-400 bg-blue-500/10 scale-[1.02]"
                : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/50"
            }
          `}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e.target.files[0])}
            disabled={isDisabled}
          />
          <div className="flex flex-col items-center gap-3 transition-transform duration-300 group-hover:scale-105">
            <div
              className={`
              p-4 rounded-2xl transition-colors duration-300
              ${uiState.isDragging ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-400 group-hover:text-zinc-300"}
            `}
            >
              <ImagePlus size={28} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-300">
                {uiState.isDragging ? "Drop your image here" : "Click or drag to upload"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">JPG, PNG, WebP • Max 5MB</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {uiState.showCropInterface ? (
            <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="p-1">
                <ReactCrop
                  crop={cropConfig}
                  onChange={(_, percentCrop) => setCropConfig(percentCrop)}
                  onComplete={handleCropComplete}
                  aspect={1}
                  circularCrop
                  ruleOfThirds
                  className="max-h-[350px] mx-auto [&_.ReactCrop__crop-selection]:!border-blue-400 [&_.ReactCrop__crop-selection]:!border-2"
                >
                  <img
                    ref={imageRef}
                    src={image.preview}
                    alt="Crop preview"
                    className="max-w-full max-h-[350px] object-contain mx-auto block"
                  />
                </ReactCrop>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-t border-zinc-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUiState((prev) => ({ ...prev, showCropInterface: false }))}
                  className="text-zinc-400 hover:text-zinc-200"
                  disabled={isDisabled}
                >
                  <X size={16} className="mr-1" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveCroppedImage}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                  disabled={isDisabled}
                >
                  <Check size={16} className="mr-1" /> Apply Crop
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-48 h-48 rounded-full overflow-hidden ring-4 ring-zinc-800 ring-offset-2 ring-offset-zinc-950 shadow-2xl transition-all duration-300 group-hover:ring-blue-500/50">
                  <img
                    src={image.cropped || image.preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                {image.cropped && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-lg">
                    Cropped
                  </div>
                )}
              </div>
            </div>
          )}

          {!uiState.showCropInterface && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetImage}
                disabled={isDisabled}
                className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <RotateCcw size={15} className="mr-1.5" /> Reset
              </Button>
              <Button
                variant="outline"
                onClick={() => setUiState((prev) => ({ ...prev, showCropInterface: true }))}
                disabled={isDisabled}
                className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Crop size={15} className="mr-1.5" /> {image.cropped ? "Re-crop" : "Crop"}
              </Button>
              <Button
                onClick={uploadImage}
                disabled={isDisabled}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="mr-1.5 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={15} className="mr-1.5" /> Upload
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ImageUpload
