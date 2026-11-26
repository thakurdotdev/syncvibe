import { MessageCircle, MicVocal, Users } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Panel, PanelHeader } from '../components/Panel';
import PanelTabs, { TabPanel } from '../components/PanelTabs';
import { SIDEBAR_TABS, useRoomUi } from '../hooks/useRoomUi';

const ID_PREFIX = 'room-sidebar';

/** Desktop right rail: chat (default), lyrics and people, always full height. */
const RoomSidebar = ({ chat, lyrics, people, unreadCount, memberCount }) => {
  const activeTab = useRoomUi((s) => s.sidebarTab);
  const setSidebarTab = useRoomUi((s) => s.setSidebarTab);

  const tabs = useMemo(
    () => [
      { value: SIDEBAR_TABS.chat, label: 'Chat', icon: MessageCircle, alert: unreadCount },
      { value: SIDEBAR_TABS.lyrics, label: 'Lyrics', icon: MicVocal },
      { value: SIDEBAR_TABS.people, label: 'People', icon: Users, count: memberCount },
    ],
    [unreadCount, memberCount]
  );

  return (
    <Panel as='aside' className='h-full' aria-label='Chat, lyrics and people'>
      <PanelHeader className='p-2'>
        <PanelTabs
          tabs={tabs}
          value={activeTab}
          onChange={setSidebarTab}
          idPrefix={ID_PREFIX}
          fill
        />
      </PanelHeader>
      <TabPanel
        idPrefix={ID_PREFIX}
        value={SIDEBAR_TABS.chat}
        active={activeTab === SIDEBAR_TABS.chat}
      >
        {chat}
      </TabPanel>
      <TabPanel
        idPrefix={ID_PREFIX}
        value={SIDEBAR_TABS.lyrics}
        active={activeTab === SIDEBAR_TABS.lyrics}
        className='px-5'
      >
        {lyrics}
      </TabPanel>
      <TabPanel
        idPrefix={ID_PREFIX}
        value={SIDEBAR_TABS.people}
        active={activeTab === SIDEBAR_TABS.people}
      >
        {people}
      </TabPanel>
    </Panel>
  );
};

export default memo(RoomSidebar);
