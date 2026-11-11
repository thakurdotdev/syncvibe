import { useContext, useEffect, useRef } from 'react';
import { Context } from './Context';
import { usePlayerStore } from '@/stores/playerStore';
import { recordPageClosing, recordPlayEnd, setPlayEventsEnabled } from '@/stores/playEvents';
import { useUserPlaylistsQuery } from '@/hooks/queries/usePlaylistQueries';
import { ownsAudio, reportPosition } from '@/lib/player';

export function PlayerProvider({ children }) {
  const { user, loading } = useContext(Context);
  const audioRef = useRef(null);
  const nextAudioRef = useRef(null);
  const prevSongIdRef = useRef(null);
  const lastUpdateTime = useRef(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);
  const MAX_RETRIES = 3;

  const setAudioRefs = usePlayerStore((s) => s.setAudioRefs);
  const loadAndPlayCurrentSong = usePlayerStore((s) => s.loadAndPlayCurrentSong);
  const handleNextSong = usePlayerStore((s) => s.handleNextSong);
  const updateTime = usePlayerStore((s) => s.updateTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setLoading = usePlayerStore((s) => s.setLoading);
  const setUserPlaylist = usePlayerStore((s) => s.setUserPlaylist);
  const decrementSongsRemaining = usePlayerStore((s) => s.decrementSongsRemaining);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const volume = usePlayerStore((s) => s.volume);

  const { data: userPlaylists } = useUserPlaylistsQuery({
    enabled: !!user && !loading,
  });

  useEffect(() => {
    if (userPlaylists) {
      setUserPlaylist(userPlaylists);
    }
  }, [userPlaylists, setUserPlaylist]);

  useEffect(() => {
    if (!loading) setPlayEventsEnabled(!!user);
  }, [user, loading]);

  useEffect(() => {
    window.addEventListener('pagehide', recordPageClosing);
    return () => window.removeEventListener('pagehide', recordPageClosing);
  }, []);

  useEffect(() => {
    if (audioRef.current && nextAudioRef.current) {
      setAudioRefs(audioRef.current, nextAudioRef.current);
    }
  }, [setAudioRefs]);

  useEffect(() => {
    retryCountRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [currentSong?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!ownsAudio()) return;
      const now = Date.now();
      if (now - lastUpdateTime.current > 500) {
        updateTime(audio.currentTime);
        lastUpdateTime.current = now;
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      audio.volume = volume;
    };

    const handleEnded = () => {
      if (!ownsAudio()) return;
      handleNextSong(true);
    };

    const handleError = () => {
      if (!audio.src || audio.src === window.location.href || !ownsAudio()) return;

      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        const delay = Math.pow(2, retryCountRef.current) * 500;
        console.warn(
          `Audio error, retrying (${retryCountRef.current}/${MAX_RETRIES}) in ${delay}ms`
        );
        setLoading(true);

        const savedTime = audio.currentTime || 0;
        const savedSrc = audio.src;

        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          audio.src = savedSrc;
          audio.load();

          const onCanPlayRetry = () => {
            audio.removeEventListener('canplay', onCanPlayRetry);
            if (savedTime > 0) {
              audio.currentTime = savedTime;
            }
            audio.play().catch(() => {
              setPlaying(false);
              setLoading(false);
            });
          };
          audio.addEventListener('canplay', onCanPlayRetry);
        }, delay);
      } else {
        console.error(`Audio failed after ${MAX_RETRIES} retries`);
        recordPlayEnd('error');
        setPlaying(false);
        setLoading(false);
      }
    };

    // While another of your devices plays, this one's audio is silent and the store shows that
    // device's progress, so the audio element's own events must not overwrite it.
    const handlePause = () => {
      if (!ownsAudio()) return;
      if (!audio.ended) {
        setPlaying(false);
        // Also catches a pause from the keyboard or the system's media controls.
        reportPosition();
      }
    };

    const handlePlaying = () => {
      if (!ownsAudio()) return;
      retryCountRef.current = 0;
      setPlaying(true);
      setLoading(false);
      reportPosition();
    };

    const handleWaiting = () => {
      if (ownsAudio()) setLoading(true);
    };

    const handleCanPlay = () => {
      if (ownsAudio()) setLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [handleNextSong, volume, updateTime, setDuration, setPlaying, setLoading]);

  useEffect(() => {
    const loadSong = async () => {
      prevSongIdRef.current = await loadAndPlayCurrentSong(prevSongIdRef.current);
    };
    loadSong();
  }, [currentSong, loadAndPlayCurrentSong]);

  useEffect(() => {
    if (currentSong) {
      decrementSongsRemaining();
    }
  }, [currentSong?.id, decrementSongsRemaining]);

  useEffect(() => {
    const saveTimeOnUnload = () => {
      const time = audioRef.current?.currentTime;
      if (time > 0) {
        localStorage.setItem('player-time', String(time));
      }
    };
    window.addEventListener('beforeunload', saveTimeOnUnload);
    return () => window.removeEventListener('beforeunload', saveTimeOnUnload);
  }, []);

  return (
    <>
      {children}
      <audio ref={audioRef} preload='auto' />
      <audio ref={nextAudioRef} preload='auto' style={{ display: 'none' }} />
    </>
  );
}
