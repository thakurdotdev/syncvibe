import {
  forgetSavedRoom,
  getSavedRooms,
  keepRoom,
  saveRoomPlaylist,
  type SavedRoom,
} from '@/api/rooms';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import { usePlayerStore } from '@/stores/playerStore';
import { api } from '@/utils/hooks/useApi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const savedRoomsKey = ['rooms', 'saved'] as const;

const errorOf = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export const useSavedRooms = () => {
  const { user } = useUser();
  return useQuery({
    queryKey: savedRoomsKey,
    queryFn: getSavedRooms,
    enabled: Boolean(user?.userid),
    staleTime: 30_000,
  });
};

export const useKeepRoom = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: keepRoom,
    onSuccess: () => {
      toast('Room kept. Open it again from Rooms any time', { type: 'success' });
      void client.invalidateQueries({ queryKey: savedRoomsKey });
    },
    onError: (error) => toast(errorOf(error, "Couldn't keep the room"), { type: 'error' }),
  });
};

export const useForgetSavedRoom = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: forgetSavedRoom,
    onMutate: async (id: number) => {
      await client.cancelQueries({ queryKey: savedRoomsKey });
      const before = client.getQueryData<SavedRoom[]>(savedRoomsKey);
      client.setQueryData<SavedRoom[]>(savedRoomsKey, (rooms = []) =>
        rooms.filter((r) => r.id !== id)
      );
      return { before };
    },
    onError: (error, _id, context) => {
      client.setQueryData(savedRoomsKey, context?.before);
      toast(errorOf(error, "Couldn't remove the room"), { type: 'error' });
    },
    onSuccess: () => toast('No longer kept'),
    onSettled: () => void client.invalidateQueries({ queryKey: savedRoomsKey }),
  });
};

export const useSaveRoomPlaylist = () =>
  useMutation({
    mutationFn: saveRoomPlaylist,
    onSuccess: (data) => {
      toast(`Saved ${data?.songCount ?? ''} songs to “${data?.name ?? 'a playlist'}”`, {
        type: 'success',
      });
      // Your playlists live in the player store, loaded once; fetch them again to show this one.
      api
        .get('/api/playlist/get')
        .then(({ data: list }) => {
          if (list?.data) usePlayerStore.getState().setUserPlaylist(list.data);
        })
        .catch(() => {});
    },
    onError: (error) => toast(errorOf(error, "Couldn't save the playlist"), { type: 'error' }),
  });
