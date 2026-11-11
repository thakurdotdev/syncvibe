import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSession, load, setShuffle, transfer } from './session';
import { deserializeSession, serializeCore } from './store';

test('a stored session reads back the same', () => {
  const session = createSession('7', 1000);
  load(
    session,
    [
      { id: 'a', duration: 100 },
      { id: 'b', duration: 100 },
    ],
    { startIndex: 1 },
    1000
  );
  setShuffle(session, true, () => 0);
  transfer(session, { deviceId: 'phone-1', name: 'Phone', mobile: true }, 2000);
  session.repeat = 'all';

  const restored = deserializeSession(
    '7',
    JSON.parse(serializeCore(session)),
    JSON.parse(JSON.stringify(session.items))
  );
  assert.deepEqual(restored, session);
});

test('a stored session pointing at a missing item comes back stopped', () => {
  const restored = deserializeSession(
    '7',
    { currentId: 'gone', timeline: { playing: true, positionMs: 5, anchorAt: 1 }, repeat: 'odd' },
    [{ id: 'x', song: { id: 's' } }, { bad: true }]
  );
  assert.equal(restored?.currentId, null);
  assert.equal(restored?.timeline.playing, false);
  assert.equal(restored?.repeat, 'off');
  assert.equal(restored?.items.length, 1);
  assert.equal(deserializeSession('7', null, []), null);
});
