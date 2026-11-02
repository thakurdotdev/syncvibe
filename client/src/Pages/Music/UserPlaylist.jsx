import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlaylistCard } from './Cards';
import { useUserPlaylistsQuery } from '@/hooks/queries/usePlaylistQueries';
import {
  useCreatePlaylistMutation,
  useUpdatePlaylistMutation,
  useDeletePlaylistMutation,
} from '@/hooks/mutations/usePlaylistMutations';

const PlaylistDialog = ({ isOpen, onOpenChange, onSubmit, initialData, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (initialData?.id) {
      setFormData({
        id: initialData.id,
        name: initialData.name || '',
        description: initialData.description || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
      });
    }
  }, [initialData?.id, initialData?.name]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{initialData?.id ? 'Edit Playlist' : 'Create Playlist'}</DialogTitle>
          <DialogDescription>
            {initialData?.id
              ? 'Update your playlist details below.'
              : 'Give your new playlist a name and description.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 py-4'>
          <div className='space-y-2'>
            <label htmlFor='playlist-name' className='text-sm font-medium leading-none'>
              Playlist Name
            </label>
            <Input
              id='playlist-name'
              placeholder='e.g. Late Night Vibes'
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className='space-y-2'>
            <label htmlFor='playlist-desc' className='text-sm font-medium leading-none'>
              Description
            </label>
            <Textarea
              id='playlist-desc'
              placeholder='Add an optional description for this collection...'
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className='resize-none'
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={isLoading} className='w-full sm:w-auto'>
              {isLoading ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : initialData?.id ? (
                'Save Changes'
              ) : (
                'Create Playlist'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const UserPlaylist = ({ embedded = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: userPlaylist = [], isLoading: isDataLoading } = useUserPlaylistsQuery();
  const [sortBy, setSortBy] = useState('recent');
  const [playlistDialog, setPlaylistDialog] = useState({
    isOpen: false,
    data: null,
  });

  const createMutation = useCreatePlaylistMutation({
    onSuccess: () => {
      toast.success('Playlist created successfully!');
      setPlaylistDialog({ isOpen: false, data: null });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.message || 'An error occurred.');
    },
  });

  const updateMutation = useUpdatePlaylistMutation({
    onSuccess: () => {
      toast.success('Playlist updated successfully!');
      setPlaylistDialog({ isOpen: false, data: null });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.message || 'An error occurred.');
    },
  });

  const deleteMutation = useDeletePlaylistMutation({
    onSuccess: () => {
      toast.success('Playlist deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'An error occurred.');
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // The sidebar's "+" opens the create dialog through router state.
  useEffect(() => {
    if (location.state?.createPlaylist) {
      setPlaylistDialog({ isOpen: true, data: null });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const handlePlaylistSubmit = (formData) => {
    if (formData.id) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeletePlaylist = (playlistId) => {
    deleteMutation.mutate(playlistId);
  };

  const sorted = useMemo(() => {
    const list = [...userPlaylist];
    if (sortBy === 'name') return list.sort((x, y) => (x.name || '').localeCompare(y.name || ''));
    const time = (p) => new Date(p.lastAddedAt || p.updatedAt || p.createdAt || 0).getTime() || 0;
    return list.sort((x, y) => time(y) - time(x));
  }, [userPlaylist, sortBy]);

  const openCreate = () => setPlaylistDialog({ isOpen: true, data: null });

  return (
    <div className={embedded ? 'w-full' : 'mx-auto w-full max-w-350 p-4 md:p-6'}>
      {!embedded && <h1 className='mb-6 text-3xl font-bold'>Playlists</h1>}

      {!isDataLoading && userPlaylist.length > 1 && (
        <div className='mb-5 flex items-center justify-between gap-4'>
          <p className='text-sm text-muted-foreground'>{userPlaylist.length} playlists</p>
          <div
            role='radiogroup'
            aria-label='Sort playlists'
            className='flex rounded-full bg-muted p-0.5'
          >
            {[
              { key: 'recent', label: 'Recent' },
              { key: 'name', label: 'A–Z' },
            ].map((opt) => (
              <button
                key={opt.key}
                type='button'
                role='radio'
                aria-checked={sortBy === opt.key}
                onClick={() => setSortBy(opt.key)}
                className={cn(
                  'press h-7 rounded-full px-3 text-xs font-medium',
                  sortBy === opt.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className='grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-4 gap-y-6 md:gap-x-5'>
        <button type='button' onClick={openCreate} className='press group flex flex-col text-left'>
          <span className='grid aspect-square w-full place-items-center rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors group-hover:border-primary/60 group-hover:text-primary'>
            <span className='grid h-12 w-12 place-items-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground'>
              <Plus className='h-5 w-5' />
            </span>
          </span>
          <span className='mt-2.5 px-0.5 text-sm font-semibold'>New playlist</span>
          <span className='px-0.5 text-xs text-muted-foreground'>
            {userPlaylist.length === 0 && !isDataLoading
              ? 'Start your first one'
              : 'Name it, then add songs'}
          </span>
        </button>

        {isDataLoading
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i}>
                <Skeleton className='aspect-square w-full rounded-2xl' />
                <Skeleton className='mt-3 h-4 w-3/4' />
                <Skeleton className='mt-1.5 h-3 w-1/3' />
              </div>
            ))
          : sorted.map((playlist) => (
              <UserPlaylistCard
                key={playlist.id}
                playlist={playlist}
                onDelete={handleDeletePlaylist}
                onEdit={(p) => setPlaylistDialog({ isOpen: true, data: p })}
              />
            ))}
      </div>

      <PlaylistDialog
        isOpen={playlistDialog.isOpen}
        onOpenChange={(open) =>
          setPlaylistDialog({
            isOpen: open,
            data: open ? playlistDialog.data : null,
          })
        }
        onSubmit={handlePlaylistSubmit}
        initialData={playlistDialog.data}
        isLoading={isLoading}
      />
    </div>
  );
};

export default UserPlaylist;
