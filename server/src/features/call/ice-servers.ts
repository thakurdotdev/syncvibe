/**
 * The STUN and TURN servers a call's two browsers use to find a path to each other. TURN is
 * Cloudflare's, which hands out short-lived credentials; they travel with the answer to
 * `call:start` / `call:accept`, so a call never starts with ones that have run out.
 */

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

const TURN_KEY_ID = process.env.CLOUDFLARE_TURN_TOKEN_ID;
const TURN_API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN;

/** Long enough for any call; a relay stops working when its credentials expire. */
const CREDENTIAL_TTL_S = 24 * 60 * 60;
/** One set is shared for this long, so every call gets at least 23 hours out of it. */
const REUSE_MS = 60 * 60 * 1000;
/** Ringing must not wait on Cloudflare: past this the call goes ahead with what we have. */
const REQUEST_TIMEOUT_MS = 3000;

/** Enough for two people who can reach each other directly; no relay. */
const STUN_ONLY: IceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

let cached: IceServer[] | null = null;
let cachedAt = 0;
let pending: Promise<IceServer[]> | null = null;

/** Browsers refuse to connect to port 53, and waiting for those to fail slows a call's start. */
export const withoutBlockedPorts = (urls: string[]): string[] =>
  urls.filter((url) => !/:53(\?|$)/.test(url));

const requestFromCloudflare = async (): Promise<IceServer[]> => {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURN_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL_S }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );
  if (!response.ok) throw new Error(`Cloudflare TURN answered ${response.status}`);

  const data = (await response.json()) as {
    iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  };
  const servers = (data.iceServers ?? [])
    .map((server) => ({
      ...server,
      urls: withoutBlockedPorts(Array.isArray(server.urls) ? server.urls : [server.urls]),
    }))
    .filter((server) => server.urls.length > 0);
  if (servers.length === 0) throw new Error('Cloudflare TURN returned no servers');
  return servers;
};

/** Never fails: without TURN a call can still connect directly, which is better than no call. */
export const getIceServers = async (): Promise<IceServer[]> => {
  if (cached && Date.now() - cachedAt < REUSE_MS) return cached;
  if (!TURN_KEY_ID || !TURN_API_TOKEN) return STUN_ONLY;

  pending ??= requestFromCloudflare()
    .then((servers) => {
      cached = servers;
      cachedAt = Date.now();
      return servers;
    })
    .catch((error) => {
      console.error('Getting TURN credentials failed:', (error as Error).message);
      // The last set is still good for hours after we stop handing it out.
      return cached && Date.now() - cachedAt < (CREDENTIAL_TTL_S - 3600) * 1000
        ? cached
        : STUN_ONLY;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
};
