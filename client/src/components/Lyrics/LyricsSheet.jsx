import { memo } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/revola';
import LyricsView from './LyricsView';

/**
 * The whole song's lyrics, for reading along: a sheet on phones, a dialog on wider screens.
 * Opened from the lines under the cover. getPosition: () => seconds, as you hear the song.
 */
const LyricsSheet = ({ open, onOpenChange, songId, nextSongId, songName, getPosition, onSeek }) => (
  <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
    <ResponsiveDialogContent className='p-0 sm:max-w-[520px]'>
      <ResponsiveDialogHeader className='px-6 pt-5 pb-1 text-left sm:px-7 sm:pt-6'>
        <ResponsiveDialogTitle>Lyrics</ResponsiveDialogTitle>
        <ResponsiveDialogDescription className='truncate'>{songName}</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className='h-[min(68vh,560px)] px-5 sm:px-6'>
        <LyricsView
          songId={songId}
          nextSongId={nextSongId}
          getPosition={getPosition}
          onSeek={onSeek}
          active={open}
          size='medium'
        />
      </div>
    </ResponsiveDialogContent>
  </ResponsiveDialog>
);

export default memo(LyricsSheet);
