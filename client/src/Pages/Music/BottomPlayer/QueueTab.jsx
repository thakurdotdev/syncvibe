import { usePlaylist } from '@/Context/PlayerContext';
import { memo } from 'react';
import { SongCard } from '../Cards';

const QueueTab = memo(() => {
  const { playlist } = usePlaylist();

  if (!playlist?.length) {
    return (
      <div className='flex justify-center items-center h-[80vh]'>
        <p className='text-lg text-gray-500'>No songs in queue</p>
      </div>
    );
  }

  return (
    <div className='w-full h-[90vh]'>
      <div className='flex flex-col p-4'>
        {playlist.map((song, index) => (
          <SongCard key={index} song={song} />
        ))}
      </div>
    </div>
  );
});

QueueTab.displayName = 'QueueTab';
export default QueueTab;
