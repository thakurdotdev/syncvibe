import React, { useState, useCallback, useRef } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const ImageUpload = ({ onImageUpdate, maxFileSize = 5 * 1024 * 1024 }) => {
  const [image, setImage] = useState({
    preview: null,
    file: null,
    cropped: null,
  });
  const [cropConfig, setCropConfig] = useState({
    unit: "%",
    width: 50,
    aspect: 1,
  });
  const [uiState, setUiState] = useState({
    isDragging: false,
    showCropInterface: false,
    error: null,
  });

  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const [completedCrop, setCompletedCrop] = useState(null);

  const validateFile = (file) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

    if (!allowedTypes.includes(file.type)) {
      return "Invalid file type. Please upload JPG, PNG, Webp.";
    }

    if (file.size > maxFileSize) {
      return `File is too large. Maximum size is ${
        maxFileSize / 1024 / 1024
      }MB.`;
    }

    return null;
  };

  const handleFileChange = useCallback(
    (file) => {
      const error = validateFile(file);

      if (error) {
        setUiState((prev) => ({ ...prev, error }));
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setImage({
        preview: previewUrl,
        file,
        cropped: null,
      });
      setUiState((prev) => ({
        ...prev,
        showCropInterface: false,
        error: null,
      }));
    },
    [maxFileSize],
  );

  const handleDragEvents = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setUiState((prev) => ({
      ...prev,
      isDragging: e.type === "dragenter" || e.type === "dragover",
    }));
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      setUiState((prev) => ({ ...prev, isDragging: false }));

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileChange(droppedFile);
      }
    },
    [handleFileChange],
  );

  const getCroppedImage = useCallback(() => {
    if (!completedCrop || !imageRef.current) return null;

    const canvas = document.createElement("canvas");
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      imageRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          const croppedUrl = URL.createObjectURL(blob);
          resolve(croppedUrl);
        },
        "image/jpeg",
        0.95,
      );
    });
  }, [completedCrop]);

  const handleCropComplete = useCallback((crop) => {
    setCompletedCrop(crop);
  }, []);

  const saveCroppedImage = useCallback(async () => {
    const croppedImageUrl = await getCroppedImage();
    setImage((prev) => ({
      ...prev,
      cropped: croppedImageUrl,
    }));
    setUiState((prev) => ({ ...prev, showCropInterface: false }));
  }, [getCroppedImage]);

  const uploadImage = useCallback(() => {
    const finalImage = image.cropped || image.preview;
    if (finalImage) {
      onImageUpdate(finalImage, image.file);
    }
  }, [image, onImageUpdate]);

  const resetImage = useCallback(() => {
    setImage({ preview: null, file: null, cropped: null });
    setUiState({
      isDragging: false,
      showCropInterface: false,
      error: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div
      className="w-full max-w-lg p-4 bg-white rounded-lg shadow-md"
      onDragEnter={handleDragEvents}
      onDragOver={handleDragEvents}
      onDragLeave={handleDragEvents}
      onDrop={handleDrop}
    >
      {uiState.error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          {uiState.error}
        </div>
      )}

      {!image.preview ? (
        <div
          className={`
            flex flex-col items-center justify-center 
            w-full h-64 border-2 border-dashed rounded-lg 
            ${
              uiState.isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50"
            }
            hover:border-blue-500 transition-colors duration-300
            cursor-pointer
          `}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/gif"
            onChange={(e) => handleFileChange(e.target.files[0])}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="flex flex-col items-center justify-center text-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-600">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, GIF (Max 5MB)
            </p>
          </button>
        </div>
      ) : (
        <div className="relative">
          {uiState.showCropInterface ? (
            <div className="mb-4">
              <ReactCrop
                crop={cropConfig}
                onChange={(_, percentCrop) => setCropConfig(percentCrop)}
                onComplete={handleCropComplete}
                aspect={1}
                ruleOfThirds
              >
                <img
                  ref={imageRef}
                  src={image.preview}
                  alt="Crop preview"
                  className="max-w-full max-h-[500px] object-contain"
                />
              </ReactCrop>
            </div>
          ) : (
            <div className="mb-4">
              <img
                src={image.cropped || image.preview}
                alt="Preview"
                className="max-w-full max-h-[500px] object-contain rounded-lg"
              />
            </div>
          )}

          <div className="flex justify-between space-x-2">
            <button
              onClick={resetImage}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Reset
            </button>

            {!uiState.showCropInterface ? (
              <>
                <button
                  onClick={() =>
                    setUiState((prev) => ({ ...prev, showCropInterface: true }))
                  }
                  className="w-full bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200 transition-colors"
                >
                  Crop
                </button>
                <button
                  onClick={uploadImage}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Upload
                </button>
              </>
            ) : (
              <button
                onClick={saveCroppedImage}
                className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
              >
                Save Crop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
