import React, { useEffect, useState, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react"
import { TimeAgo } from "../../Utils/TimeAgo"
import { cn } from "@/lib/utils"
import axios from "axios"
import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary"

const StoryViewer = ({
  isOpen,
  onClose,
  stories,
  initialUserIndex = 0,
  onStoriesEnd,
  setSelectedUserIndex,
}) => {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex)
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isMediaLoaded, setIsMediaLoaded] = useState(false)
  const [isPreloading, setIsPreloading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const progressInterval = useRef(null)
  const videoRef = useRef(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentUserIndex(initialUserIndex)
      setCurrentStoryIndex(0)
      setProgress(0)
      setIsMediaLoaded(false)
      setIsPreloading(true)
      setIsPaused(false)
    }
  }, [isOpen, initialUserIndex])

  // Mark story as viewed when it's opened
  useEffect(() => {
    if (isOpen && stories?.[currentUserIndex]?.stories[currentStoryIndex]) {
      markStoryAsViewed(stories[currentUserIndex].stories[currentStoryIndex])
    }
  }, [currentUserIndex, currentStoryIndex, isOpen])

  const markStoryAsViewed = async (story) => {
    if (!story.isViewed) {
      try {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/story/viewed`,
          { storyIds: [story.storyid] },
          { withCredentials: true },
        )
      } catch (error) {
        console.error("Error marking story as viewed:", error)
      }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      clearInterval(progressInterval.current)
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }
  }, [isOpen])

  const handleClose = () => {
    clearInterval(progressInterval.current)
    if (videoRef.current) {
      videoRef.current.pause()
    }
    onClose()
  }

  const goToNextStory = () => {
    const currentUserStories = stories?.[currentUserIndex]?.stories
    if (!currentUserStories) return

    setIsMediaLoaded(false)
    setIsPreloading(true)

    if (currentStoryIndex < currentUserStories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1)
    } else if (currentUserIndex < stories.length - 1) {
      setCurrentUserIndex((prev) => prev + 1)
      setCurrentStoryIndex(0)
    } else {
      handleClose()
      onStoriesEnd?.()
    }
  }

  const goToPrevStory = () => {
    if (currentStoryIndex > 0) {
      setIsMediaLoaded(false)
      setIsPreloading(true)
      setCurrentStoryIndex((prev) => prev - 1)
    } else if (currentUserIndex > 0) {
      setIsMediaLoaded(false)
      setIsPreloading(true)
      setCurrentUserIndex((prev) => prev - 1)
      setCurrentStoryIndex(stories[currentUserIndex - 1].stories.length - 1)
    }
  }

  useEffect(() => {
    if (isOpen && stories?.[currentUserIndex]?.stories[currentStoryIndex]) {
      const currentStory = stories[currentUserIndex].stories[currentStoryIndex]

      const handleStoryProgress = () => {
        if (isPaused) return

        const duration =
          currentStory.mediaType === "video" && videoRef.current
            ? videoRef.current.duration * 1000
            : 5000

        clearInterval(progressInterval.current)
        setProgress(0)

        const startTime = Date.now()
        progressInterval.current = setInterval(() => {
          const elapsed = Date.now() - startTime
          const newProgress = (elapsed / duration) * 100

          if (newProgress >= 100) {
            clearInterval(progressInterval.current)
            goToNextStory()
          } else {
            setProgress(newProgress)
          }
        }, 16)
      }

      if (isMediaLoaded && !isPaused) {
        handleStoryProgress()
      }

      return () => clearInterval(progressInterval.current)
    }
  }, [currentUserIndex, currentStoryIndex, isMediaLoaded, isPaused, isOpen])

  const handleMediaLoad = () => {
    setIsMediaLoaded(true)
    setIsPreloading(false)
    if (videoRef.current) {
      videoRef.current.play().catch(console.error)
    }
  }

  const renderTextOverlays = (textOverlays) => {
    let textOverlayss = JSON.parse(textOverlays)
    if (!textOverlayss || !Array.isArray(textOverlayss)) return null

    return textOverlayss.map((overlay) => (
      <div
        key={overlay.id}
        className="absolute"
        style={{
          left: `${overlay.position.x}%`,
          top: `${overlay.position.y}%`,
          transform: "translate(-50%, -50%)",
          zIndex: 15,
        }}
      >
        <div
          className="text-white px-3 py-1.5 rounded-lg whitespace-nowrap bg-black/50"
          style={{
            fontSize: `${overlay.size}px`,
            opacity: isMediaLoaded ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          {overlay.text}
        </div>
      </div>
    ))
  }

  // Don't render anything if modal is not open
  if (!isOpen || !stories?.length) return null

  const currentUserStories = stories[currentUserIndex]?.stories
  const currentStory = currentUserStories?.[currentStoryIndex]
  const currentUser = stories[currentUserIndex]?.user

  // Don't render if we don't have valid story data
  if (!currentStory || !currentUser) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl h-svh p-0 gap-0 bg-black max-sm:border-none overflow-hidden">
        <div className="relative h-full flex flex-col">
          {/* Progress Bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1.5 p-2 bg-gradient-to-b from-black/40 via-black/20 to-transparent">
            {currentUserStories.map((_, idx) => (
              <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full bg-white origin-left transition-transform",
                    idx === currentStoryIndex
                      ? "ease-linear"
                      : idx < currentStoryIndex
                        ? "scale-x-100"
                        : "scale-x-0",
                  )}
                  style={{
                    transform: `scaleX(${idx === currentStoryIndex ? progress / 100 : 0})`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 pt-6 bg-black/20">
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8 ring-2 ring-white/50">
                <AvatarImage
                  src={getProfileCloudinaryUrl(currentUser.profilepic)}
                  alt={currentUser.username}
                />
                <AvatarFallback>{currentUser.username[0]}</AvatarFallback>
              </Avatar>
              <div className="text-white">
                <div className="font-medium flex items-center gap-2">
                  {currentUser.name}
                  <span className="text-xs text-white/70">•</span>
                  <span className="text-sm font-normal text-white/70">
                    {TimeAgo(currentStory.postedtime)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center bg-black/90 relative">
            {(isPreloading || !isMediaLoaded) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <div className="w-8 h-8 border-3 border-white/10 border-t-white rounded-full animate-spin" />
              </div>
            )}

            <div className="w-full h-full flex items-center justify-center">
              {currentStory.mediaType === "video" ? (
                <video
                  ref={videoRef}
                  src={currentStory.mediaUrl}
                  className={cn(
                    "max-h-full max-w-full object-contain transition-all duration-300",
                    !isMediaLoaded && "opacity-0 scale-95",
                    isMediaLoaded && "opacity-100 scale-100",
                    isPaused && "brightness-50",
                  )}
                  playsInline
                  muted={isMuted}
                  autoPlay
                  preload="auto"
                  onLoadedData={handleMediaLoad}
                  onEnded={goToNextStory}
                  onError={(e) => console.error("Video error:", e)}
                />
              ) : (
                <img
                  src={currentStory.mediaUrl}
                  alt="Story"
                  className={cn(
                    "max-h-full max-w-full object-contain transition-all duration-300",
                    !isMediaLoaded && "opacity-0 scale-95",
                    isMediaLoaded && "opacity-100 scale-100",
                    isPaused && "brightness-50",
                  )}
                  onLoad={handleMediaLoad}
                />
              )}

              {currentStory.content && renderTextOverlays(currentStory.content)}
            </div>

            {/* Navigation Areas */}
            <div className="absolute inset-0 flex" onClick={(e) => e.stopPropagation()}>
              <div className="w-1/3 h-full cursor-pointer" onClick={goToPrevStory} />
              <div
                className="w-1/3 h-full cursor-pointer"
                onClick={() => setIsPaused((prev) => !prev)}
              />
              <div className="w-1/3 h-full cursor-pointer" onClick={goToNextStory} />
            </div>
          </div>

          {/* Navigation Buttons */}
          {(currentStoryIndex > 0 || currentUserIndex > 0) && (
            <button
              onClick={goToPrevStory}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors duration-200"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {(currentStoryIndex < currentUserStories.length - 1 ||
            currentUserIndex < stories.length - 1) && (
            <button
              onClick={goToNextStory}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors duration-200"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Message Input */}
          {/* <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <input
              type="text"
              placeholder="Send message"
              className="w-full bg-white/10 text-white placeholder-white/50 text-sm px-4 py-2 rounded-full border border-white/20 focus:outline-none focus:border-white/40 transition-colors"
              onClick={(e) => e.stopPropagation()}
            />
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default StoryViewer
