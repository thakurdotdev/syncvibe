import axios from "axios"

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1"

export const getUploadSignature = async (intent = "post", resourceType = "image") => {
  const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/upload/signature`, {
    params: { intent, resourceType },
    withCredentials: true,
  })
  return response.data
}

export const uploadToCloudinary = async (file, intent = "post", onProgress) => {
  const isVideo = file.type.startsWith("video/")
  const resourceType = isVideo ? "video" : "image"

  const signatureData = await getUploadSignature(intent, resourceType)

  if (file.size > signatureData.maxFileSize) {
    const maxSizeMB = Math.round(signatureData.maxFileSize / (1024 * 1024))
    throw new Error(`File size exceeds ${maxSizeMB}MB limit`)
  }

  const fileExtension = file.name.split(".").pop()?.toLowerCase()
  if (fileExtension && !signatureData.allowedFormats.includes(fileExtension)) {
    throw new Error(
      `File format .${fileExtension} is not allowed. Use: ${signatureData.allowedFormats.join(", ")}`,
    )
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("api_key", signatureData.apiKey)
  formData.append("timestamp", signatureData.timestamp.toString())
  formData.append("signature", signatureData.signature)
  formData.append("folder", signatureData.folder)
  formData.append("public_id", signatureData.publicId)
  formData.append("allowed_formats", signatureData.allowedFormats.join(","))
  formData.append("overwrite", "false")

  const uploadUrl = `${CLOUDINARY_UPLOAD_URL}/${signatureData.cloudName}/${resourceType}/upload`

  const response = await axios.post(uploadUrl, formData, {
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(percentCompleted)
      }
    },
  })

  return {
    image: response.data.secure_url,
    id: response.data.public_id,
    resourceType,
  }
}

export const uploadMultipleToCloudinary = async (files, intent = "post", onProgress) => {
  const results = []
  const errors = []
  const totalFiles = files.length

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i]
    try {
      const result = await uploadToCloudinary(file, intent, (fileProgress) => {
        if (onProgress) {
          const overallProgress = Math.round(((i + fileProgress / 100) / totalFiles) * 100)
          onProgress(overallProgress, i, fileProgress)
        }
      })
      results.push(result)
    } catch (error) {
      errors.push({ file: file.name, error: error.message })
    }
  }

  if (errors.length > 0 && results.length === 0) {
    throw new Error(`All uploads failed: ${errors.map((e) => e.error).join(", ")}`)
  }

  return { results, errors, hasPartialFailure: errors.length > 0 }
}
