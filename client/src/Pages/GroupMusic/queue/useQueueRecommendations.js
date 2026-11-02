import { fetchGroupHistory, fetchHistory } from '@/api/music/history';
import { fetchHomepageModules } from '@/api/music/homepage';
import { fetchSongRecommendations } from '@/api/music/songs';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const MAX_RECOMMENDATIONS = 15;
const FALLBACK_KEY = 'fallback';

const setRecommendations = (updater) =>
  useGroupSessionStore.setState((s) => ({
    quickPickRecs: typeof updater === 'function' ? updater(s.quickPickRecs) : updater,
  }));

const excludeQueued = (songs, queue) => {
  const queuedIds = new Set(queue.map((item) => item.song?.id));
  return (songs || []).filter((song) => !queuedIds.has(song.id)).slice(0, MAX_RECOMMENDATIONS);
};

/** Tries group history → personal history → trending, returning the first non-empty source. */
const loadFallbackSource = async (userId) => {
  if (userId) {
    const groupHistory = await fetchGroupHistory(userId);
    const lastGroupSong = groupHistory?.[groupHistory.length - 1]?.songData;
    if (lastGroupSong?.id) {
      const songs = await fetchSongRecommendations(lastGroupSong.id);
      if (songs?.length) return { songs, label: `Last session: ${lastGroupSong.name}` };
    }
  }

  const history = await fetchHistory({ limit: 5 });
  const lastSong = history?.[0]?.songData || history?.[0];
  if (lastSong?.id) {
    const songs = await fetchSongRecommendations(lastSong.id);
    if (songs?.length) return { songs, label: `From your history: ${lastSong.name}` };
  }

  const modules = await fetchHomepageModules();
  if (modules?.trending?.length) return { songs: modules.trending, label: 'Trending now' };

  return null;
};

/**
 * Recommendations shown in the "For you" tab and the empty player's quick picks.
 * Follows the current song unless the user pinned them to a specific queue item.
 */
export const useQueueRecommendations = ({ queue, currentSongId, userId }) => {
  const recommendations = useGroupSessionStore((s) => s.quickPickRecs);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('');
  const [pinnedSongId, setPinnedSongId] = useState(null);
  const queueRef = useRef(queue);
  const lastSourceRef = useRef(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const run = useCallback(async (sourceKey, force, load) => {
    if (!force && lastSourceRef.current === sourceKey) return;
    lastSourceRef.current = sourceKey;
    setIsLoading(true);
    try {
      const result = await load();
      if (!result) return;
      setSourceLabel(result.label);
      setRecommendations(excludeQueued(result.songs, queueRef.current));
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      toast.error('Could not load recommendations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadForSong = useCallback(
    (songId, force = false) =>
      run(songId, force, async () => {
        const source = queueRef.current.find((item) => item.song?.id === songId);
        return { songs: await fetchSongRecommendations(songId), label: source?.song?.name || '' };
      }),
    [run]
  );

  const loadFallback = useCallback(
    (force = false) => run(FALLBACK_KEY, force, () => loadFallbackSource(userId)),
    [run, userId]
  );

  // Follow the current song (or fall back) unless pinned.
  useEffect(() => {
    if (pinnedSongId) return;
    if (currentSongId) loadForSong(currentSongId);
    else loadFallback();
  }, [currentSongId, pinnedSongId, loadForSong, loadFallback]);

  // A cleared queue releases the pin.
  if (pinnedSongId && queue.length === 0) setPinnedSongId(null);

  const pinToSong = useCallback(
    (songId) => {
      if (!songId) return;
      setPinnedSongId(songId);
      loadForSong(songId, true);
    },
    [loadForSong]
  );

  const refresh = useCallback(() => {
    const songId = pinnedSongId || currentSongId;
    if (songId) loadForSong(songId, true);
    else loadFallback(true);
  }, [pinnedSongId, currentSongId, loadForSong, loadFallback]);

  const dismiss = useCallback((songId) => {
    setRecommendations((prev) => prev.filter((song) => song.id !== songId));
  }, []);

  return { recommendations, isLoading, sourceLabel, refresh, pinToSong, dismiss };
};
