import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
const SONG_URL = import.meta.env.VITE_SONG_URL;
const withCredentials = { withCredentials: true };
/** Minutes behind UTC, so "late nights" and the weekly recap follow the listener's own clock. */
const tz = () => new Date().getTimezoneOffset();

export const personalKeys = {
  all: ['personal'],
  likedIds: () => [...personalKeys.all, 'likedIds'],
  liked: () => [...personalKeys.all, 'liked'],
  taste: () => [...personalKeys.all, 'taste'],
  shelves: () => [...personalKeys.all, 'shelves'],
  moods: () => [...personalKeys.all, 'moods'],
  mood: (key) => [...personalKeys.all, 'mood', key],
  blend: (userId) => [...personalKeys.all, 'blend', String(userId)],
  friendsNow: () => [...personalKeys.all, 'friendsNow'],
  recap: () => [...personalKeys.all, 'recap'],
};

export const fetchLikedIds = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/likes/ids`, withCredentials);
  return data?.data?.ids ?? [];
};

export const fetchLikedSongs = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/likes`, withCredentials);
  return data?.data?.songs ?? [];
};

export const likeSong = (song) =>
  axios.post(`${API_URL}/api/music/likes`, { songData: song }, withCredentials);

export const unlikeSong = (songId) =>
  axios.delete(`${API_URL}/api/music/likes/${encodeURIComponent(songId)}`, withCredentials);

export const fetchTaste = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/taste`, withCredentials);
  return data?.data;
};

export const saveTaste = async (taste) => {
  const { data } = await axios.put(`${API_URL}/api/music/taste`, taste, withCredentials);
  return data?.data;
};

export const searchArtists = async (query) => {
  if (!query?.trim()) return [];
  const { data } = await axios.get(
    `${SONG_URL}/search/artists?q=${encodeURIComponent(query.trim())}&n=8`
  );
  return (data?.data?.results ?? []).filter((artist) => artist?.id && artist?.name);
};

export const fetchShelves = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/shelves?tz=${tz()}`, withCredentials);
  return data?.data?.shelves ?? [];
};

export const fetchMoods = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/moods`);
  return data?.data?.moods ?? [];
};

export const fetchMoodStation = async (mood) => {
  const { data } = await axios.get(
    `${API_URL}/api/music/moods/${encodeURIComponent(mood)}`,
    withCredentials
  );
  return data?.data?.songs ?? [];
};

export const fetchBlend = async (userId) => {
  const { data } = await axios.get(
    `${API_URL}/api/music/blend/${encodeURIComponent(userId)}`,
    withCredentials
  );
  return data?.data;
};

export const fetchFriendsNow = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/friends/now`, withCredentials);
  return data?.data?.friends ?? [];
};

export const fetchRecap = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/recap?tz=${tz()}`, withCredentials);
  return data?.data;
};
