import { usePlaylist } from "@/Context/PlayerContext";
import React from "react";
import { AutoSizer, List } from "react-virtualized";
import { SongCard } from "./Cards";

export const PlaylistInBottom = React.memo(({ songs }) => {
  const rowHeight = 90;

  const renderRow = ({ index, key, style }) => (
    <div key={key} style={style}>
      <SongCard song={songs[index]} />
    </div>
  );

  if (!songs?.length) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <p className="text-lg text-gray-500">No songs in playlist</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[90vh]">
      <AutoSizer>
        {({ height, width }) => (
          <List
            width={width}
            height={height}
            rowCount={songs.length}
            rowHeight={rowHeight}
            rowRenderer={renderRow}
            className="w-full max-w-3xl mx-auto p-4"
            overscanRowCount={5}
          />
        )}
      </AutoSizer>
    </div>
  );
});

export const CurrentQueue = React.memo(() => {
  const { playlist } = usePlaylist();
  const rowHeight = 90;

  const renderRow = ({ index, key, style }) => (
    <div key={key} style={style}>
      <SongCard song={playlist[index]} />
    </div>
  );

  if (!playlist?.length) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <p className="text-lg text-gray-500">No songs in queue</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[90vh]">
      <AutoSizer>
        {({ height, width }) => (
          <List
            width={width}
            height={height}
            rowCount={playlist.length}
            rowHeight={rowHeight}
            rowRenderer={renderRow}
            className="w-full max-w-3xl mx-auto p-4"
            overscanRowCount={5}
          />
        )}
      </AutoSizer>
    </div>
  );
});
