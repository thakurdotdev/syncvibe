import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePlayer,
  usePlayerState,
  usePlaylist,
} from "@/Context/PlayerContext";
import axios from "axios";
import he from "he";
import { ListMusic, Minimize2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import AddToPlaylist from "./AddToPlaylist";
import {
  LoadingState,
  MusicControls,
  ProgressBarMusic,
  VolumeControl,
} from "./Common";
import { CurrentQueue, PlaylistInBottom } from "./PlaylistInBottom";
import SleepTimerModal from "./SleepTimer";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ChevronDownIcon, PlayIcon } from "lucide-react";
import { AudioWave } from "./Cards";

const BUTTON_SIZE = 48;
const TAB_VALUES = ["current", "queue", "recommendations"];

const DraggableButton = memo(
  ({
    position,
    onDragEnd,
    onMaximize,
    songImage,
    currentSong,
    isDragging,
    isPlaying,
  }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
      id: "minimized-player",
    });

    const style = {
      position: "fixed",
      top: position.y,
      left: position.x,
      transform: transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined,
      touchAction: "none",
    };

    return (
      <Card
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={() => !isDragging && onMaximize()}
        style={style}
        className="flex items-center gap-1 px-2 py-1 rounded-full shadow-md cursor-pointer select-none z-[9999]"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden">
          <img src={songImage} alt="" className="w-full h-full object-cover" />
        </div>
        {isPlaying ? <AudioWave /> : <PlayIcon size={20} />}
        <span className="hidden sm:block text-sm max-w-[100px] truncate">
          {he.decode(currentSong?.name || "")}
        </span>
      </Card>
    );
  },
);

const BottomPlayer = () => {
  const { handlePlayPauseSong, handleNextSong, handlePrevSong, addToPlaylist } =
    usePlayer();
  const { currentSong, isPlaying } = usePlayerState();
  const { playlist } = usePlaylist();

  const isMobile = useIsMobile();
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // State for tab swiping
  const [activeTab, setActiveTab] = useState("current");
  const touchStartX = useRef(null);
  const contentRef = useRef(null);

  const [position, setPosition] = useState({
    x: isMobile ? window.innerWidth - 100 : 23,
    y: isMobile ? window.innerHeight - 150 : 752,
  });
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
  );

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prevPos) => ({
        x: Math.min(prevPos.x, window.innerWidth - BUTTON_SIZE),
        y: Math.min(prevPos.y, window.innerHeight - BUTTON_SIZE),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handler for swipe gestures to change tabs
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    // Only switch tabs if the swipe is significant enough (> 50px)
    if (Math.abs(diff) > 50) {
      const currentIndex = TAB_VALUES.indexOf(activeTab);

      if (diff > 0) {
        // Swipe left, go to next tab
        const nextIndex = Math.min(currentIndex + 1, TAB_VALUES.length - 1);
        setActiveTab(TAB_VALUES[nextIndex]);
      } else {
        // Swipe right, go to previous tab
        const prevIndex = Math.max(currentIndex - 1, 0);
        setActiveTab(TAB_VALUES[prevIndex]);
      }
    }

    touchStartX.current = null;
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (event) => {
    setIsDragging(false);
    const { delta } = event;

    if (delta) {
      setPosition((prev) => ({
        x: Math.min(
          Math.max(0, prev.x + delta.x),
          window.innerWidth - BUTTON_SIZE,
        ),
        y: Math.min(
          Math.max(0, prev.y + delta.y),
          window.innerHeight - BUTTON_SIZE,
        ),
      }));
    }
  };

  const songImage = useMemo(
    () =>
      currentSong?.image?.[2]?.link ||
      "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png",
    [currentSong],
  );

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === " " &&
        document.activeElement &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        handlePlayPauseSong();
      }
      if (e.key === "ArrowRight") handleNextSong();
      if (e.key === "ArrowLeft") handlePrevSong();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPauseSong, handleNextSong, handlePrevSong]);

  const getRecommendations = useCallback(async () => {
    if (!currentSong?.id) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SONG_URL}/song/recommend?id=${currentSong.id}`,
      );
      if (response.data?.data) {
        setRecommendations(response.data.data);
        if (playlist.length < 2 && response.data.data.length > 0) {
          addToPlaylist(response.data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  }, [currentSong?.id]);

  useEffect(() => {
    getRecommendations();
  }, [getRecommendations]);

  if (!currentSong) return null;

  return (
    <>
      <Card
        className={cn(
          "fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-md border-t z-50 transition-all duration-500",
          isMinimized
            ? "translate-y-full opacity-0"
            : "translate-y-0 opacity-100",
          isMobile && "bottom-12",
        )}
      >
        <CardContent className="p-0">
          {/* Progress Bar */}
          <div className="absolute -top-1 left-0 w-full">
            <ProgressBarMusic />
          </div>

          <div className="flex items-center justify-between p-4 pt-5">
            {/* Song Info */}
            <div
              className="flex items-center gap-4 flex-1 min-w-0"
              as="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSheetOpen(true);
              }}
            >
              <Avatar className="h-14 w-14 rounded-md">
                <AvatarImage src={songImage} alt={currentSong.name} />
                <AvatarFallback>MU</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium truncate">
                  {he.decode(currentSong.name)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {he.decode(artistName)}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-full shadow-lg",
                  "transition-all duration-500 hover:scale-105",
                  isMinimized
                    ? "opacity-0 pointer-events-none -translate-y-10"
                    : "opacity-100 translate-y-0",
                )}
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 size={20} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="hidden sm:flex hover:scale-105"
              >
                <ListMusic size={18} />
              </Button>

              <VolumeControl />
              {!isMobile && <SleepTimerModal />}

              <MusicControls />

              <Sheet
                open={isSheetOpen}
                onOpenChange={() => setIsSheetOpen(!isSheetOpen)}
              >
                <SheetContent
                  side="bottom"
                  className="h-full w-full p-0 overflow-y-hidden"
                >
                  <SheetHeader className="border-b p-4">
                    <SheetTitle className="text-lg font-semibold">
                      Now Playing
                    </SheetTitle>
                    <div className="absolute right-4 top-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSheetOpen(false);
                        }}
                      >
                        <ChevronDownIcon className="h-8 w-8" />
                      </Button>
                    </div>
                  </SheetHeader>

                  <div
                    className="flex flex-col items-center justify-start -mt-12 pb-8"
                    ref={contentRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <Tabs
                      value={activeTab}
                      onValueChange={setActiveTab}
                      className="w-full max-w-[500px]"
                    >
                      <div className="flex justify-center mb-3">
                        <TabsList>
                          <TabsTrigger value="current">Now Playing</TabsTrigger>
                          <TabsTrigger value="queue">Queue</TabsTrigger>
                          <TabsTrigger value="recommendations">
                            For You
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <div className="relative overflow-hidden">
                        <TabsContent
                          value="current"
                          className={cn(
                            "transition-opacity duration-300",
                            activeTab === "current"
                              ? "opacity-100"
                              : "opacity-0 absolute inset-0 pointer-events-none",
                          )}
                        >
                          <div className="h-full flex flex-col items-center justify-center p-5 max-w-2xl mx-auto gap-8">
                            <div className="w-full max-w-md aspect-square">
                              <Avatar className="w-full h-full rounded-lg shadow-lg">
                                <AvatarImage
                                  src={songImage}
                                  alt={currentSong.name}
                                  className="object-cover"
                                />
                                <AvatarFallback className="text-4xl">
                                  MU
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            <div className="w-full max-w-md space-y-6">
                              <div className="text-center">
                                <SheetTitle className="text-2xl mb-2">
                                  {he.decode(currentSong.name)}
                                </SheetTitle>
                                <p className="text-muted-foreground">
                                  {he.decode(artistName)}
                                </p>
                              </div>

                              <ProgressBarMusic isTimeVisible={true} />

                              <div className="flex flex-col items-center gap-6">
                                <MusicControls size="large" />

                                <div className="flex items-center gap-4">
                                  <VolumeControl showVolume={true} />
                                  <Button
                                    variant="outline"
                                    onClick={() => setIsModalOpen(true)}
                                    className="hover:scale-105"
                                  >
                                    <ListMusic size={20} className="mr-2" />
                                    Add to Playlist
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent
                          value="queue"
                          className={cn(
                            "transition-opacity duration-300",
                            activeTab === "queue"
                              ? "opacity-100"
                              : "opacity-0 absolute inset-0 pointer-events-none",
                          )}
                        >
                          <CurrentQueue />
                        </TabsContent>

                        <TabsContent
                          value="recommendations"
                          className={cn(
                            "transition-opacity duration-300",
                            activeTab === "recommendations"
                              ? "opacity-100"
                              : "opacity-0 absolute inset-0 pointer-events-none",
                          )}
                        >
                          {loading ? (
                            <LoadingState
                              height={"80vh"}
                              message={"Cooking up some recommendations"}
                            />
                          ) : recommendations.length === 0 ? (
                            <div className="flex h-[80vh] items-center justify-center">
                              <p className="text-muted-foreground">
                                No recommendations available
                              </p>
                            </div>
                          ) : (
                            <PlaylistInBottom songs={recommendations} />
                          )}
                        </TabsContent>
                      </div>
                    </Tabs>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </CardContent>
      </Card>

      {isMinimized && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <DraggableButton
            position={position}
            onDragEnd={handleDragEnd}
            onMaximize={() => setIsMinimized(false)}
            songImage={songImage}
            currentSong={currentSong}
            isDragging={isDragging}
            isPlaying={isPlaying}
          />
        </DndContext>
      )}

      {/* Add to Playlist Dialog */}
      <AddToPlaylist
        dialogOpen={isModalOpen}
        setDialogOpen={setIsModalOpen}
        song={currentSong}
      />
    </>
  );
};

export default memo(BottomPlayer);
