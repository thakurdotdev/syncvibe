import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

/** Never recommend this song (or other versions of it) to me again. */
export const dislikeSong = async (song) => {
  await axios.post(`${API_URL}/api/music/dislikes`, { songData: song }, { withCredentials: true });
};

export const undoDislikeSong = async (songId) => {
  await axios.delete(`${API_URL}/api/music/dislikes/${encodeURIComponent(songId)}`, {
    withCredentials: true,
  });
};

/** "Not this artist": their songs leave every suggestion, on every device. */
export const dislikeArtist = async (artist) => {
  await axios.post(
    `${API_URL}/api/music/dislikes-artists`,
    { artistId: artist.id, name: artist.name },
    { withCredentials: true }
  );
};

export const undoDislikeArtist = async (artistId) => {
  await axios.delete(`${API_URL}/api/music/dislikes-artists/${encodeURIComponent(artistId)}`, {
    withCredentials: true,
  });
};
