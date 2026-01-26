import { Loader2, Loader2Icon } from "lucide-react"
import InfiniteScroll from "react-infinite-scroll-component"
import { usePostsInfiniteQuery } from "@/hooks/queries/usePostQueries"
import GoToTop from "../GoToTop"
import StoriesBar from "../Story/StroriesBar"
import { Card } from "../ui/card"
import PostCard from "./PostCard"

const Dashboard = () => {
  const limit = 10
  const { data, fetchNextPage, hasNextPage, isPending } = usePostsInfiniteQuery(limit)

  const posts = data?.pages?.flatMap((page) => page.posts) ?? []

  return (
    <div className="flex flex-col gap-4 my-5 mx-auto w-[95%] sm:w-[75%] md:w-[60%] lg:w-[30%]">
      <StoriesBar />
      <>
        {isPending && (
          <div className="flex items-center justify-center p-4 h-[70vh]">
            <Loader2Icon className="w-10 h-10 text-gray-500 animate-spin" />
          </div>
        )}
        <InfiniteScroll
          dataLength={posts.length}
          next={fetchNextPage}
          hasMore={!!hasNextPage}
          loader={
            <Card className="flex items-center justify-center p-4">
              <Loader2 className="w-10 h-10 text-gray-500 animate-spin" />
            </Card>
          }
          endMessage={
            !isPending &&
            posts.length > 0 && (
              <p className="text-center text-gray-500 text-sm">Yay! You have seen it all</p>
            )
          }
        >
          {posts.map((post) => (
            <PostCard key={post.postid} post={post} />
          ))}
        </InfiniteScroll>
      </>
      <GoToTop />
    </div>
  )
}

export default Dashboard
