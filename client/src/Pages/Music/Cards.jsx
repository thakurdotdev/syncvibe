import axios from 'axios';
import he from 'he';
import { Loader2, MoreVertical, Pencil, Play, Trash2, Users, Radio } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCurrentGroup, useGroupMusicActions } from '@/Context/GroupMusicContext';
import LazyImage from '@/components/LazyImage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';
import AddToPlaylist from './AddToPlaylist';
import { ensureHttpsForDownloadUrls } from './Common';
import './music.css';

export const getPlaylistImageUrl = (image) => {
  if (typeof image === 'string') return image;
  if (image && typeof image === 'object' && !Array.isArray(image)) return image.link || '';
  if (!Array.isArray(image)) return '';

  for (let index = image.length - 1; index >= 0; index -= 1) {
    const item = image[index];
    const link = typeof item === 'string' ? item : item?.link;
    if (link) return link;
  }

  return '';
};

const formatPlaylistDate = (value) => {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Added just now';
  if (minutes < 60) return `Added ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Added ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Added ${days}d ago`;

  return `Added ${new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
};

/** Now-playing bars. CSS-only (transform), so a playing card costs nothing per frame in JS. */
export const AudioWave = memo(() => (
  <span className='flex h-4 items-end gap-[3px]' aria-hidden='true'>
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className='h-full w-[3px] origin-bottom rounded-full bg-white animate-wave'
        style={{ animationDelay: `${i * 0.12}s` }}
      />
    ))}
  </span>
));

export const ArtistCard = memo(({ artist }) => {
  const navigate = useNavigate();
  if (!artist?.name || !artist?.image) return null;

  const imageUrl = Array.isArray(artist.image) ? artist.image[2].link : artist.image;

  return (
    <div
      className='press w-[150px] group cursor-pointer rounded-xl p-3 hover:bg-foreground/[0.045]'
      onClick={() => navigate(`/artist/${artist.id}`, { state: artist.id })}
    >
      <div className='art-zoom relative mb-3 overflow-hidden rounded-full'>
        <LazyImage
          src={imageUrl}
          alt={artist.name}
          height={128}
          width={128}
          className='w-full aspect-square rounded-full object-cover'
        />
      </div>
      <p className='font-medium text-sm text-center truncate'>{artist.name}</p>
      <p className='text-xs text-muted-foreground text-center truncate'>
        {artist.description || 'Artist'}
      </p>
    </div>
  );
});

export const SongCard = memo(({ song, onRemoveFromPlaylist }) => {
  const navigate = useNavigate();
  // Boolean selectors: a card only re-renders when *its* state changes, not on every
  // play/pause or queue edit elsewhere.
  const isCurrentSong = usePlayerStore((s) => Boolean(song?.id) && s.currentSong?.id === song?.id);
  const isPlaying = usePlayerStore(
    (s) => Boolean(song?.id) && s.currentSong?.id === song?.id && s.isPlaying
  );
  const isInQueue = usePlayerStore(
    (s) => Boolean(song?.id) && s.playlist.some((item) => item.id === song?.id)
  );
  const playSong = usePlayerStore((s) => s.playSong);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const currentGroup = useCurrentGroup();
  const { addToQueue: addToGroupQueue, playNext: playNextInGroup } = useGroupMusicActions();

  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!song?.id || !song?.image?.[2]) return null;

  const name = he.decode(song.name || song.title || '');
  const artistName =
    song?.artist_map?.artists
      ?.slice(0, 2)
      ?.map((a) => a.name)
      .join(', ') ||
    song?.name ||
    '';

  const handlePlay = async (e) => {
    e?.stopPropagation();
    if (isCurrentSong) {
      handlePlayPause();
      return;
    }
    if (song?.download_url) {
      playSong(ensureHttpsForDownloadUrls(song));
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`);
      if (response.data?.data?.songs[0]) {
        playSong(ensureHttpsForDownloadUrls(response.data.data.songs[0]));
      }
    } catch (err) {
      console.error('Error fetching song:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = (e) => {
    e.stopPropagation();
    if (!isCurrentSong) {
      addToQueue(song);
      toast.success(`Added to queue`);
    }
  };

  const handleRemoveFromQueue = (e) => {
    e.stopPropagation();
    if (isCurrentSong) {
      toast.error("Can't remove playing song");
      return;
    }
    setPlaylist(usePlayerStore.getState().playlist.filter((item) => item.id !== song.id));
    toast.success(`Removed from queue`);
  };

  const handleNavigate = () => {
    if (song.type !== 'song') {
      navigate(`/${song.type}/${song.id}`, { state: song.id });
    }
  };

  return (
    <>
      <div
        className={cn(
          'press group cursor-pointer rounded-xl p-2',
          isCurrentSong ? 'bg-primary/[0.07] hover:bg-primary/10' : 'hover:bg-foreground/[0.045]'
        )}
      >
        <div
          className='flex items-center gap-3'
          onClick={song.type === 'song' ? handlePlay : handleNavigate}
        >
          <div className='relative shrink-0 w-12 h-12'>
            <LazyImage
              src={Array.isArray(song.image) ? song.image?.[1].link : song.image}
              alt={name}
              height={48}
              width={48}
              className='w-12 h-12 rounded-md object-cover'
            />
            {song.type === 'song' && (
              <div
                className={cn(
                  'absolute inset-0 grid place-items-center rounded-md bg-black/55 transition-opacity duration-150',
                  isCurrentSong || menuOpen || loading
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100'
                )}
              >
                {loading ? (
                  <Loader2 className='w-5 h-5 text-white animate-spin' />
                ) : isPlaying ? (
                  <AudioWave />
                ) : (
                  <Play className='w-5 h-5 text-white' fill='white' />
                )}
              </div>
            )}
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2'>
              <p className='font-medium text-sm truncate'>{name}</p>
              {isCurrentSong && (
                <Badge variant='secondary' className='h-4 text-[10px] px-1.5 shrink-0'>
                  Playing
                </Badge>
              )}
            </div>
            <p className='text-xs text-muted-foreground truncate'>{artistName}</p>
          </div>

          {song.type === 'song' && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 shrink-0'
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                {song?.album_id && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/album/${song.album_id}`, { state: song.album_id });
                    }}
                  >
                    Go to album
                  </DropdownMenuItem>
                )}
                {song?.artist_map?.primary_artists?.[0] && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/artist/${song.artist_map.primary_artists[0].id}`);
                    }}
                  >
                    Go to artist
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={isInQueue && !isCurrentSong ? handleRemoveFromQueue : handleAddToQueue}
                  disabled={isCurrentSong && isInQueue}
                >
                  {isInQueue
                    ? isCurrentSong
                      ? 'Now Playing'
                      : 'Remove from queue'
                    : 'Add to queue'}
                </DropdownMenuItem>
                {currentGroup && (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        addToGroupQueue(song);
                      }}
                      className='text-primary font-medium focus:text-primary focus:bg-primary/10'
                    >
                      <Users className='w-4 h-4 mr-2' />
                      Add to Group Queue
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        playNextInGroup(song);
                      }}
                      className='text-primary font-medium focus:text-primary focus:bg-primary/10'
                    >
                      <Radio className='w-4 h-4 mr-2' />
                      Play Next in Group
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='rounded-lg cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(true);
                  }}
                >
                  Add to playlist
                </DropdownMenuItem>
                {onRemoveFromPlaylist && (
                  <DropdownMenuItem
                    className='rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10'
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromPlaylist(song.id);
                    }}
                  >
                    Remove from this playlist
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {isModalOpen && (
        <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={song} />
      )}
    </>
  );
});

export const NewSongCard = memo(({ song }) => {
  const navigate = useNavigate();
  // Boolean selectors: a card only re-renders when *its* state changes, not on every
  // play/pause or queue edit elsewhere.
  const isCurrentSong = usePlayerStore((s) => Boolean(song?.id) && s.currentSong?.id === song?.id);
  const isPlaying = usePlayerStore(
    (s) => Boolean(song?.id) && s.currentSong?.id === song?.id && s.isPlaying
  );
  const isInQueue = usePlayerStore(
    (s) => Boolean(song?.id) && s.playlist.some((item) => item.id === song?.id)
  );
  const playSong = usePlayerStore((s) => s.playSong);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const currentGroup = useCurrentGroup();
  const { addToQueue: addToGroupQueue, playNext: playNextInGroup } = useGroupMusicActions();

  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!song?.id || !song?.image?.[2]) return null;

  const name = he.decode(song.name || song.title || '');
  const artistName =
    song?.artist_map?.artists
      ?.slice(0, 2)
      ?.map((a) => a.name)
      .join(', ') ||
    song?.name ||
    '';

  const handlePlay = async () => {
    if (isCurrentSong) {
      handlePlayPause();
      return;
    }
    if (song?.download_url) {
      playSong(ensureHttpsForDownloadUrls(song));
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`);
      if (response.data?.data?.songs[0]) {
        playSong(ensureHttpsForDownloadUrls(response.data.data.songs[0]));
      }
    } catch (err) {
      console.error('Error fetching song:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = (e) => {
    e.stopPropagation();
    if (!isCurrentSong) {
      addToQueue(song);
      toast.success(`Added to queue`);
    }
  };

  const handleRemoveFromQueue = (e) => {
    e.stopPropagation();
    if (isCurrentSong) {
      toast.error("Can't remove playing song");
      return;
    }
    setPlaylist(usePlayerStore.getState().playlist.filter((item) => item.id !== song.id));
    toast.success(`Removed from queue`);
  };

  const handleNavigate = () => {
    if (song.type !== 'song') {
      navigate(`/${song.type}/${song.id}`, { state: song.id });
    }
  };

  return (
    <>
      <div
        className={cn(
          'press w-[150px] group cursor-pointer rounded-xl p-2',
          isCurrentSong ? 'bg-primary/[0.07]' : 'hover:bg-foreground/[0.045]'
        )}
        onClick={song.type === 'song' ? handlePlay : handleNavigate}
      >
        <div className='relative mb-2 overflow-hidden rounded-lg'>
          <div className='art-zoom'>
            <LazyImage
              src={Array.isArray(song.image) ? song.image?.[2]?.link : song.image}
              alt={name}
              height={140}
              width={140}
              className='w-full aspect-square rounded-lg object-cover'
            />
          </div>
          <div
            className={cn(
              'absolute inset-0 grid place-items-center rounded-lg bg-black/45 transition-opacity duration-150',
              isCurrentSong || menuOpen || loading
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {loading ? (
              <Loader2 className='w-8 h-8 text-white animate-spin' />
            ) : isPlaying ? (
              <div className='scale-125'>
                <AudioWave />
              </div>
            ) : (
              <span className='grid h-11 w-11 translate-y-1 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 ease-snappy group-hover:translate-y-0'>
                <Play className='ml-0.5 h-5 w-5' fill='currentColor' />
              </span>
            )}
          </div>
          {song.type === 'song' && (
            <div
              className={cn(
                'absolute top-1 right-1 transition-opacity duration-150',
                'opacity-100 md:opacity-0 md:group-hover:opacity-100',
                menuOpen && 'opacity-100!'
              )}
            >
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7 bg-black/50 hover:bg-black/70'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className='h-4 w-4 text-white' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-48'>
                  {song?.album_id && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/album/${song.album_id}`, { state: song.album_id });
                      }}
                    >
                      Go to album
                    </DropdownMenuItem>
                  )}
                  {song?.artist_map?.primary_artists?.[0] && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/artist/${song.artist_map.primary_artists[0].id}`);
                      }}
                    >
                      Go to artist
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={isInQueue && !isCurrentSong ? handleRemoveFromQueue : handleAddToQueue}
                    disabled={isCurrentSong && isInQueue}
                  >
                    {isInQueue
                      ? isCurrentSong
                        ? 'Now Playing'
                        : 'Remove from queue'
                      : 'Add to queue'}
                  </DropdownMenuItem>
                  {currentGroup && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          addToGroupQueue(song);
                        }}
                        className='text-primary font-medium focus:text-primary focus:bg-primary/10'
                      >
                        <Users className='w-4 h-4 mr-2' />
                        Add to Group Queue
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          playNextInGroup(song);
                        }}
                        className='text-primary font-medium focus:text-primary focus:bg-primary/10'
                      >
                        <Radio className='w-4 h-4 mr-2' />
                        Play Next in Group
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsModalOpen(true);
                    }}
                  >
                    Add to playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div>
          <p className='font-medium text-sm truncate'>{name}</p>
          <p className='text-xs text-muted-foreground truncate'>{artistName}</p>
          {(song.language || song.album || song.type !== 'song') && (
            <Badge
              variant='outline'
              className='mt-1.5 text-[10px] h-5 capitalize max-w-full truncate'
            >
              {song.language || (song.type === 'song' ? song.album : song.type)}
            </Badge>
          )}
        </div>
      </div>

      {isModalOpen && (
        <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={song} />
      )}
    </>
  );
});

export const AlbumCard = memo(({ album }) => {
  const navigate = useNavigate();
  const name = useMemo(() => he.decode(album.name || album.title || ''), [album]);

  return (
    <div
      className='press w-[150px] group cursor-pointer rounded-xl p-2 hover:bg-foreground/[0.045]'
      onClick={() =>
        navigate(`/album/${album.album_id || album?.id}`, {
          state: album.album_id || album?.id,
        })
      }
    >
      <div className='art-zoom relative mb-2 overflow-hidden rounded-lg'>
        <LazyImage
          src={album.image?.[2]?.link || album.image?.[2]?.url}
          alt={name}
          height={140}
          width={140}
          className='w-full aspect-square rounded-lg object-cover'
        />
      </div>
      <p className='font-medium text-sm truncate'>{name}</p>
      {album.language && (
        <p className='text-xs capitalize text-muted-foreground truncate'>{album.language}</p>
      )}
    </div>
  );
});

export const PlaylistCard = memo(({ playlist }) => {
  const navigate = useNavigate();

  if (!playlist?.name || !playlist?.image) return null;

  const subtitle = playlist.subtitle || playlist.description || 'Playlist';
  const imageUrl = Array.isArray(playlist.image) ? playlist.image[2].link : playlist.image;

  return (
    <div
      className='press w-[150px] group cursor-pointer rounded-xl p-2 hover:bg-foreground/[0.045]'
      onClick={() => navigate(`/playlist/${playlist.id}`, { state: playlist.id })}
    >
      <div className='art-zoom relative mb-2 aspect-square overflow-hidden rounded-lg'>
        <LazyImage
          src={imageUrl}
          alt={playlist.name}
          height={140}
          width={140}
          className='w-full aspect-square rounded-lg object-cover'
        />
      </div>
      <p className='font-medium text-sm truncate'>{playlist.name}</p>
      <p className='text-xs text-muted-foreground truncate'>{subtitle}</p>
    </div>
  );
});

const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, playlistName }) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent className='liquid-glass border border-border/30 rounded-2xl shadow-2xl p-5 md:p-6 space-y-4'>
      <AlertDialogHeader className='space-y-2'>
        <AlertDialogTitle className='text-lg font-bold text-foreground'>
          Delete Playlist
        </AlertDialogTitle>
        <AlertDialogDescription className='text-sm text-muted-foreground font-medium'>
          Are you sure you want to delete{' '}
          <span className='font-bold text-foreground'>"{playlistName}"</span>? This action cannot be
          undone and all local playlist data will be lost.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className='gap-2 sm:gap-0'>
        <AlertDialogCancel className='rounded-xl border border-border/30 hover:bg-accent/50 cursor-pointer active:scale-95 transition-all'>
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className='bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold cursor-pointer active:scale-95 transition-all'
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/** Stable hue from a playlist name, so covers without artwork still look distinct. */
const nameHue = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
};

export const PlaylistCover = memo(({ playlist, className }) => {
  const images = (Array.isArray(playlist.previewSongs) ? playlist.previewSongs : [])
    .map((song) => getPlaylistImageUrl(song?.image))
    .filter(Boolean);
  const unique = [...new Set(images)];
  const fallback = getPlaylistImageUrl(playlist.image);

  if (unique.length >= 4) {
    return (
      <div className={cn('grid grid-cols-2 grid-rows-2', className)}>
        {unique.slice(0, 4).map((src) => (
          <img key={src} src={src} alt='' loading='lazy' className='h-full w-full object-cover' />
        ))}
      </div>
    );
  }
  const single = unique[0] || fallback;
  if (single) {
    return <img src={single} alt='' loading='lazy' className={cn('object-cover', className)} />;
  }
  const hue = nameHue(playlist.name);
  return (
    <div
      className={cn('grid place-items-center', className)}
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 70% 58%), hsl(${(hue + 50) % 360} 65% 38%))`,
      }}
    >
      <span className='font-display text-5xl font-bold text-white/90'>
        {playlist.name?.[0]?.toUpperCase()}
      </span>
    </div>
  );
});

export const UserPlaylistCard = ({ playlist, onDelete, onEdit }) => {
  const navigate = useNavigate();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDelete = useCallback(() => {
    onDelete(playlist.id);
    setShowDeleteAlert(false);
  }, [playlist.id, onDelete]);

  if (!playlist?.name) return null;

  const songCount = Number(playlist.songCount) || 0;
  const addedLabel = formatPlaylistDate(playlist.lastAddedAt);
  const open = () => navigate(`/library/playlist/${playlist.id}`, { state: playlist.id });

  return (
    <>
      <div className='group relative'>
        <button
          type='button'
          onClick={open}
          className='press block w-full rounded-2xl text-left'
          aria-label={`Open ${playlist.name}`}
        >
          <div className='art-zoom relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-[0_1px_0_hsl(var(--foreground)/0.04)]'>
            <PlaylistCover playlist={playlist} className='h-full w-full' />
            <div className='pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.06]' />
          </div>
          <div className='mt-2.5 px-0.5'>
            <p className='truncate text-sm font-semibold'>{playlist.name}</p>
            <p className='mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground'>
              <span className='tabular-nums'>
                {songCount} {songCount === 1 ? 'song' : 'songs'}
              </span>
              {addedLabel && <span className='truncate'>{addedLabel}</span>}
            </p>
          </div>
        </button>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              aria-label={`More options for ${playlist.name}`}
              className={cn(
                'absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity duration-150 hover:bg-black/65',
                menuOpen
                  ? 'opacity-100'
                  : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
              )}
            >
              <MoreVertical className='h-4 w-4' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-40'>
            <DropdownMenuItem onClick={() => onEdit?.(playlist)}>
              <Pencil className='h-3.5 w-3.5' />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteAlert(true)}
              className='text-destructive focus:text-destructive'
            >
              <Trash2 className='h-3.5 w-3.5' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteConfirmDialog
        isOpen={showDeleteAlert}
        onClose={() => setShowDeleteAlert(false)}
        onConfirm={handleDelete}
        playlistName={playlist.name}
      />
    </>
  );
};
