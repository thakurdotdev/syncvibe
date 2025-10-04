import axios from 'axios';
import { toast } from 'sonner';

export const createPlaylist = async (name, description) => {
  if (!name) {
    return toast.error('Playlist name is required');
  }

  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/playlist/create`,
      { name, description },
      { withCredentials: true }
    );

    if (response.status === 201) {
      return toast.success('Playlist created');
    }
  } catch (error) {
    return toast.error('An error occurred. Please try again.');
  }
};

export const addSongToPlaylist = async (playlistId, songId, songData) => {
  if (!playlistId || !songId) {
    return toast.error('An error occurred. Please try again.');
  }

  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/playlist/add-song`,
      {
        playlistId: playlistId,
        songId: songId,
        songData: JSON.stringify(songData),
      },
      { withCredentials: true }
    );

    if (response.status === 201) {
      toast.success('Song added to playlist');
      return true;
    }
  } catch (error) {
    return toast.error(error.response?.data?.message || 'An error occurred.');
  }
};
