import { useQuery } from '@tanstack/react-query';
import he from 'he';
import { ChevronRight, Loader2, Play, Radio, Sparkles, Users } from 'lucide-react';
import { memo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  fetchFriendsNow,
  fetchMoods,
  fetchMoodStation,
  fetchRecap,
  fetchShelves,
  personalKeys,
} from '@/api/music/personal';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { paths } from '@/lib/paths';
import { playSongs } from '@/lib/playSongs';
import { getSongImage } from '@/Pages/GroupMusic/utils/song';
import { NewSongCard } from './Cards';
import { ScrollableRow, Section } from './HomeSections';

const PlayAllButton = ({ songs, label }) => (
  <Button
    type='button'
    size='sm'
    variant='secondary'
    className='h-8 shrink-0 gap-1.5 rounded-full px-3'
    aria-label={`Play ${label}`}
    onClick={() => playSongs(songs)}
  >
    <Play className='h-3.5 w-3.5' fill='currentColor' />
    Play
  </Button>
);

/** A row of songs that plays as one list: tapping a song plays the row from there. */
export const SongShelf = memo(function SongShelf({ title, subtitle, songs, reasons }) {
  if (!songs?.length) return null;
  return (
    <Section
      title={title}
      subtitle={subtitle}
      action={<PlayAllButton songs={songs} label={title} />}
    >
      <ScrollableRow>
        {songs.map((song, index) => (
          <NewSongCard
            key={song.id}
            song={song}
            reason={reasons?.[song.id]}
            onPlay={() => playSongs(songs, index)}
          />
        ))}
      </ScrollableRow>
    </Section>
  );
});

/** Daily Mixes, your time of day, new releases, rediscover and liked songs. */
export const PersonalShelves = () => {
  const { data: shelves = [] } = useQuery({
    queryKey: personalKeys.shelves(),
    queryFn: fetchShelves,
    staleTime: 1000 * 60 * 15,
  });
  return shelves.map((shelf) => (
    <SongShelf
      key={shelf.key}
      title={shelf.title}
      subtitle={shelf.subtitle}
      songs={shelf.songs}
      reasons={shelf.reasons}
    />
  ));
};

/** One chip per mood. A tap plays that mood's station, picked for you. */
export const MoodChips = () => {
  const { data: moods = [] } = useQuery({
    queryKey: personalKeys.moods(),
    queryFn: fetchMoods,
    staleTime: Infinity,
  });
  const [loading, setLoading] = useState(null);

  const play = async (mood) => {
    setLoading(mood.key);
    try {
      const songs = await fetchMoodStation(mood.key);
      if (!playSongs(songs)) toast.info(`Nothing in ${mood.title} yet`);
    } catch {
      toast.error(`Couldn't load ${mood.title}. Try again.`);
    } finally {
      setLoading(null);
    }
  };

  if (!moods.length) return null;
  return (
    <Section title='Moods'>
      <div className='row-scroll -mx-2 flex gap-2 overflow-x-auto px-2 pb-1'>
        {moods.map((mood) => (
          <button
            key={mood.key}
            type='button'
            onClick={() => play(mood)}
            disabled={loading === mood.key}
            aria-label={`Play ${mood.title} station`}
            className='press flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent disabled:opacity-70'
          >
            {loading === mood.key ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            ) : (
              <Radio className='h-3.5 w-3.5 text-muted-foreground' />
            )}
            {mood.title}
          </button>
        ))}
      </div>
    </Section>
  );
};

const FriendCard = memo(function FriendCard({ friend }) {
  const navigate = useNavigate();
  const { joinGroup } = useGroupMusic();
  const { user, song, room } = friend;
  const title = song ? he.decode(song.name || '') : room?.name;
  const art = song ? getSongImage(song, 'medium') : '';

  const act = () => {
    if (room) {
      joinGroup(room.id);
      navigate(paths.rooms);
    } else if (song) {
      playSongs([song]);
    }
  };

  return (
    <div className='flex w-[260px] shrink-0 items-center gap-3 rounded-2xl border border-border bg-card p-2.5'>
      <div className='relative shrink-0'>
        <span className='grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-raised'>
          {art ? (
            <img src={art} alt='' className='h-full w-full object-cover' />
          ) : (
            <Users className='h-5 w-5 text-muted-foreground' />
          )}
        </span>
        <Avatar className='absolute -bottom-1.5 -right-1.5 h-6 w-6 border-2 border-card'>
          <AvatarImage src={user.profilepic} alt='' />
          <AvatarFallback className='text-[10px]'>{user.name?.[0]}</AvatarFallback>
        </Avatar>
      </div>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold'>{user.name}</p>
        <p className='truncate text-xs text-muted-foreground'>{room ? `In ${room.name}` : title}</p>
      </div>
      <Button
        type='button'
        size='sm'
        variant={room ? 'default' : 'secondary'}
        className='h-8 shrink-0 rounded-full px-3'
        onClick={act}
        aria-label={room ? `Join ${user.name} in ${room.name}` : `Play ${title}`}
      >
        {room ? 'Join' : 'Play'}
      </Button>
    </div>
  );
});

/** Friends who follow you back, and what they're playing right now. */
export const FriendsNow = () => {
  const { data: friends = [] } = useQuery({
    queryKey: personalKeys.friendsNow(),
    queryFn: fetchFriendsNow,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
  if (!friends.length) return null;
  return (
    <Section title='Friends listening now'>
      <ScrollableRow>
        {friends.map((friend) => (
          <FriendCard key={friend.user.userid} friend={friend} />
        ))}
      </ScrollableRow>
    </Section>
  );
};

/** A way into this week's recap, with the headline number. */
export const WeekCard = () => {
  const { data: recap } = useQuery({
    queryKey: personalKeys.recap(),
    queryFn: fetchRecap,
    staleTime: 1000 * 60 * 30,
  });
  if (!recap?.minutes) return null;
  return (
    <Link
      to={paths.recap}
      className='press group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-accent'
    >
      <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-raised'>
        <Sparkles className='h-[18px] w-[18px]' />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold'>Your week in music</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {recap.minutes} minutes
          {recap.topArtists?.[0] ? ` · mostly ${recap.topArtists[0].name}` : ''}
        </span>
      </span>
      <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
    </Link>
  );
};
