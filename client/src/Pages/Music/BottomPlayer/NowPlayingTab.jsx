import he from 'he';
import { ChevronRight, ListPlus, Music, Share2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShareDrawer from '@/components/Posts/ShareDrawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlayerStore } from '@/stores/playerStore';
import { MusicControls, ProgressBarMusic, VolumeControl } from '../Common';
import SleepTimerModal from '../SleepTimer';

const useCrossfadeImage = (src) => {
  const [images, setImages] = useState({ current: src, previous: null, transitioning: false });
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (src && src !== images.current) {
      setImages((prev) => ({ current: src, previous: prev.current, transitioning: true }));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setImages((prev) => ({ ...prev, previous: null, transitioning: false }));
      }, 500);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [src]);

  return images;
};

const useNextSong = (currentSong) => {
  const playlist = usePlayerStore((s) => s.playlist);
  return useMemo(() => {
    if (!playlist.length || !currentSong) return null;
    const idx = playlist.findIndex((s) => s.id === currentSong.id);
    if (idx === -1 || idx >= playlist.length - 1) return null;
    return playlist[idx + 1];
  }, [playlist, currentSong]);
};

const UpNextHint = memo(({ nextSong }) => {
  const nextImage = nextSong?.image?.[1]?.link;
  const nextName = nextSong?.name ? he.decode(nextSong.name) : '';
  const nextArtist = nextSong?.artist_map?.artists?.[0]?.name
    ? he.decode(nextSong.artist_map.artists[0].name)
    : '';
  const handleNextSong = usePlayerStore((s) => s.handleNextSong);

  if (!nextSong) return null;

  return (
    <button
      type='button'
      onClick={() => handleNextSong(false)}
      className='group flex items-center gap-3 px-1 py-1.5 hover:opacity-80 transition-opacity duration-150 cursor-pointer w-full max-w-md text-left'
    >
      <Avatar className='w-9 h-9 rounded-lg shrink-0 border border-border/30'>
        <AvatarImage src={nextImage} alt={nextName} className='object-cover' />
        <AvatarFallback className='rounded-lg bg-muted text-xs'>
          <Music className='w-4 h-4 text-muted-foreground' />
        </AvatarFallback>
      </Avatar>
      <div className='flex-1 min-w-0'>
        <p className='text-[10px] uppercase tracking-wider text-muted-foreground font-semibold'>
          Up Next
        </p>
        <p className='text-xs sm:text-[13px] text-foreground font-medium truncate'>
          {nextName}
          {nextArtist && <span className='text-muted-foreground font-normal'> • {nextArtist}</span>}
        </p>
      </div>
      <ChevronRight className='w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0' />
    </button>
  );
});
UpNextHint.displayName = 'UpNextHint';

const CrossfadeAvatar = memo(({ images, size, name }) => (
  <div
    className='relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl transition-transform duration-300 hover:scale-[1.015]'
    style={{ width: size, height: size }}
  >
    <div className='absolute inset-0 flex items-center justify-center bg-muted/40'>
      <Music className='w-20 h-20 text-muted-foreground/30' />
    </div>
    {images.previous && (
      <img
        src={images.previous}
        alt=''
        className='absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0'
        aria-hidden='true'
      />
    )}
    <img
      src={images.current}
      alt={name}
      className='absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-100'
    />
  </div>
));
CrossfadeAvatar.displayName = 'CrossfadeAvatar';

const NowPlayingTab = memo(({ currentSong, onOpenModal }) => {
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false);
  const songImage = useMemo(
    () => currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link,
    [currentSong]
  );
  const images = useCrossfadeImage(songImage);
  const nextSong = useNextSong(currentSong);
  const [showEntrance, setShowEntrance] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = requestAnimationFrame(() => setShowEntrance(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const artistList = useMemo(
    () => currentSong?.artist_map?.artists?.slice(0, 3) || [],
    [currentSong]
  );

  const decodedName = useMemo(() => he.decode(currentSong?.name || ''), [currentSong?.name]);
  const decodedAlbum = useMemo(
    () => (currentSong?.album?.name ? he.decode(currentSong.album.name) : ''),
    [currentSong?.album?.name]
  );

  const handleArtistClick = useCallback(
    (e, artistId) => {
      e.stopPropagation();
      if (artistId) {
        navigate(`/music/artist/${artistId}`, { state: artistId });
      }
    },
    [navigate]
  );

  const handleAlbumClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (currentSong?.album_id) {
        navigate(`/music/album/${currentSong.album_id}`, { state: currentSong.album_id });
      }
    },
    [currentSong?.album_id, navigate]
  );

  return (
    <div className='w-full h-full relative overflow-hidden bg-background text-foreground lg:pr-[360px]'>
      {/* Ambient background glow */}
      <div className='absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none'>
        {images.previous && (
          <img
            src={images.previous}
            alt=''
            className='absolute inset-0 w-full h-full object-cover scale-150 blur-[100px] opacity-20 saturate-150 transition-opacity duration-700'
          />
        )}
        <img
          src={images.current}
          alt=''
          className='absolute inset-0 w-full h-full object-cover scale-150 blur-[100px] opacity-25 saturate-150 transition-opacity duration-700'
        />
        <div className='absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background' />
      </div>

      {/* Desktop Layout */}
      <div className='hidden lg:flex relative z-10 h-full w-full max-w-[1040px] mx-auto items-center gap-12 xl:gap-16 px-8 xl:px-12'>
        {/* Left: Album Cover */}
        <div
          className='shrink-0 transition-all duration-500 ease-out'
          style={{
            opacity: showEntrance ? 1 : 0,
            transform: showEntrance ? 'scale(1)' : 'scale(0.95)',
          }}
        >
          <CrossfadeAvatar
            images={images}
            size='min(36vw, 48vh, 400px)'
            name={decodedName}
          />
        </div>

        {/* Right: Meta + Player Controls */}
        <div
          className='flex-1 flex flex-col gap-6 min-w-0 transition-all duration-500 ease-out'
          style={{
            opacity: showEntrance ? 1 : 0,
            transform: showEntrance ? 'translateY(0)' : 'translateY(16px)',
            transitionDelay: '0.1s',
          }}
        >
          {/* Song Info */}
          <div className='space-y-1.5'>
            <SheetTitle className='text-2xl xl:text-3xl font-bold line-clamp-2 text-foreground tracking-tight leading-snug'>
              {decodedName}
            </SheetTitle>
            <div className='flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground font-medium'>
              {artistList.length > 0 ? (
                artistList.map((artist, idx) => (
                  <span key={artist.id || idx}>
                    <button
                      type='button'
                      onClick={(e) => handleArtistClick(e, artist.id)}
                      className='hover:text-foreground transition-colors cursor-pointer underline-offset-2 hover:underline'
                    >
                      {he.decode(artist.name)}
                    </button>
                    {idx < artistList.length - 1 && <span className='text-muted-foreground/40'>, </span>}
                  </span>
                ))
              ) : (
                <span className='text-muted-foreground'>Unknown Artist</span>
              )}
            </div>
            {decodedAlbum && (
              <button
                type='button'
                onClick={handleAlbumClick}
                className='text-xs text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer block mt-1 underline-offset-2 hover:underline'
              >
                {decodedAlbum}
              </button>
            )}
          </div>

          {/* Controls Section */}
          <div className='max-w-lg space-y-4'>
            <ProgressBarMusic isTimeVisible={true} />
            <MusicControls size='large' />

            {/* Quick Actions Toolbar */}
            <div className='flex items-center justify-between pt-1 px-1 border-t border-border/40'>
              <VolumeControl showVolume={true} alwaysShowSlider={true} />

              <div className='flex items-center gap-1.5'>
                <SleepTimerModal />

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenModal?.();
                        }}
                        className='h-8.5 w-8.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full cursor-pointer transition-colors'
                        aria-label='Add to Playlist'
                      >
                        <ListPlus size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='top' className='text-xs'>
                      Add to Playlist
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setIsShareDrawerOpen(true)}
                        className='h-8.5 w-8.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full cursor-pointer transition-colors'
                        aria-label='Share Song'
                      >
                        <Share2 size={17} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='top' className='text-xs'>
                      Share
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Up Next Card */}
          {nextSong && (
            <div className='pt-2'>
              <UpNextHint nextSong={nextSong} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className='lg:hidden relative z-10 h-full flex flex-col items-center justify-between px-6 sm:px-8 pt-16 pb-8 overflow-y-auto'>
        <div className='flex-1 flex flex-col items-center justify-center gap-5 w-full max-w-sm my-auto'>
          {/* Mobile Album Artwork */}
          <div
            className='transition-all duration-500 ease-out'
            style={{
              opacity: showEntrance ? 1 : 0,
              transform: showEntrance ? 'scale(1)' : 'scale(0.95)',
            }}
          >
            <CrossfadeAvatar
              images={images}
              size='min(82vw, 36vh, 320px)'
              name={decodedName}
            />
          </div>

          {/* Mobile Info + Controls */}
          <div
            className='w-full space-y-4 transition-all duration-500 ease-out'
            style={{
              opacity: showEntrance ? 1 : 0,
              transform: showEntrance ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: '0.1s',
            }}
          >
            <div className='text-center space-y-1'>
              <SheetTitle className='text-xl sm:text-2xl font-bold line-clamp-2 text-foreground tracking-tight leading-snug'>
                {decodedName}
              </SheetTitle>
              <div className='flex items-center justify-center flex-wrap gap-x-1.5 text-sm text-muted-foreground font-medium'>
                {artistList.length > 0 ? (
                  artistList.map((artist, idx) => (
                    <span key={artist.id || idx}>
                      <button
                        type='button'
                        onClick={(e) => handleArtistClick(e, artist.id)}
                        className='hover:text-foreground transition-colors cursor-pointer'
                      >
                        {he.decode(artist.name)}
                      </button>
                      {idx < artistList.length - 1 && <span className='text-muted-foreground/40'>, </span>}
                    </span>
                  ))
                ) : (
                  <span className='text-muted-foreground'>Unknown Artist</span>
                )}
              </div>
              {decodedAlbum && (
                <button
                  type='button'
                  onClick={handleAlbumClick}
                  className='text-xs text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer'
                >
                  {decodedAlbum}
                </button>
              )}
            </div>

            <ProgressBarMusic isTimeVisible={true} />

            <div className='flex justify-center'>
              <MusicControls size='large' />
            </div>

            {/* Mobile Actions Toolbar */}
            <div className='flex items-center justify-between px-1 pt-1'>
              <VolumeControl showVolume={true} alwaysShowSlider={true} />

              <div className='flex items-center gap-1.5'>
                <SleepTimerModal />
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenModal?.();
                  }}
                  className='h-8.5 w-8.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full cursor-pointer'
                  aria-label='Add to Playlist'
                >
                  <ListPlus size={18} />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setIsShareDrawerOpen(true)}
                  className='h-8.5 w-8.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full cursor-pointer'
                  aria-label='Share Song'
                >
                  <Share2 size={17} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {nextSong && (
          <div
            className='w-full max-w-sm pt-2 transition-all duration-500 ease-out'
            style={{
              opacity: showEntrance ? 1 : 0,
              transform: showEntrance ? 'translateY(0)' : 'translateY(10px)',
              transitionDelay: '0.2s',
            }}
          >
            <UpNextHint nextSong={nextSong} />
          </div>
        )}
      </div>

      <ShareDrawer
        isOpen={isShareDrawerOpen}
        onClose={() => setIsShareDrawerOpen(false)}
        shareLink={window.location.href}
      />
    </div>
  );
});

NowPlayingTab.displayName = 'NowPlayingTab';
export default NowPlayingTab;
