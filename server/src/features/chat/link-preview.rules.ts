import { BlockList, isIP } from 'node:net';
import type { LinkMeta } from '@/models/chat/message.model';

/**
 * The parts of a link preview that don't touch the network: which link in a message gets one,
 * which addresses the server may fetch, and what a page says about itself. Kept apart so they
 * are tested on their own (link-preview.rules.test.ts).
 */

export type LinkPreview = LinkMeta;

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 300;
const MAX_URL = 2000;

/** http(s) links in text. The apps find links with the same pattern, to make them tappable. */
export const LINK_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
/** A sentence's punctuation after a link isn't part of it. */
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/** The first web link in a message, as a URL, or null. */
export const firstLink = (text: string | null | undefined): URL | null => {
  if (!text) return null;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const raw = match[0].replace(TRAILING, '');
    if (raw.length > MAX_URL) continue;
    try {
      const url = new URL(raw);
      if (isFetchable(url)) return url;
    } catch {
      // Not a real address: try the next one.
    }
  }
  return null;
};

// Everything that isn't the public internet: this machine, the local network, the cloud's
// metadata service (169.254.169.254), carrier NAT, documentation and reserved ranges.
const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  PRIVATE.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE.addSubnet(net, prefix, 'ipv6');
}

/** An IPv4 address written inside an IPv6 one (::ffff:10.0.0.1, 64:ff9b::a00:1), if any. */
const embeddedIpv4 = (address: string): string | null => {
  const lower = address.toLowerCase();
  const dotted = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return dotted[1]!;
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (!hex) return null;
  const high = parseInt(hex[1]!, 16);
  const low = parseInt(hex[2]!, 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
};

/** Whether an IP address is on the public internet, so the server may connect to it. */
export const isPublicAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) return !PRIVATE.check(address, 'ipv4');
  if (family !== 6) return false;
  const inner = embeddedIpv4(address);
  if (inner) return !PRIVATE.check(inner, 'ipv4');
  return !PRIVATE.check(address, 'ipv6');
};

/**
 * Whether the server may try this address at all: http(s) on the usual ports, no user name, and
 * a host that is a name (checked again when it resolves) or a public IP.
 */
export const isFetchable = (url: URL): boolean => {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '80' && url.port !== '443') return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return false;
  }
  if (isIP(host)) return isPublicAddress(host);
  // A name with no dot is a machine on the local network.
  return host.includes('.');
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/** Readable text: entities decoded, control characters and runs of spaces gone, capped. */
const clean = (value: string | undefined, max: number): string | null => {
  if (!value) return null;
  const text = [...decodeEntities(value)]
    .filter((char) => {
      const code = char.codePointAt(0)!;
      return code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code <= 0x9f);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

const ATTRIBUTE = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/** What a page says about itself (Open Graph, then the usual tags), or null if it says nothing. */
export const parsePreview = (html: string, url: URL): LinkPreview | null => {
  const head = html.slice(0, 512 * 1024);
  const tags = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    let key: string | null = null;
    let content: string | null = null;
    for (const match of tag.matchAll(ATTRIBUTE)) {
      const name = match[1]!.toLowerCase();
      const value = match[3] ?? match[4] ?? match[5] ?? '';
      if (name === 'property' || name === 'name') key = value.toLowerCase();
      else if (name === 'content') content = value;
    }
    if (key && content != null && !tags.has(key)) tags.set(key, content);
  }
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];

  const title = clean(tags.get('og:title') ?? tags.get('twitter:title') ?? titleTag, MAX_TITLE);
  const description = clean(
    tags.get('og:description') ?? tags.get('twitter:description') ?? tags.get('description'),
    MAX_DESCRIPTION
  );
  if (!title && !description) return null;
  return {
    url: url.toString(),
    title,
    description,
    siteName: clean(tags.get('og:site_name'), 80) ?? url.hostname.replace(/^www\./, ''),
  };
};
