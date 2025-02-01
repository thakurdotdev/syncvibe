import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlaylist } from "@/Context/PlayerContext";
import React from "react";
import { SongCard } from "./Cards";

const PlaylistInBottom = React.memo(({ songs }) => {
  return (
    <div>
      <ScrollArea className="w-full overflow-y-auto h-[80vh] md:h-[85vh]">
        <div className="flex flex-col gap-4 p-4 w-full max-w-3xl mx-auto">
          {songs?.length > 0 &&
            songs.map((song, index) => <SongCard key={song.id} song={song} />)}
        </div>
      </ScrollArea>
    </div>
  );
});

export const CurrentQueue = React.memo(() => {
  const { playlist } = usePlaylist();

  if (!playlist || playlist?.length === 0) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <p className="text-lg text-gray-500">No songs in queue</p>
      </div>
    );
  }
  return (
    <div>
      <ScrollArea className="w-full overflow-y-auto h-[80vh] md:h-[85vh]">
        <div className="flex flex-col gap-4 p-4 w-full max-w-3xl mx-auto">
          {playlist?.length > 0 &&
            playlist.map((song, index) => (
              <SongCard key={song.id} song={song} />
            ))}
        </div>
      </ScrollArea>
    </div>
  );
});

export default PlaylistInBottom;
