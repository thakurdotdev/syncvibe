/**
 * Single source of truth for in-app URLs. Use these builders instead of
 * hard-coding strings so a route rename only touches this file and Routes.jsx.
 */
export const paths = {
  home: '/home',
  rooms: '/rooms',
  messages: '/messages',
  library: '/library',
  history: '/library/history',
  myPlaylist: (id) => `/library/playlist/${id}`,
  playlist: (id) => `/playlist/${id}`,
  album: (id) => `/album/${id}`,
  artist: (id) => `/artist/${id}`,
  user: (username) => `/u/${username}`,
  profile: '/profile',
  languages: '/settings/languages',
  billing: '/settings/billing',
  plans: '/plans',
};

/** Builds the URL for a catalog item (`song.type` is 'album' | 'playlist' | 'artist' | 'song'). */
export const catalogPath = (type, id) => {
  if (type === 'album') return paths.album(id);
  if (type === 'artist') return paths.artist(id);
  if (type === 'playlist') return paths.playlist(id);
  return paths.album(id);
};
