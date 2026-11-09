/*
 * The server's clock, estimated from pings. Everything about staying in step depends on devices
 * agreeing what time it is, to within a few milliseconds.
 *
 * The same logic lives in app/stores/groupMusic/roomClock.ts. Change them together.
 */

const SAMPLES = 8;

const samples = [];
let offset = 0;
let seeded = false;

/** Server time now, as best this device knows. */
export const serverNow = () => Date.now() + offset;

/**
 * A ping answered: sent at `sentAt` and received at `receivedAt` on this device's clock, with the
 * server's time in between. The fastest reply of the last few had the least time to be delayed
 * more one way than the other, which is the error in this estimate, so that one is trusted.
 */
export const addClockSample = (sentAt, serverTime, receivedAt) => {
  const rtt = Math.max(0, receivedAt - sentAt);
  samples.push({ rtt, offset: serverTime + rtt / 2 - receivedAt });
  if (samples.length > SAMPLES) samples.shift();
  const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
  offset = best.offset;
  seeded = true;
  return { offset, rtt: best.rtt };
};

/**
 * Until the first ping is back, any message carrying the server's time gives a rough clock (off
 * by however long the message took), which is far better than trusting this device's own.
 */
export const seedClock = (serverTime) => {
  if (seeded || typeof serverTime !== 'number') return;
  offset = serverTime - Date.now();
  seeded = true;
};

export const clockRtt = () =>
  samples.length ? samples.reduce((a, b) => (b.rtt < a.rtt ? b : a)).rtt : null;

export const clockQuality = () => {
  const rtt = clockRtt();
  if (rtt === null || rtt < 150) return 'good';
  return rtt < 400 ? 'fair' : 'poor';
};

export const resetClock = () => {
  samples.length = 0;
  offset = 0;
  seeded = false;
};
