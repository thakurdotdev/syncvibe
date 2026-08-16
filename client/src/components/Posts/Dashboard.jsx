import { memo, useContext } from "react"
import { useNavigate } from "react-router-dom"
import { ImagePlus, Sparkles } from "lucide-react"
import InfiniteScroll from "react-infinite-scroll-component"
import { usePostsInfiniteQuery } from "@/hooks/queries/usePostQueries"
import { Context } from "@/Context/Context"
import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import GoToTop from "../GoToTop"
import PostSkeleton from "../PostSkeleton"
import StoriesBar from "../Story/StroriesBar"
import PostCard from "./PostCard"

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useContext(Context)
  const limit = 10
  const { data, fetchNextPage, hasNextPage, isPending } = usePostsInfiniteQuery(limit)

  const posts = data?.pages?.flatMap((page) => page.posts) ?? []

  const firstName = user?.name ? user.name.split(" ")[0] : "there"

  return (
    <div className="max-w-xl md:max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-32 sm:pb-20 space-y-4">
      {/* Stories Reel Bar */}
      <StoriesBar />

      {/* Modern Composer Bar */}
      <Card className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20 shrink-0">
            <AvatarImage src={getProfileCloudinaryUrl(user?.profilepic)} alt={user?.name} />
            <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>

          <button
            type="button"
            className="flex-1 text-left px-4 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 text-muted-foreground text-xs sm:text-sm font-medium transition-colors border border-border/50 cursor-pointer flex items-center justify-between"
            onClick={() => navigate("/post/create")}
          >
            <span>What's on your mind, {firstName}?</span>
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <ImagePlus className="h-4 w-4" />
              <span className="hidden xs:inline">Photo</span>
            </span>
          </button>
        </div>
      </Card>

      {/* Loading Skeletons */}
      {isPending && (
        <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl overflow-hidden divide-y divide-border/50">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4">
              <PostSkeleton />
            </div>
          ))}
        </div>
      )}

      {/* Posts Seamless Timeline Stream */}
      {!isPending && posts.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xs divide-y divide-border/40">
          <InfiniteScroll
            dataLength={posts.length}
            next={fetchNextPage}
            hasMore={!!hasNextPage}
            loader={
              <div className="p-4">
                <PostSkeleton />
              </div>
            }
            endMessage={
              <div className="py-10 text-center space-y-1">
                <div className="inline-flex items-center justify-center p-2 rounded-full bg-primary/10 text-primary mb-1">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-foreground">You're all caught up!</p>
                <p className="text-xs text-muted-foreground">
                  You've seen all the latest posts from your network.
                </p>
              </div>
            }
          >
            {posts.map((post) => (
              <PostCard key={post.postid} post={post} />
            ))}
          </InfiniteScroll>
        </div>
      )}

      {/* Empty State */}
      {!isPending && posts.length === 0 && (
        <Card className="rounded-2xl border-border/80 bg-card/60 backdrop-blur-xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Your feed is quiet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Connect with friends, follow creators, or be the first to share your stories!
            </p>
          </div>
          <Button
            onClick={() => navigate("/post/create")}
            className="rounded-xl h-9 px-4 text-xs font-semibold cursor-pointer"
          >
            Create your first post
          </Button>
        </Card>
      )}

      <GoToTop />
    </div>
  )
}

export default memo(Dashboard)
