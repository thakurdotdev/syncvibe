import { Context } from '@/Context/Context';
import { usePlayerStore } from '@/stores/playerStore';
import axios from 'axios';
import { CalendarDays, ListMusic } from 'lucide-react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SongCard } from './Cards';
import { LoadingState, PlaylistActions } from './Common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const PlaylistHeader = ({ playlistData }) => {
  const bgUrl = Array.isArray(playlistData?.image) ? playlistData?.image[2]?.link : '';

  return (
    <div className='relative w-full h-[250px] rounded-lg md:rounded-2xl overflow-hidden'>
      <div
        className='absolute inset-0 bg-center bg-cover'
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />

      <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/40 backdrop-blur-sm'>
        <div className='h-full w-full p-4 md:p-6 flex flex-col md:flex-row md:items-end'>
          <div className='flex flex-col md:flex-row md:items-end gap-4 md:gap-6 mt-auto'>
            <div className='w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] md:w-[200px] md:h-[200px] rounded-lg overflow-hidden shadow-xl mx-auto md:mx-0'>
              <Avatar className={'w-full h-full rounded-none'}>
                <AvatarImage
                  src={bgUrl}
                  alt={playlistData?.name}
                  className={'object-cover '}
                  loading='lazy'
                />
                <AvatarFallback className='w-full h-full rounded-none'>
                  <ListMusic className='w-12 h-12' />
                </AvatarFallback>
              </Avatar>
            </div>

            <div className='flex flex-col gap-2 md:gap-3 text-white'>
              <div className='flex md:hidden items-center justify-center gap-2 text-xs text-white/80'>
                <ListMusic className='w-3 h-3' />
                <span>Playlist</span>
                <span>•</span>
                <span>{playlistData?.songs?.length || 0} songs</span>
              </div>

              <div className='hidden md:flex items-center gap-2 text-sm text-white/90'>
                <ListMusic className='w-4 h-4' />
                <span>Playlist</span>
                <span>•</span>
                <CalendarDays className='w-4 h-4' />
                <span>{new Date(playlistData?.createdat).toLocaleDateString()}</span>
              </div>

              <h1 className='text-xl md:text-3xl font-bold text-center md:text-left line-clamp-2 md:line-clamp-none'>
                {playlistData?.name}
              </h1>

              <p className='text-sm text-white/90 line-clamp-2 text-center md:text-left'>
                {playlistData?.description || 'No description'}
              </p>

              <div className='flex items-center justify-center md:justify-start gap-2 text-sm text-white/90'>
                <span className='hidden md:inline'>{playlistData?.songs?.length || 0} songs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserPlaylistDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useContext(Context);
  const id = location.state || params?.id || null;
  const [playlistData, setPlaylistData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Individual selectors
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const playSong = usePlayerStore((s) => s.playSong);

  useEffect(() => {
    if (!user || !playlistData || !id) return;
    if (user?.userid !== playlistData?.userId) {
      navigate('/music/my-playlist');
    }
  }, [user, playlistData, navigate]);

  const fetchPlaylistData = useCallback(async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/playlist/details`, {
        params: { id },
        withCredentials: true,
      });
      setPlaylistData(response.data.data);
    } catch (error) {
      console.error('Error fetching playlist data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPlaylistData();
    }
  }, [id, fetchPlaylistData]);

  const handlePlayAll = () => {
    if (playlistData?.songs?.length) {
      setPlaylist(playlistData.songs.map((s) => s.songData));
      playSong(playlistData.songs[0].songData);
    }
  };

  const handleShuffle = () => {
    if (playlistData?.songs?.length) {
      const shuffledSongs = [...playlistData.songs]
        .map((s) => s.songData)
        .sort(() => Math.random() - 0.5);
      setPlaylist(shuffledSongs);
      playSong(shuffledSongs[0]);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className='flex flex-col gap-6 p-6'>
      <PlaylistHeader playlistData={playlistData} />

      <PlaylistActions
        onPlayAll={handlePlayAll}
        onShuffle={handleShuffle}
        disabled={!playlistData?.songs?.length}
        showShare={false}
      />

      {playlistData?.songs?.length === 0 ? (
        <div className='text-center py-12'>
          <ListMusic className='w-12 h-12 mx-auto text-muted-foreground' />
          <p className='mt-4 text-muted-foreground'>No songs in this playlist yet</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
          {playlistData.songs.map((song) => (
            <SongCard key={song.id} song={song.songData} />
          ))}
        </div>
      )}
    </div>
  );
};

export default UserPlaylistDetails;
