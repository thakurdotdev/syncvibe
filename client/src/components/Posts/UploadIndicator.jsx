import { Loader2, CheckCircle2, XCircle, X } from "lucide-react"
import useUploadStore from "@/stores/uploadStore"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnimatePresence, motion } from "framer-motion"

const UploadIndicator = ({ className }) => {
  const { uploads, removeUpload } = useUploadStore()

  const activeUploads = uploads.filter(
    (u) => u.status !== "completed" || Date.now() - parseInt(u.id) < 2000,
  )

  if (activeUploads.length === 0) return null

  return (
    <div className={cn("fixed bottom-20 right-4 z-50 space-y-2", className)}>
      <AnimatePresence mode="popLayout">
        {activeUploads.map((upload) => (
          <motion.div
            key={upload.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={cn(
              "flex items-center gap-3 bg-background border rounded-full px-4 py-2.5 shadow-lg min-w-[200px]",
              upload.status === "error" && "border-red-500/50",
              upload.status === "completed" && "border-green-500/50",
            )}
          >
            {upload.status === "uploading" && (
              <div className="relative h-5 w-5">
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    className="stroke-muted"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    className="stroke-blue-500"
                    strokeWidth="3"
                    strokeDasharray={`${upload.progress * 0.88} 88`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
            {upload.status === "completed" && (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            )}
            {upload.status === "error" && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {upload.status === "uploading" && (
                  <>
                    {upload.type === "create" ? "Posting" : "Updating"}
                    {upload.imageCount > 0 && ` (${upload.imageCount} img)`}
                    <span className="text-muted-foreground ml-1">{upload.progress}%</span>
                  </>
                )}
                {upload.status === "completed" && "Posted!"}
                {upload.status === "error" && "Failed"}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 -mr-1"
              onClick={() => removeUpload(upload.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default UploadIndicator
