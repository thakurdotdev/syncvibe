import { ListMusic, MessageCircle, Users } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Panel, PanelHeader } from '../components/Panel';
import PanelTabs, { TabPanel } from '../components/PanelTabs';
import { MOBILE_TABS, useRoomUi } from '../hooks/useRoomUi';

const ID_PREFIX = 'room-mobile';

/** Phone / tablet layout: chat, queue and people share the space below the player. */
const MobileRoomTabs = ({ chat, queue, people, unreadCount, queueCount, memberCount }) => {
  const activeTab = useRoomUi((s) => s.mobileTab);
  const setMobileTab = useRoomUi((s) => s.setMobileTab);

  const tabs = useMemo(
    () => [
      { value: MOBILE_TABS.chat, label: 'Chat', icon: MessageCircle, alert: unreadCount },
      { value: MOBILE_TABS.queue, label: 'Queue', icon: ListMusic, count: queueCount },
      { value: MOBILE_TABS.people, label: 'People', icon: Users, count: memberCount },
    ],
    [unreadCount, queueCount, memberCount]
  );

  return (
    <Panel className='flex-1'>
      <PanelHeader className='p-1.5'>
        <PanelTabs
          tabs={tabs}
          value={activeTab}
          onChange={setMobileTab}
          idPrefix={ID_PREFIX}
          fill
        />
      </PanelHeader>
      <TabPanel
        idPrefix={ID_PREFIX}
        value={MOBILE_TABS.chat}
        active={activeTab === MOBILE_TABS.chat}
      >
        {chat}
      </TabPanel>
      <TabPanel
        idPrefix={ID_PREFIX}
        value={MOBILE_TABS.queue}
        active={activeTab === MOBILE_TABS.queue}
      >
        {queue}
      </TabPanel>
      <TabPanel
        idPrefix={ID_PREFIX}
        value={MOBILE_TABS.people}
        active={activeTab === MOBILE_TABS.people}
      >
        {people}
      </TabPanel>
    </Panel>
  );
};

export default memo(MobileRoomTabs);
