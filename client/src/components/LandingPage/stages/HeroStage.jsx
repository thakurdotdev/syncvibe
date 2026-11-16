import {
  Disc3,
  GripVertical,
  Library,
  MessageCircle,
  RadioTower,
  Search,
  UserPlus,
} from 'lucide-react';
import { memo } from 'react';
import {
  Avatar,
  Badge,
  Bar,
  Collapse,
  Facepile,
  Phone,
  Stage,
  Text,
  Window,
  clock,
} from '@/components/stageshow';
import { Burst, Cover, Playhead, SongArtist, SongTitle, Transport, songAt } from './room';
import { useSiteTheme } from './useSiteTheme';
import './look.css';
import './hero-stage.css';

// The hero: one room on a laptop and a phone. The cursor presses Next on the laptop and the
// phone changes song in the same moment, then a reaction rises on both. Real words: the room,
// the song on both screens, what's up next, and the line the phone's chat gets for the skip.
// A conveyor: each loop moves the room on one song, so nothing on screen ever rewinds.

const SKIPPED = 'Pankaj Thakur skipped to the next song';

const initial = {
  i: 0,
  at: 73,
  since: null,
  playing: true,
  burst: 0,
};

const poster = { ...initial, i: 1, at: 14 };

const startClock = (a) => a.put((s) => (s.since == null ? { since: clock.now() } : {}));

async function wideScript(a) {
  startClock(a);
  await a.wait(1600);
  await a.move({ at: 'next', x: 0.75, y: 0.8 });
  await a.wait(250);
  await a.click();
  a.put((s) => ({ i: s.i + 1, at: 0, since: clock.now() }));
  await a.wait(2800);
  await a.move({ at: 'react', x: 0.85, y: 0.85 });
  await a.wait(200);
  await a.click();
  a.put((s) => ({ burst: s.burst + 1 }));
  await a.wait(600);
  await a.move('rest');
  await a.wait(3000);
}

async function compactScript(a) {
  startClock(a);
  await a.wait(1600);
  await a.move({ at: 'next', x: 0.75, y: 0.8 });
  await a.wait(200);
  await a.click();
  a.put((s) => ({ i: s.i + 1, at: 0, since: clock.now() }));
  await a.wait(2600);
  await a.click({ at: 'react', x: 0.8, y: 0.8 });
  a.put((s) => ({ burst: s.burst + 1 }));
  await a.wait(4200);
}

const NAV = [
  [Disc3, 44],
  [RadioTower, null],
  [MessageCircle, 58],
  [Library, 40],
];

/** The web room: our sidebar, the player, the queue and the chat beside it. */
const WebRoom = ({ s }) => (
  <Window url='syncvibe.thakur.dev/rooms' urlShape='pill' className='hs-window'>
    <div className='hs-app'>
      <aside className='hs-side'>
        <span className='hs-brand sv-display'>SyncVibe</span>
        <span className='hs-search'>
          <Search size={14} />
          <Bar w={46} h={5} tone={2} />
        </span>
        {NAV.map(([Icon, w], n) => (
          <span key={n} className='hs-nav' data-active={w == null || undefined}>
            <Icon size={15} />
            {w == null ? <Text className='hs-nav-label'>Rooms</Text> : <Bar w={w} h={5} tone={3} />}
          </span>
        ))}
        <span className='hs-side-rule' />
        {[70, 52, 62].map((w) => (
          <span key={w} className='hs-playlist'>
            <Bar w={28} h={28} r={6} tone={2} />
            <Bar w={w} h={5} tone={2} />
          </span>
        ))}
      </aside>

      <main className='hs-main'>
        <header className='hs-head'>
          <span className='hs-room sv-display'>Fun Sunday</span>
          <Badge tone='success' dot>
            Live
          </Badge>
          <Facepile names={['Pankaj Thakur', 'Meera']} size={24} overlap={6} className='hs-pile' />
        </header>

        <section className='hs-player'>
          <span className='hs-cover-wrap'>
            <Cover i={s.i} size={132} radius={14} />
            <Burst n={s.burst} style={{ left: 50, top: 40 }} />
          </span>
          <div className='hs-meta'>
            <SongTitle i={s.i} className='hs-title sv-display' />
            <SongArtist i={s.i} className='hs-artist' />
            <Playhead s={s} />
            <div className='hs-controls'>
              <Transport s={s} target='next' />
              <span className='hs-reactions'>
                <span className='hs-react' data-target='react' data-cursor='pointer'>
                  🔥
                </span>
                <span className='hs-react'>❤️</span>
                <span className='hs-react'>👏</span>
              </span>
            </div>
          </div>
        </section>

        <section className='hs-queue'>
          <div className='hs-queue-head'>
            <Text className='hs-label'>Up next</Text>
          </div>
          <div className='hs-rows'>
            {[0, 1, 2, 3, 4, 5].map((offset) => {
              const p = s.i + offset;
              return (
                <Collapse key={p} open={offset >= 1 && offset <= 4}>
                  <div className='hs-row'>
                    <Cover i={p} size={36} radius={8} />
                    <span className='hs-row-text'>
                      <Text className='hs-row-title'>{songAt(p).name}</Text>
                      <Bar w={50 + ((p * 17) % 40)} h={5} tone={2} />
                    </span>
                    <GripVertical size={16} className='hs-grip' />
                  </div>
                </Collapse>
              );
            })}
          </div>
        </section>
      </main>

      <aside className='hs-chat'>
        <Bar w={120} h={22} r={8} tone={1} />
        <div className='hs-chat-feed'>
          <span className='hs-bubble'>
            <Bar w={70} h={5} tone={3} />
          </span>
          <span className='hs-bubble hs-bubble--me'>
            <Bar w={56} h={5} tone={3} />
          </span>
        </div>
      </aside>
    </div>
  </Window>
);

/** The phone app's room: player card on top, the room chat under it. Sized in screen points. */
const PhoneRoom = ({ s, theme, width, className, nextTarget, reactTarget }) => (
  <Phone width={width} frame='android' dark={theme === 'dark'} className={className}>
    <div className='hs-ph'>
      <div className='hs-ph-head'>
        <div>
          <span className='hs-ph-room sv-display'>Fun Sunday</span>
          <span className='hs-ph-count'>
            <span className='hs-ph-dot' />2 listening
          </span>
        </div>
        <span className='hs-ph-invite'>
          <UserPlus size={20} />
        </span>
      </div>

      <div className='hs-ph-card'>
        <span className='hs-cover-wrap'>
          <Cover i={s.i} size={124} radius={18} />
          <Burst n={s.burst} style={{ left: 46, top: 30 }} />
        </span>
        <div className='hs-ph-meta'>
          <SongTitle i={s.i} className='hs-ph-title' />
          <SongArtist i={s.i} className='hs-ph-artist' />
          <Playhead s={s} />
          <Transport s={s} size={38} target={nextTarget} />
        </div>
        <div className='hs-ph-reactions'>
          {['🔥', '❤️', '👏', '😍', '🎵'].map((emoji, n) => (
            <span
              key={emoji}
              className='hs-ph-react'
              data-target={n === 0 ? reactTarget : undefined}
              data-cursor={n === 0 ? 'pointer' : undefined}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>

      <div className='hs-ph-tabs'>
        <span data-active>Chat</span>
        <span>Queue</span>
        <span>People 2</span>
      </div>

      <div className='hs-ph-feed'>
        <div className='hs-ph-msg'>
          <Avatar name='Meera' size={30} />
          <span className='hs-ph-bubble'>
            <span className='hs-ph-name'>Meera</span>
            turn it up 😅
          </span>
        </div>
        {/* One line per skip. The newest opens as the oldest of three closes, so the chat
            keeps its height however long the loop runs. */}
        {[2, 1, 0, -1].map((back) => {
          const p = s.i - back;
          if (p < 1) return null;
          return (
            <Collapse key={p} open={back >= 0 && back <= 1}>
              <div className='hs-ph-activity'>
                <span className='hs-ph-rule' />
                <span>{SKIPPED}</span>
                <span className='hs-ph-rule' />
              </div>
            </Collapse>
          );
        })}
      </div>
    </div>
  </Phone>
);

const HeroStage = memo(() => {
  const theme = useSiteTheme();

  return (
    <>
      <div className='hidden lg:block'>
        <Stage
          width={1232}
          height={540}
          theme={theme}
          initial={initial}
          poster={poster}
          script={wideScript}
          cursor={{ at: { x: 470, y: 506 } }}
          className='sv-look hs-stage'
        >
          {(s) => (
            <>
              <WebRoom s={s} />
              <span className='hs-rest' data-target='rest' />
              <PhoneRoom s={s} theme={theme} width={330} className='hs-phone' />
            </>
          )}
        </Stage>
      </div>

      <div className='lg:hidden'>
        <Stage
          width={358}
          height={570}
          theme={theme}
          initial={initial}
          poster={poster}
          script={compactScript}
          cursor={{ at: { x: 300, y: 380 }, style: 'touch' }}
          className='sv-look hs-stage hs-stage--compact'
        >
          {(s) => (
            <>
              <div className='hs-mini'>
                <span className='hs-mini-label'>On the laptop</span>
                <div className='hs-mini-row'>
                  <Cover i={s.i} size={40} radius={8} />
                  <span className='hs-mini-text'>
                    <SongTitle i={s.i} className='hs-mini-title' />
                    <Playhead s={s} />
                  </span>
                </div>
              </div>
              <PhoneRoom
                s={s}
                theme={theme}
                width={326}
                className='hs-phone hs-phone--compact'
                nextTarget='next'
                reactTarget='react'
              />
            </>
          )}
        </Stage>
      </div>
    </>
  );
});

HeroStage.displayName = 'HeroStage';
export default HeroStage;
