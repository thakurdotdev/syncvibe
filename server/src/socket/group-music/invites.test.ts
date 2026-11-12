import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INVITE_TTL_MS, noteInvite, pendingInvitesOf, settleInvite } from './invites';
import { deserializeRoom, serializeCore } from './room-store';
import { createGroupState } from './state';

const room = () => createGroupState({ id: 'g1', name: 'Room', createdBy: 1, userName: 'Host' });

const HOST = { userId: 1, userName: 'Host' };

test('an invite waits until it expires, newest first', () => {
  const group = room();
  noteInvite(group, { userId: 2, userName: 'Asha' }, HOST, 1_000);
  noteInvite(group, { userId: 3, userName: 'Ravi', profilePic: null }, HOST, 2_000);

  assert.deepEqual(
    pendingInvitesOf(group, 2_000).map((invite) => invite.userId),
    ['3', '2']
  );
  assert.equal(pendingInvitesOf(group, 1_000 + INVITE_TTL_MS).length, 1);
  assert.equal(group.invites['2'], undefined);
});

test('inviting someone again starts their wait over', () => {
  const group = room();
  noteInvite(group, { userId: 2, userName: 'Asha' }, HOST, 1_000);
  noteInvite(group, { userId: 2, userName: 'Asha' }, HOST, 5_000);
  const [invite] = pendingInvitesOf(group, 5_000);
  assert.equal(invite?.expiresAt, 5_000 + INVITE_TTL_MS);
  assert.equal(pendingInvitesOf(group, 5_000).length, 1);
});

test('joining or declining ends an invite once', () => {
  const group = room();
  noteInvite(group, { userId: 2, userName: 'Asha' }, HOST);
  assert.equal(settleInvite(group, 2), true);
  assert.equal(settleInvite(group, '2'), false);
});

test('pending invites survive a restart', () => {
  const group = room();
  noteInvite(group, { userId: 2, userName: 'Asha' }, HOST);
  const restored = deserializeRoom({ core: serializeCore(group) });
  assert.equal(restored?.invites['2']?.userName, 'Asha');

  const { invites: _dropped, ...older } = JSON.parse(serializeCore(group));
  assert.deepEqual(deserializeRoom({ core: JSON.stringify(older) })?.invites, {});
});
