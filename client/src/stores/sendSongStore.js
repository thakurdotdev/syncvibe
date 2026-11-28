import { create } from 'zustand';

/** The song a "Send in a chat" menu item picked, for the one dialog that sends it. */
export const useSendSongStore = create(() => ({ song: null }));

export const openSendSong = (song) => useSendSongStore.setState({ song });
export const closeSendSong = () => useSendSongStore.setState({ song: null });
