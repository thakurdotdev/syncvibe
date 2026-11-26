import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
const withCredentials = { withCredentials: true };

export const savedRoomsKey = ['rooms', 'saved'];

/** Rooms you keep: `[{ id, name, songCount, covers, regulars, regularCount, live, updatedAt }]`. */
export const fetchSavedRooms = async () => {
  const { data } = await axios.get(`${API_URL}/api/rooms/saved`, withCredentials);
  return data?.data ?? [];
};

export const keepRoom = async (groupId) => {
  const { data } = await axios.post(`${API_URL}/api/rooms/saved`, { groupId }, withCredentials);
  return data?.data;
};

export const forgetSavedRoom = async (id) => {
  await axios.delete(`${API_URL}/api/rooms/saved/${id}`, withCredentials);
};

/** What the room has played, as one of your playlists. */
export const saveRoomPlaylist = async (groupId) => {
  const { data } = await axios.post(
    `${API_URL}/api/rooms/${encodeURIComponent(groupId)}/playlist`,
    {},
    withCredentials
  );
  return data?.data;
};
