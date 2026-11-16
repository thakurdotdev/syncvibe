import {
  Copy,
  Crown,
  GripVertical,
  MessageSquareOff,
  MoreHorizontal,
  Shield,
  UserMinus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, Bar, Button, Menu, Popover, Stage, Text, Toggle } from '@/components/stageshow';
import { DEMO_PLAYLIST } from '../demoSong';
import { Cover } from './room';
import { useSiteTheme } from './useSiteTheme';
import './look.css';
import './feature-stages.css';

/* ── Queue: a song lifted by its grip and carried to the top of Up next ─────────────────────
   Played once as the grid scrolls in; the still is the payoff. Real words: Up next, Autoplay
   and the three songs. Rows sit at their slot by a transform, so the others glide out of the
   way while the lifted one rides the cursor. */

const ROW = 60;
const QUEUE = [2, 3, 5, 6].map((n) => ({ ...DEMO_PLAYLIST[n], n }));
const LIFT = QUEUE[3].id;
const queueInitial = { order: QUEUE.map((s) => s.id), lifted: null, dy: 0 };
const queuePoster = {
  order: [LIFT, ...QUEUE.slice(0, 3).map((s) => s.id)],
  lifted: null,
  dy: 0,
};

async function queueScript(a) {
  await a.wait(700);
  const grip = a.rect(`grip-${LIFT}`);
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  await a.move(from);
  await a.wait(200);
  let order = queueInitial.order;
  await a.drag(
    { x: from.x + 4, y: from.y - 3 * ROW },
    (at) => {
      const dy = at.y - from.y;
      const slot = Math.max(0, Math.min(3, Math.round((3 * ROW + dy) / ROW)));
      const rest = queueInitial.order.filter((id) => id !== LIFT);
      order = [...rest.slice(0, slot), LIFT, ...rest.slice(slot)];
      a.put({ lifted: LIFT, dy, order });
    },
    { duration: 1000 }
  );
  a.put({ lifted: null, dy: 0, order });
  await a.wait(400);
  await a.move({ x: from.x + 60, y: from.y - 40 });
  await a.wait(2000);
}

export const QueueStage = () => {
  const theme = useSiteTheme();
  return (
    <Stage
      width={760}
      height={330}
      compact={{ below: 560, width: 358, height: 330 }}
      theme={theme}
      initial={queueInitial}
      poster={queuePoster}
      script={queueScript}
      play='once'
      cursor={{ at: { wide: { x: 700, y: 300 }, compact: { x: 330, y: 300 } } }}
      fill
      className='sv-look fs-queue'
    >
      {(s) => (
        <div className='fs-panel'>
          <div className='fs-panel-head'>
            <Text className='fs-panel-title'>Up next</Text>
            <span className='fs-autoplay'>
              <Text className='fs-autoplay-label'>Autoplay</Text>
              <Toggle on />
            </span>
          </div>
          <div className='fs-list' style={{ height: QUEUE.length * ROW }}>
            {QUEUE.map((song) => {
              const lifted = s.lifted === song.id;
              const y = lifted
                ? queueInitial.order.indexOf(song.id) * ROW + s.dy
                : s.order.indexOf(song.id) * ROW;
              return (
                <div
                  key={song.id}
                  className='fs-slot'
                  data-lifted={lifted || undefined}
                  style={{ transform: `translateY(${y}px)` }}
                >
                  <div className='fs-row'>
                    <Cover i={song.n} size={40} radius={8} />
                    <span className='fs-row-text'>
                      <Text className='fs-row-title'>{song.name}</Text>
                      <Bar w={56 + ((song.n * 23) % 50)} h={5} tone={2} />
                    </span>
                    <span className='fs-grip' data-target={`grip-${song.id}`} data-cursor='grab'>
                      <GripVertical size={16} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Stage>
  );
};

/* ── Roles: a listener's menu, open on the host's screen ──────────────────────────────────
   A still. The real menu's four actions are the words; the people around Meera are filler. */

const ROLE_ITEMS = [
  [Shield, 'Make co-host'],
  [Crown, 'Make host'],
  [MessageSquareOff, 'Mute in chat'],
  [UserMinus, 'Remove from room', true],
];

export const RolesStage = () => {
  const theme = useSiteTheme();
  return (
    <Stage
      width={400}
      height={300}
      compact={{ below: 380, width: 358, height: 300 }}
      theme={theme}
      hover={['cohost', 'more']}
      fill
      className='sv-look fs-roles'
    >
      {() => (
        <div className='fs-panel fs-people'>
          <div className='fs-person'>
            <Avatar size={34} plain />
            <span className='fs-row-text'>
              <Bar w={92} h={6} tone={3} />
              <Bar w={40} h={5} tone={2} />
            </span>
          </div>
          <div className='fs-person' data-open>
            <Avatar name='Meera' size={34} />
            <span className='fs-row-text'>
              <Text className='fs-row-title'>Meera</Text>
              <Text className='fs-row-sub'>Listening</Text>
            </span>
            <Button
              variant='ghost'
              className='sv-round fs-more'
              data-target='more'
              icon={<MoreHorizontal size={16} />}
            />
          </div>
          <div className='fs-person'>
            <Avatar size={34} plain />
            <span className='fs-row-text'>
              <Bar w={70} h={6} tone={3} />
              <Bar w={48} h={5} tone={2} />
            </span>
          </div>
          <Popover show origin='top right' className='fs-menu'>
            <Menu
              targets={['cohost']}
              items={ROLE_ITEMS.map(([Icon, label, danger]) => (
                <span key={label} className='fs-menu-item' data-danger={danger || undefined}>
                  <Icon size={16} />
                  {label}
                </span>
              ))}
            />
          </Popover>
        </div>
      )}
    </Stage>
  );
};

/* ── Join: the room's code, ready to scan or copy ────────────────────────────────────────── */

const SITE_URL = 'https://syncvibe.thakur.dev';

const useQr = () => {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    let current = true;
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(SITE_URL, { margin: 0, width: 320, color: { dark: '#0e0e10' } })
      )
      .then((url) => current && setQr(url))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  return qr;
};

export const JoinStage = () => {
  const theme = useSiteTheme();
  const qr = useQr();
  return (
    <Stage
      width={400}
      height={300}
      compact={{ below: 380, width: 358, height: 300 }}
      theme={theme}
      fill
      className='sv-look fs-join'
    >
      {() => (
        <div className='fs-ticket'>
          <div className='fs-ticket-head'>
            <span className='fs-ticket-room sv-display'>Fun Sunday</span>
            <Text className='fs-row-sub'>Scan to join</Text>
          </div>
          <span className='fs-qr'>
            {qr && <img src={qr} alt='' width={116} height={116} draggable={false} />}
          </span>
          <Button variant='secondary' icon={<Copy size={14} />} className='fs-copy'>
            Copy room code
          </Button>
        </div>
      )}
    </Stage>
  );
};
