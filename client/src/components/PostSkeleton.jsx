import { memo } from "react"
import { Card } from "./ui/card"

export const PostSkeleton = memo(() => {
  return (
    <Card className="rounded-2xl border-border/80 bg-card/60 backdrop-blur-xl p-4 sm:p-5 shadow-xs overflow-hidden mb-4 space-y-4">
      {/* User Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted/60 animate-pulse" />
          <div className="space-y-1.5">
            <div className="w-28 h-3.5 bg-muted/60 rounded-md animate-pulse" />
            <div className="w-20 h-2.5 bg-muted/40 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="w-6 h-6 rounded-md bg-muted/40 animate-pulse" />
      </div>

      {/* Text Content Skeleton */}
      <div className="space-y-2">
        <div className="w-full h-3.5 bg-muted/50 rounded-md animate-pulse" />
        <div className="w-4/5 h-3.5 bg-muted/40 rounded-md animate-pulse" />
      </div>

      {/* Image Skeleton */}
      <div className="w-full h-64 sm:h-72 rounded-xl bg-muted/40 animate-pulse" />

      {/* Engagement Bar Skeleton */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <div className="flex items-center gap-4">
          <div className="w-14 h-6 rounded-lg bg-muted/40 animate-pulse" />
          <div className="w-14 h-6 rounded-lg bg-muted/40 animate-pulse" />
          <div className="w-14 h-6 rounded-lg bg-muted/40 animate-pulse" />
        </div>
        <div className="w-6 h-6 rounded-md bg-muted/40 animate-pulse" />
      </div>
    </Card>
  )
})

PostSkeleton.displayName = "PostSkeleton"
export default PostSkeleton
