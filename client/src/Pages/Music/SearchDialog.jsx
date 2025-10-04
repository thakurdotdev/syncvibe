import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, XCircle } from 'lucide-react';
import axios from 'axios';
import { AlbumCard, ArtistCard, PlaylistCard, SongCard } from './Cards';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const SearchDialog = ({ open, setOpen }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/search?q=${query}`);

      if (response.status === 200) {
        setSearchResults(response.data?.data);
      }
    } catch (error) {
      console.error('Error fetching search data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchData]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearchQuery('');
    setSearchResults(null);
  }, [setOpen]);

  const ResultsGrid = ({ title, items, renderItem }) => {
    if (!items?.data?.length) return null;

    return (
      <section className='mb-6'>
        <h2 className='text-lg font-medium mb-4'>{title}</h2>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {items.data.map((item, index) => (
            <div key={item.id || index}>{renderItem(item)}</div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        closeButton={false}
        className='sm:max-w-6xl p-0 overflow-hidden max-sm:h-screen max-sm:w-full'
      >
        <div className='sticky max-sm:top-5 z-10 bg-background px-4 py-3 border-b flex justify-between h-20'>
          <div className='relative flex items-center sm:w-[95%]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
            <Input
              placeholder='Search music...'
              className='pl-9 pr-10 border-none bg-secondary/40 focus:bg-secondary/60 rounded-full focus-visible:ring-0 focus-visible:ring-ring focus-visible:ring-offset-0'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground 
                         hover:text-primary transition-colors'
              >
                <XCircle className='w-4 h-4' />
              </button>
            )}
          </div>
          <Button
            size='icon'
            variant='ghost'
            className='h-10 w-10 rounded-full absolute top-5 right-2'
            onClick={handleClose}
          >
            <X className='w-12 h-12' />
          </Button>
        </div>

        <ScrollArea className='sm:h-[70vh]'>
          <div className='p-4'>
            {isLoading ? (
              <div className='flex items-center justify-center h-40'>
                <Loader2 className='w-6 h-6 animate-spin text-primary' />
              </div>
            ) : searchResults ? (
              <div className='space-y-6'>
                <ResultsGrid
                  title='Songs'
                  items={searchResults.songs}
                  renderItem={(song) => <SongCard song={song} />}
                />

                {searchResults?.artists?.data?.length > 0 && (
                  <section className='mb-6'>
                    <h2 className='text-lg font-medium mb-4'>Artists</h2>
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                      {searchResults?.artists?.data?.map((artist, index) => (
                        <div key={artist.id || index} onClick={handleClose}>
                          <ArtistCard artist={artist} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {searchResults?.albums?.data?.length > 0 && (
                  <section className='mb-6'>
                    <h2 className='text-lg font-medium mb-4'>Albums</h2>
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                      {searchResults?.albums?.data?.map((album, index) => (
                        <div key={album.id || index} onClick={handleClose}>
                          <AlbumCard album={album} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {searchResults?.playlists?.data?.length > 0 && (
                  <section className='mb-6'>
                    <h2 className='text-lg font-medium mb-4'>Playlists</h2>
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                      {searchResults?.playlists?.data?.map((playlist, index) => (
                        <div key={playlist.id || index} onClick={handleClose}>
                          <PlaylistCard playlist={playlist} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center text-muted-foreground h-[50vh]'>
                <Search className='w-16 h-16 mb-6 animate-pulse' />
                <p className='text-lg font-medium mb-2'>Start typing to search</p>
                <p className='text-sm'>Find your favorite songs, artists, and albums</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
