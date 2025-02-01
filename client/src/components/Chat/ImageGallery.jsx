import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  Suspense,
} from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BlurFade from "../ui/blur-fade";

// Optimized blur loading placeholder
const BlurLoadingPlaceholder = () => (
  <div className="absolute inset-0 bg-black/20 backdrop-blur-lg">
    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
  </div>
);

const ImageGallery = React.memo(({ images, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [direction, setDirection] = useState(0);

  // Preload adjacent images
  const preloadImages = useCallback(
    (index) => {
      const imagesToPreload = [
        index > 0 ? images[index - 1] : null,
        images[index],
        index < images.length - 1 ? images[index + 1] : null,
      ].filter(Boolean);

      imagesToPreload.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    },
    [images],
  );

  useEffect(() => {
    preloadImages(currentIndex);
    setIsLoading(true);
  }, [currentIndex, preloadImages]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Optimized animation variants
  const variants = useMemo(
    () => ({
      enter: (direction) => ({
        x: direction > 0 ? "100%" : "-100%",
        opacity: 0,
        scale: 0.95,
      }),
      center: {
        x: 0,
        opacity: 1,
        scale: 1,
        transition: {
          x: { type: "spring", stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
          scale: { duration: 0.2 },
        },
      },
      exit: (direction) => ({
        x: direction < 0 ? "100%" : "-100%",
        opacity: 0,
        scale: 0.95,
        transition: {
          x: { type: "spring", stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
          scale: { duration: 0.2 },
        },
      }),
    }),
    [],
  );

  const handlePrevious = useCallback(
    (e) => {
      e?.stopPropagation();
      setDirection(-1);
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      setIsZoomed(false);
    },
    [images.length],
  );

  const handleNext = useCallback(
    (e) => {
      e?.stopPropagation();
      setDirection(1);
      setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      setIsZoomed(false);
    },
    [images.length],
  );

  const handleImageClick = useCallback((e) => {
    e.stopPropagation();
    setIsZoomed((prev) => !prev);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(images[currentIndex]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `image-${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  }, [currentIndex, images]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "Escape":
          isZoomed ? setIsZoomed(false) : onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious, isZoomed, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
    >
      {/* Modern gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* Close button with improved animation */}
      <motion.button
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10 z-50 hover:bg-black/60 transition-colors"
      >
        <X className="w-6 h-6" />
      </motion.button>

      {/* Navigation buttons */}
      {images.length > 1 && (
        <>
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handlePrevious}
            className="absolute left-4 p-3 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10 z-50 hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleNext}
            className="absolute right-4 p-3 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10 z-50 hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </>
      )}

      {/* Main image container */}
      <div className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center"
          >
            <BlurFade
              key={currentIndex}
              delay={0.25 + currentIndex * 0.05}
              inView
            >
              <motion.img
                src={images[currentIndex]}
                alt={`Gallery image ${currentIndex + 1}`}
                className="max-h-[90vh] max-w-[90vw] object-contain select-none rounded-lg shadow-2xl"
                animate={{
                  scale: isZoomed ? 1.5 : 1,
                  cursor: isZoomed ? "zoom-out" : "zoom-in",
                }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 25,
                }}
                onLoad={handleImageLoad}
                onClick={handleImageClick}
                draggable={false}
                style={{
                  pointerEvents: "auto",
                  filter: "brightness(1.02)",
                }}
              />
            </BlurFade>
          </motion.div>
        </AnimatePresence>

        {/* Image counter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full bg-black/40 text-white text-sm font-medium backdrop-blur-sm border border-white/10"
        >
          {currentIndex + 1} / {images.length}
        </motion.div>

        {/* Download button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleDownload}
          className="absolute bottom-4 right-4 p-3 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10 z-50 hover:bg-black/60 transition-colors"
        >
          <Download className="w-6 h-6" />
        </motion.button>
      </div>
    </motion.div>
  );
});

ImageGallery.displayName = "ImageGallery";

export default ImageGallery;
