import { getAudioElement, usePlayerStore } from '@/stores/playerStore';
import { getRoomAudioElement, useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { ownsAudio } from '@/lib/player';

/** Seconds into your own song: this tab's audio, or the playing device's while another plays. */
export const ownPosition = () => {
  const audio = getAudioElement();
  return ownsAudio() && audio ? audio.currentTime : usePlayerStore.getState().currentTime || 0;
};

export const seekOwn = (seconds) => usePlayerStore.getState().handleTimeSeek(seconds);

/** Seconds into the room's song as this tab plays it (kept with the room by roomSync). */
export const roomPosition = () =>
  getRoomAudioElement()?.currentTime ?? useGroupPlaybackStore.getState().currentTime ?? 0;
