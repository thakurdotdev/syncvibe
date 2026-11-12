import { memo, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useSongRecommendationsQuery } from '@/hooks/queries/useSongQueries';
import { useShellLayout } from '@/components/shell/useShellLayout';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useRemoteDevice } from '@/stores/playerSessionStore';
import { useUiStore } from '@/stores/uiStore';
import AddToPlaylist from '../AddToPlaylist';
import PlayerSheet from './PlayerSheet';

const BottomPlayer = () => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const playlist = usePlayerStore((s) => s.playlist);
  const addRecommendations = usePlayerStore((s) => s.addRecommendations);
  // Another of your devices is playing: it picks the next songs, not this one.
  const remoteDevice = useRemoteDevice();
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations);
  const isSoloPlaying = usePlayerStore((s) => s.isPlaying);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const isGroupPlaying = useGroupPlaybackStore((s) => s.isPlaying);
  const isInGroup = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const { pathname } = useLocation();
  // The group room has its own player; its sheet stays closed there.
  const isHiddenByGroupRoom = isInGroup && pathname.startsWith('/rooms');

  useEffect(() => {
    if (isGroupPlaying && isSoloPlaying) {
      handlePlayPause();
    }
  }, [isGroupPlaying, isSoloPlaying, handlePlayPause]);

  const { isMobile } = useShellLayout();

  // Space and arrow keys on desktop. Phones have the deck's orb instead.
  useEffect(() => {
    if (isMobile) return undefined;
    const onKeyDown = (e) => {
      if (useGroupSessionStore.getState().currentGroup) return;
      const el = document.activeElement;
      if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) {
        return;
      }
      const player = usePlayerStore.getState();
      if (!player.currentSong) return;
      if (e.key === ' ') {
        e.preventDefault();
        player.handlePlayPause();
      } else if (e.key === 'ArrowRight') player.handleNextSong();
      else if (e.key === 'ArrowLeft') player.handlePrevSong();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const isSheetOpen = useUiStore((s) => s.playerSheetOpen);
  const setIsSheetOpen = useUiStore((s) => s.setPlayerSheetOpen);
  const lastFetchedForId = useRef(null);

  const currentIndex = playlist.findIndex((song) => song.id === currentSong?.id);
  const needsRecommendations = currentIndex === -1 || currentIndex >= playlist.length - 2;
  const shouldFetch =
    !remoteDevice &&
    autoFetchRecommendations &&
    !!currentSong?.id &&
    needsRecommendations &&
    lastFetchedForId.current !== currentSong?.id;

  const { data: recommendations = [], isLoading: loading } = useSongRecommendationsQuery(
    currentSong?.id,
    { enabled: shouldFetch }
  );

  useEffect(() => {
    if (recommendations.length > 0 && shouldFetch) {
      lastFetchedForId.current = currentSong?.id;
      addRecommendations(recommendations, currentSong?.id);
    }
  }, [recommendations, shouldFetch, currentSong?.id, addRecommendations]);

  // Playback shows in the phone deck's orb and in the sidebar; this keeps only the full player.
  if (!currentSong || isHiddenByGroupRoom) return null;

  return (
    <>
      {/* Full-Screen Player Sheet */}
      <PlayerSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        currentSong={currentSong}
        loading={loading}
        recommendations={recommendations}
        onOpenModal={() => setIsModalOpen(true)}
      />

      {/* Add To Playlist Dialog */}
      <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={currentSong} />
    </>
  );
};

export default memo(BottomPlayer);
