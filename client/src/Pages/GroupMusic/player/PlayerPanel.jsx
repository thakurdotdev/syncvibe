import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { memo } from 'react';
import { Panel } from '../components/Panel';
import { getSongImage } from '../utils/song';
import Artwork from './Artwork';
import ArtworkBackdrop from './ArtworkBackdrop';
import EmptyPlayer from './EmptyPlayer';
import FloatingReactions from './FloatingReactions';
import PlaybackProgress from './PlaybackProgress';
import ReactionBar, { ReactionPopover } from './ReactionBar';
import TrackMeta from './TrackMeta';
import TransportControls from './TransportControls';
import VolumeControl from './VolumeControl';

// Sized by the panel's own width (container queries); shrunk on short viewports
// so the queue and chat keep their space.
const FULL_ARTWORK_SIZE =
  'h-24 w-24 @xl:h-28 @xl:w-28 @3xl:h-36 @3xl:w-36 [@media(max-height:760px)]:h-20! [@media(max-height:760px)]:w-20!';

const FullPlayer = ({ playback, controls, queueItem, onReact }) => (
  <div className='relative z-10 flex gap-4 p-4 @3xl:gap-5 @3xl:p-5 [@media(max-height:760px)]:p-3!'>
    <Artwork
      song={playback.song}
      isPlaying={playback.isPlaying}
      isSyncing={playback.isSyncing}
      className={FULL_ARTWORK_SIZE}
    />
    <div className='flex min-w-0 flex-1 flex-col justify-between gap-2'>
      <TrackMeta
        song={playback.song}
        addedBy={queueItem?.addedBy}
        isSyncing={playback.isSyncing}
        syncCountdown={playback.syncCountdown}
        isLocked={playback.isLocked}
        showEyebrow
      />
      <PlaybackProgress
        currentTime={playback.currentTime}
        duration={playback.duration}
        formatTime={playback.formatTime}
        onSeek={controls.onSeek}
        disabled={playback.isBusy || playback.isLocked}
      />
      <div className='flex items-center justify-between gap-3'>
        <TransportControls
          isPlaying={playback.isPlaying}
          isBusy={playback.isBusy}
          isLocked={playback.isLocked}
          onRestart={controls.onRestart}
          onPlayPause={controls.onPlayPause}
          onSkip={controls.onSkip}
        />
        <ReactionBar onReact={onReact} className='hidden @2xl:flex' />
        <div className='flex items-center gap-1'>
          <ReactionPopover onReact={onReact} className='@2xl:hidden' />
          <VolumeControl volume={playback.volume} onVolumeChange={controls.onVolumeChange} />
        </div>
      </div>
    </div>
  </div>
);

const CompactPlayer = ({ playback, controls, onReact }) => (
  <div className='relative z-10 space-y-2 p-3'>
    <div className='flex items-center gap-3'>
      <Artwork
        song={playback.song}
        isPlaying={playback.isPlaying}
        isSyncing={playback.isSyncing}
        className='h-12 w-12 rounded-lg'
        showOverlay={playback.isSyncing}
      />
      <div className='min-w-0 flex-1'>
        <TrackMeta song={playback.song} size='sm' />
      </div>
      <TransportControls
        size='sm'
        showRestart={false}
        isPlaying={playback.isPlaying}
        isBusy={playback.isBusy}
        isLocked={playback.isLocked}
        onPlayPause={controls.onPlayPause}
        onSkip={controls.onSkip}
      />
    </div>
    <PlaybackProgress
      currentTime={playback.currentTime}
      duration={playback.duration}
      formatTime={playback.formatTime}
      onSeek={controls.onSeek}
      disabled={playback.isBusy}
    />
    <ReactionBar onReact={onReact} className='justify-between' buttonClassName='h-7 w-9' />
  </div>
);

/**
 * Now-playing surface. `variant="full"` for tablet/desktop, `"compact"` for phones.
 *
 * playback: { song, isPlaying, isBusy, isLocked, isSyncing, syncCountdown, currentTime, duration, volume, formatTime }
 * controls: { onPlayPause, onSeek, onSkip, onRestart, onVolumeChange }
 */
const PlayerPanel = ({
  variant = 'full',
  playback,
  controls,
  queueItem,
  onReact,
  onFindSong,
  onPlayNow,
  onAddToQueue,
}) => {
  const quickPicks = useGroupSessionStore((s) => s.quickPickRecs);
  const compact = variant === 'compact';

  return (
    <Panel className='@container shrink-0' aria-label='Now playing'>
      <ArtworkBackdrop imageUrl={getSongImage(playback.song, 'large')} />
      {playback.song ? (
        <>
          <FloatingReactions />
          {compact ? (
            <CompactPlayer playback={playback} controls={controls} onReact={onReact} />
          ) : (
            <FullPlayer
              playback={playback}
              controls={controls}
              queueItem={queueItem}
              onReact={onReact}
            />
          )}
        </>
      ) : (
        <EmptyPlayer
          compact={compact}
          quickPicks={quickPicks}
          onFindSong={onFindSong}
          onPlayNow={onPlayNow}
          onAddToQueue={onAddToQueue}
        />
      )}
    </Panel>
  );
};

export default memo(PlayerPanel);
