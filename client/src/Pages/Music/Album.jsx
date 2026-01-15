import { usePlayerStore } from '@/stores/playerStore';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SongCard } from './Cards';
import { ensureHttpsForDownloadUrls, LoadingState, PlaylistActions } from './Common';
import { useParams } from 'react-router-dom';

const Album = () => {
  const location = useLocation();
  const params = useParams();
  const id = location.state || params?.id || null;
  const [albumData, setAlbumData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Individual selectors
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const playSong = usePlayerStore((s) => s.playSong);

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/album?id=${id}`);
        const data = response.data;
        setAlbumData(data.data);
        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.error('Error fetching playlist data:', error);
      }
    };

    if (id) {
      fetchAlbumData();
    }
  }, [id]);

  if (loading) return <LoadingState />;

  const handlePlayAll = () => {
    if (albumData?.songs?.length) {
      setPlaylist(albumData.songs);
      const updatedSong = ensureHttpsForDownloadUrls(albumData.songs[0]);
      playSong(updatedSong);
    }
  };

  const handleShuffle = () => {
    if (albumData?.songs?.length) {
      const shuffledSongs = [...albumData.songs].sort(() => Math.random() - 0.5);
      setPlaylist(shuffledSongs);
      const updatedSong = ensureHttpsForDownloadUrls(shuffledSongs[0]);
      playSong(updatedSong);
    }
  };

  const bgUrl = albumData.image[2]?.link;
  const artistName = albumData?.artist_map?.artists
    ?.slice(0, 2)
    ?.map((artist) => artist.name)
    .join(', ');

  return (
    <div className='flex flex-col gap-10 p-5'>
      {/** Album Info */}
      <div
        className={`w-full h-[250px] rounded-2xl bg-cover`}
        style={{
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: 'cover',
        }}
      >
        <div className='rounded-2xl w-full h-full bg-black/60 backdrop-blur-sm flex items-center p-3 gap-6'>
          <div className='w-[200px] h-[200px]'>
            <img src={bgUrl} className='rounded-lg' />
          </div>
          <div className='h-[200px] flex flex-col py-3'>
            <h1 className='text-white text-3xl font-semibold'>{albumData.name}</h1>
            <p className='text-base text-white/70 font-medium mt-1'>:- {artistName}</p>
            <div className='mt-5 flex flex-col'>
              <p className='text-sm text-white/80'>{albumData.year}</p>
              <p className='text-sm text-white/80'>{albumData?.songcount} songs</p>
            </div>
          </div>
        </div>
      </div>
      <PlaylistActions
        onPlayAll={handlePlayAll}
        onShuffle={handleShuffle}
        disabled={!albumData?.songs?.length}
      />

      {/** Album Songs */}
      <div className='grid grid-cols-1 sm:grid-cols-4 gap-2'>
        {albumData.songs.map((song, index) => (
          <div key={index}>
            <SongCard song={song} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Album;
