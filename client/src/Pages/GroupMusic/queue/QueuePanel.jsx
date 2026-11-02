import { useProfile } from '@/Context/Context';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import AddToPlaylist from '@/Pages/Music/AddToPlaylist';
import { AnimatePresence } from 'framer-motion';
import { Library, ListMusic, Sparkles } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { Panel, PanelBody, PanelHeader } from '../components/Panel';
import PanelTabs from '../components/PanelTabs';
import { QUEUE_TABS, useRoomUi } from '../hooks/useRoomUi';
import AutoplayToggle from './AutoplayToggle';
import Discovery from './Discovery';
import PlaylistBrowser from './PlaylistBrowser';
import QueueList from './QueueList';
import QueueSearchField from './QueueSearchField';
import SearchResults from './SearchResults';
import { useQueueRecommendations } from './useQueueRecommendations';
import { useQueueSearch } from './useQueueSearch';

const TAB_ID_PREFIX = 'group-queue';

/**
 * Queue, search, playlists and recommendations in one panel.
 * The header stays fixed; only the body scrolls.
 */
const QueuePanel = ({ className, bare = false }) => {
  const { user } = useProfile();
  const {
    queue,
    currentQueueItem,
    upcomingQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    playNow,
    playNext,
    addToQueue,
    addPlaylistToQueue,
    toggleAutoRecommendations,
    autoPlayRecommendations,
  } = useGroupMusic();

  const activeTab = useRoomUi((s) => s.queueTab);
  const setQueueTab = useRoomUi((s) => s.setQueueTab);
  const searchFocusRequest = useRoomUi((s) => s.searchFocusRequest);

  const [songToSave, setSongToSave] = useState(null);

  const search = useQueueSearch();
  const recs = useQueueRecommendations({
    queue,
    currentSongId: currentQueueItem?.song?.id,
    userId: user?.userid,
  });

  const tabs = useMemo(
    () => [
      { value: QUEUE_TABS.upNext, label: 'Up next', icon: ListMusic, count: upcomingQueue.length },
      { value: QUEUE_TABS.playlists, label: 'Playlists', icon: Library },
      { value: QUEUE_TABS.forYou, label: 'For you', icon: Sparkles },
    ],
    [upcomingQueue.length]
  );

  const clearSearch = search.clear;
  const handleTabChange = useCallback(
    (tab) => {
      setQueueTab(tab);
      clearSearch();
    },
    [setQueueTab, clearSearch]
  );

  const { dismiss: dismissRec, pinToSong } = recs;
  const handleAddToQueue = useCallback(
    (song) => {
      addToQueue(song);
      dismissRec(song.id);
    },
    [addToQueue, dismissRec]
  );

  const handleShowRecsFor = useCallback(
    (songId) => {
      setQueueTab(QUEUE_TABS.forYou);
      pinToSong(songId);
    },
    [setQueueTab, pinToSong]
  );

  const renderBody = () => {
    if (search.isSearching) {
      return (
        <SearchResults
          searchQuery={search.searchQuery}
          searchResults={search.searchResults}
          isSearchLoading={search.isSearchLoading}
          onPlayNow={playNow}
          onAddToQueue={handleAddToQueue}
          onPlayNext={playNext}
          onSaveToPlaylist={setSongToSave}
        />
      );
    }

    switch (activeTab) {
      case QUEUE_TABS.playlists:
        return (
          <PlaylistBrowser
            onPlayNow={playNow}
            onPlayNext={playNext}
            onAddToQueue={handleAddToQueue}
            onAddAll={addPlaylistToQueue}
          />
        );
      case QUEUE_TABS.forYou:
        return (
          <Discovery
            userId={user?.userid}
            recommendations={recs.recommendations}
            recsLoading={recs.isLoading}
            recsSourceName={recs.sourceLabel}
            onAddToQueue={handleAddToQueue}
            playNow={playNow}
            playNext={playNext}
            onSaveToPlaylist={setSongToSave}
            onRefresh={recs.refresh}
            queue={queue}
          />
        );
      default:
        return (
          <QueueList
            queue={queue}
            currentQueueItem={currentQueueItem}
            upcomingQueue={upcomingQueue}
            removeFromQueue={removeFromQueue}
            reorderQueue={reorderQueue}
            clearQueue={clearQueue}
            autoPlayRecommendations={autoPlayRecommendations}
            onFetchRecs={handleShowRecsFor}
            onSaveToPlaylist={setSongToSave}
            hideNowPlaying
          />
        );
    }
  };

  const content = (
    <>
      <PanelHeader className='space-y-2.5'>
        <div className='flex items-center justify-between gap-2'>
          <PanelTabs
            tabs={tabs}
            value={search.isSearching ? null : activeTab}
            onChange={handleTabChange}
            idPrefix={TAB_ID_PREFIX}
            className='min-w-0 overflow-x-auto'
          />
          <AutoplayToggle enabled={autoPlayRecommendations} onToggle={toggleAutoRecommendations} />
        </div>
        <QueueSearchField
          value={search.searchQuery}
          isLoading={search.isSearchLoading}
          focusRequest={searchFocusRequest}
          onChange={search.handleChange}
          onClear={search.clear}
        />
      </PanelHeader>

      <PanelBody
        id={`${TAB_ID_PREFIX}-panel-${activeTab}`}
        role='tabpanel'
        aria-labelledby={`${TAB_ID_PREFIX}-tab-${activeTab}`}
      >
        <AnimatePresence mode='popLayout'>{renderBody()}</AnimatePresence>
      </PanelBody>

      <AddToPlaylist
        dialogOpen={Boolean(songToSave)}
        setDialogOpen={(open) => !open && setSongToSave(null)}
        song={songToSave}
      />
    </>
  );

  if (bare) return <div className={className ?? 'flex min-h-0 flex-1 flex-col'}>{content}</div>;
  return (
    <Panel className={className} aria-label='Queue'>
      {content}
    </Panel>
  );
};

export default memo(QueuePanel);
