import { create } from "zustand"
import { toast } from "sonner"
import { uploadMultipleToCloudinary } from "@/Utils/cloudinaryUpload"
import { createPost, updatePost, postKeys } from "@/api/posts"

let queryClientRef = null

export const setQueryClient = (client) => {
  queryClientRef = client
}

const useUploadStore = create((set, get) => ({
  uploads: [],

  addUpload: (upload) => {
    const id = Date.now().toString()
    set((state) => ({
      uploads: [...state.uploads, { id, ...upload, progress: 0, status: "uploading" }],
    }))
    return id
  },

  updateProgress: (id, progress) => {
    set((state) => ({
      uploads: state.uploads.map((u) => (u.id === id ? { ...u, progress } : u)),
    }))
  },

  setStatus: (id, status, error = null) => {
    set((state) => ({
      uploads: state.uploads.map((u) => (u.id === id ? { ...u, status, error } : u)),
    }))
  },

  removeUpload: (id) => {
    set((state) => ({
      uploads: state.uploads.filter((u) => u.id !== id),
    }))
  },

  submitPost: async ({
    content,
    images,
    existingImages = [],
    isEditMode = false,
    postid = null,
  }) => {
    const id = get().addUpload({
      type: isEditMode ? "update" : "create",
      content: content.substring(0, 30) + (content.length > 30 ? "..." : ""),
      imageCount: images.length,
    })

    try {
      let uploadedImages = [...existingImages]

      if (images.length > 0) {
        const uploadResult = await uploadMultipleToCloudinary(images, "post", (progress) =>
          get().updateProgress(id, Math.round(progress * 0.7)),
        )
        uploadedImages = [...uploadedImages, ...uploadResult.results]

        if (uploadResult.hasPartialFailure) {
          toast.warning(`${uploadResult.errors.length} image(s) failed to upload`)
        }
      }

      get().updateProgress(id, 85)

      if (isEditMode) {
        await updatePost({ postid, title: content, images: uploadedImages })
      } else {
        await createPost({ title: content, images: uploadedImages })
      }

      get().updateProgress(id, 100)
      get().setStatus(id, "completed")

      if (queryClientRef) {
        queryClientRef.invalidateQueries({ queryKey: postKeys.all })
        if (isEditMode && postid) {
          queryClientRef.invalidateQueries({ queryKey: postKeys.detail(postid) })
        }
      }

      setTimeout(() => get().removeUpload(id), 2000)

      return { success: true }
    } catch (error) {
      get().setStatus(id, "error", error.response?.data?.message || "Failed to save post")
      return { success: false, error }
    }
  },
}))

export default useUploadStore
