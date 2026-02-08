import { Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import InfiniteScroll from "react-infinite-scroll-component"
import { usePostsInfiniteQuery } from "@/hooks/queries/usePostQueries"
import GoToTop from "../GoToTop"
import StoriesBar from "../Story/StroriesBar"
import PostCard from "./PostCard"
import CreatePost from "./CreatePost"

const Dashboard = () => {
  const navigate = useNavigate()
  const limit = 10
  const { data, fetchNextPage, hasNextPage, isPending } = usePostsInfiniteQuery(limit)

  const posts = data?.pages?.flatMap((page) => page.posts) ?? []

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-0">
      <div className="py-4">
        <StoriesBar />
      </div>

      <div className="bg-card rounded-xl border mb-4">
        <div className="p-4 flex items-center gap-3">
          <div className="flex-1">
            <button
              className="w-full text-left px-4 py-3 rounded-xl bg-accent/50 text-muted-foreground text-sm hover:bg-accent transition-colors"
              onClick={() => navigate("/post/create")}
            >
              What's on your mind?
            </button>
          </div>
          <CreatePost />
        </div>
      </div>

      <InfiniteScroll
        dataLength={posts.length}
        next={fetchNextPage}
        hasMore={!!hasNextPage}
        loader={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        }
        endMessage={
          posts.length > 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">You're all caught up!</p>
            </div>
          )
        }
        className="space-y-4"
      >
        {posts.map((post) => (
          <PostCard key={post.postid} post={post} />
        ))}
      </InfiniteScroll>

      {posts.length === 0 && !isPending && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
            <span className="text-2xl">📝</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">No posts yet</h3>
          <p className="text-muted-foreground text-sm text-center">
            Be the first to share something!
          </p>
        </div>
      )}

      <GoToTop />
    </div>
  )
}

export default Dashboard
