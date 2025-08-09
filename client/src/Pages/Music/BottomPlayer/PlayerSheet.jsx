import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlaylist } from "@/Context/PlayerContext";
import he from "he";
import { ChevronDownIcon, Disc3, ListMusic, Music } from "lucide-react";
import { memo, useEffect, useState } from "react";

import NowPlayingTab from "./NowPlayingTab";
import QueueTab from "./QueueTab";

const PlayerSheet = memo(({ isOpen, onClose, currentSong, onOpenModal }) => {
  const [activeTab, setActiveTab] = useState("current");
  const { playlist } = usePlaylist();

  useEffect(() => {
    if (isOpen) {
      setActiveTab("current");
    }
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-full w-full p-0 overflow-hidden bg-gradient-to-br from-background/95 via-background/90 to-background/95 backdrop-blur-xl border-t border-white/10 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" />
        <div className="h-full flex flex-col w-full max-w-[500px] mx-auto relative z-10">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col w-full"
          >
            {/* Header */}
            <SheetHeader className="p-4 pb-0 border-b border-white/10 space-y-4 bg-gradient-to-r from-white/[0.05] to-transparent">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2 max-w-[70%] truncate text-foreground/90">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm">
                    <Disc3 className="w-4 h-4 shrink-0 text-primary" />
                  </div>
                  {he.decode(currentSong?.name || "Now Playing")}
                </SheetTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 shrink-0 hover:bg-white/10 backdrop-blur-sm transition-all duration-200"
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </Button>
              </div>

              {/* Tabs Navigation */}
              <div className="flex justify-center pb-4">
                <TabsList className="grid grid-cols-2 w-full bg-white/[0.08] backdrop-blur-sm border border-white/10 shadow-lg">
                  <TabsTrigger
                    value="current"
                    className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-primary/20 data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all duration-200"
                  >
                    <Music className="w-4 h-4" />
                    <span className="hidden sm:inline">Now Playing</span>
                    <span className="sm:hidden">Current</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="queue"
                    className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-primary/20 data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all duration-200"
                  >
                    <ListMusic className="w-4 h-4" />
                    <span>Queue</span>
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 text-xs bg-gradient-to-r from-primary/20 to-primary/15 text-primary border border-primary/20 backdrop-blur-sm shadow-sm"
                    >
                      {playlist?.length || 0}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
            </SheetHeader>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
              <TabsContent
                value="current"
                className="mt-0 h-full overflow-y-auto p-0"
              >
                <NowPlayingTab
                  currentSong={currentSong}
                  onOpenModal={onOpenModal}
                />
              </TabsContent>

              <TabsContent
                value="queue"
                className="mt-0 h-full overflow-y-auto p-0"
              >
                <QueueTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
});

PlayerSheet.displayName = "PlayerSheet";
export default PlayerSheet;
