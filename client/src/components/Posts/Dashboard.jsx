import React, { useEffect, useState } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost';
import PostCard from './PostCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import StoriesBar from '../Story/StroriesBar';
import GoToTop from '../GoToTop';
import { Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { PostSkeleton } from '../PostSkeleton';
import { Loader2Icon } from 'lucide-react';

const Dashboard = () => {
  const [posts, setPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      if (page === 1) {
        setLoading(true);
      }
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/posts?page=${page}&limit=${limit}`,
        { withCredentials: true }
      );
      if (response.status === 200) {
        setPosts((prevPosts) => [...prevPosts, ...response.data.posts]);
        setTotalPosts(response.data.totalPosts);
        setPage((prevPage) => prevPage + 1);
      }
    } catch (error) {
      console.error('new error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex flex-col gap-4 my-5 mx-auto w-[95%] sm:w-[75%] md:w-[60%] lg:w-[30%]'>
      <StoriesBar />
      <>
        {loading && (
          <div className='flex items-center justify-center p-4 h-[70vh]'>
            <Loader2Icon className='w-10 h-10 text-gray-500 animate-spin' />
          </div>
        )}
        <InfiniteScroll
          dataLength={posts.length}
          next={fetchPosts}
          hasMore={posts.length < totalPosts}
          loader={
            <Card className='flex items-center justify-center p-4'>
              <Loader2 className='w-10 h-10 text-gray-500 animate-spin' />
            </Card>
          }
          endMessage={
            !loading && (
              <p className='text-center text-gray-500 text-sm'>Yay! You have seen it all</p>
            )
          }
        >
          {posts.map((post) => (
            <PostCard key={post.postid} post={post} setPosts={setPosts} />
          ))}
        </InfiniteScroll>
      </>
      <GoToTop />
    </div>
  );
};

export default Dashboard;
