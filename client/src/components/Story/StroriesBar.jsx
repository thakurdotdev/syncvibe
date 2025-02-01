import React, { useEffect, useState, useContext } from "react";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Plus } from "lucide-react";
import CreateStory from "./CreateStory";
import { Context } from "@/Context/Context";
import StoryViewer from "./StoryViewer";
import axios from "axios";
import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary";
import { Card } from "../ui/card";

const StoriesBar = () => {
  const { user } = useContext(Context);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/story/feed`,
        { withCredentials: true },
      );

      if (response.status === 200) {
        setStories(response.data.stories);
      }
    } catch (error) {
      console.error("Error fetching stories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryClick = (index) => {
    setSelectedUserIndex(index);
    setStoryViewerOpen(true);
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-900 rounded-lg p-4 mt-3">
        <div className="animate-pulse flex gap-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div className="rounded-full p-1 bg-gray-300">
                <Avatar className="w-14 h-14 border-2 border-white">
                  <AvatarFallback />
                </Avatar>
              </div>
              <span className="text-xs truncate w-16 text-center">Loading</span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-lg p-4 mt-3">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4">
            <div
              className="flex flex-col items-center gap-1 cursor-pointer"
              onClick={() => setIsCreateStoryOpen(true)}
            >
              <div className="relative">
                <Avatar className="w-14 h-14 border-2 border-white">
                  <AvatarImage
                    src={getProfileCloudinaryUrl(user?.profilepic)}
                  />
                  <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <span className="text-xs truncate w-16 text-center">
                Add story
              </span>
            </div>

            {stories.map((storyGroup, index) => (
              <div
                key={storyGroup.user.userid}
                className="flex flex-col items-center gap-1 cursor-pointer"
                onClick={() => handleStoryClick(index)}
              >
                <div
                  className={`rounded-full p-1 ${
                    storyGroup.hasUnviewedStories
                      ? "bg-gradient-to-tr from-yellow-400 to-fuchsia-600"
                      : "bg-gray-300"
                  }`}
                >
                  <Avatar className="w-14 h-14 border-2 border-white">
                    <AvatarImage
                      src={getProfileCloudinaryUrl(storyGroup.user.profilepic)}
                    />
                    <AvatarFallback>
                      {storyGroup.user.username[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-xs truncate w-16 text-center">
                  {storyGroup.user.username}
                </span>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <StoryViewer
        isOpen={storyViewerOpen}
        onClose={() => {
          setStoryViewerOpen(false);
          fetchStories();
          setSelectedUserIndex(null);
        }}
        stories={stories}
        initialUserIndex={selectedUserIndex}
        setSelectedUserIndex={setSelectedUserIndex}
        onStoriesEnd={() => {
          setStoryViewerOpen(false);
          fetchStories();
        }}
      />

      <CreateStory
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onSuccess={() => fetchStories()}
      />
    </>
  );
};

export default StoriesBar;
