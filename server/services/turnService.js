const TURN_KEY_ID = process.env.CLOUDFLARE_TURN_TOKEN_ID;
const TURN_API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN;
const CREDENTIAL_TTL = 86400;
const CACHE_TTL = CREDENTIAL_TTL - 3600;

let cachedCredentials = null;
let cacheExpiry = 0;

const filterBlockedPorts = (urls) => {
  return urls.filter((url) => !url.includes(":53"));
};

const generateTurnCredentials = async () => {
  const now = Date.now();
  if (cachedCredentials && now < cacheExpiry) {
    return cachedCredentials;
  }

  if (!TURN_KEY_ID || !TURN_API_TOKEN) {
    throw new Error("Cloudflare TURN credentials not configured");
  }

  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TURN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Cloudflare TURN API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  const iceServers = data.iceServers.map((server) => ({
    ...server,
    urls: filterBlockedPorts(
      Array.isArray(server.urls) ? server.urls : [server.urls]
    ),
  }));

  cachedCredentials = { iceServers };
  cacheExpiry = now + CACHE_TTL * 1000;

  return cachedCredentials;
};

module.exports = { generateTurnCredentials };
