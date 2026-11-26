import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { playlistKeys } from '@/api/music/playlist';
import {
  fetchSavedRooms,
  forgetSavedRoom,
  keepRoom,
  saveRoomPlaylist,
  savedRoomsKey,
} from '@/api/rooms';

const errorOf = (error, fallback) => error?.response?.data?.error || fallback;

export const useSavedRooms = (enabled = true) =>
  useQuery({ queryKey: savedRoomsKey, queryFn: fetchSavedRooms, enabled, staleTime: 30_000 });

export const useKeepRoom = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: keepRoom,
    onSuccess: () => {
      toast.success('Room kept. Open it again from Rooms any time');
      void client.invalidateQueries({ queryKey: savedRoomsKey });
    },
    onError: (error) => toast.error(errorOf(error, "Couldn't keep the room")),
  });
};

export const useForgetSavedRoom = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: forgetSavedRoom,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: savedRoomsKey });
      const before = client.getQueryData(savedRoomsKey);
      client.setQueryData(savedRoomsKey, (rooms = []) => rooms.filter((r) => r.id !== id));
      return { before };
    },
    onError: (error, _id, context) => {
      client.setQueryData(savedRoomsKey, context?.before);
      toast.error(errorOf(error, "Couldn't remove the room"));
    },
    onSuccess: () => toast('No longer kept'),
    onSettled: () => void client.invalidateQueries({ queryKey: savedRoomsKey }),
  });
};

export const useSaveRoomPlaylist = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveRoomPlaylist,
    onSuccess: (data) => {
      toast.success(`Saved ${data?.songCount ?? ''} songs to “${data?.name ?? 'a playlist'}”`);
      void client.invalidateQueries({ queryKey: playlistKeys.lists() });
    },
    onError: (error) => toast.error(errorOf(error, "Couldn't save the playlist")),
  });
};
