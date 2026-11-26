import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
const NONE = { kind: 'none' };

export const lyricsKey = (songId) => ['lyrics', songId];

/** `{ kind: 'synced', lines: [{ t, text }] } | { kind: 'plain', text } | { kind: 'none' }`. */
export const fetchLyrics = async (songId) => {
  const { data } = await axios.get(`${API_URL}/api/music/lyrics/${encodeURIComponent(songId)}`, {
    withCredentials: true,
  });
  return data?.data ?? NONE;
};

/** Says these are another song's lyrics; the server looks again and answers with what it found. */
export const reportLyrics = async (songId) => {
  const { data } = await axios.post(
    `${API_URL}/api/music/lyrics/${encodeURIComponent(songId)}/report`,
    {},
    { withCredentials: true }
  );
  return data?.data ?? NONE;
};
