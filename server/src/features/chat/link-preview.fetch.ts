import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { isFetchable, isPublicAddress, parsePreview, type LinkPreview } from './link-preview.rules';

/**
 * Fetching a page for its preview. The server must not be talked into fetching its own network:
 * every address a name resolves to is checked at the moment of connecting (so a name can't change
 * between the check and the request), on every redirect, and an address written as an IP is
 * checked before anything is sent.
 */

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const USER_AGENT = 'Mozilla/5.0 (compatible; SyncVibe link preview)';

export class BlockedAddress extends Error {}

/** DNS that refuses to hand the connection anything but public addresses. */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) {
      callback(error, '', 0);
      return;
    }
    const allowed = addresses.filter((entry) => isPublicAddress(entry.address));
    if (allowed.length === 0 || allowed.length !== addresses.length) {
      callback(new BlockedAddress(`${hostname} resolves to a private address`), '', 0);
      return;
    }
    if (options.all) {
      (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, allowed);
    } else {
      callback(null, allowed[0]!.address, allowed[0]!.family);
    }
  });
};

/** One request, following no redirects itself: resolves to the response, unread. */
const get = (url: URL): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(
      url,
      {
        lookup: publicLookup,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'Accept-Language': 'en;q=0.9,*;q=0.5',
        },
      },
      resolve
    );
    request.on('timeout', () => request.destroy(new Error('timed out')));
    request.on('error', reject);
  });

/** The start of an HTML page, up to the end of its head, or null if it isn't one. */
const readHead = (response: IncomingMessage): Promise<string | null> =>
  new Promise((resolve) => {
    const type = String(response.headers['content-type'] ?? '');
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      response.destroy();
      resolve(null);
      return;
    }
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? 'utf-8';
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(charset);
    } catch {
      decoder = new TextDecoder('utf-8');
    }
    let text = '';
    let bytes = 0;
    const timer = setTimeout(() => response.destroy(), TIMEOUT_MS);
    const finish = () => {
      clearTimeout(timer);
      resolve(text);
    };
    response.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      text += decoder.decode(chunk, { stream: true });
      // Everything a preview needs is in the head.
      if (bytes >= MAX_BYTES || /<\/head>/i.test(text)) {
        response.destroy();
        finish();
      }
    });
    response.on('end', finish);
    response.on('close', finish);
    response.on('error', finish);
  });

/** What the page at `url` says about itself, following a few redirects; null if nothing. */
export const fetchPreview = async (start: URL): Promise<LinkPreview | null> => {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isFetchable(url)) return null;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    // An address written as an IP isn't looked up, so it is checked here.
    if (isIP(host) && !isPublicAddress(host)) return null;

    const response = await get(url);
    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      url = new URL(response.headers.location, url);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      return null;
    }
    const html = await readHead(response);
    return html ? parsePreview(html, start) : null;
  }
  return null;
};
