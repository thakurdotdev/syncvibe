import { Message } from '@/models/index';
import type { ContentMeta } from '@/models/chat/message.model';
import { createRateLimiter } from '@/utils/rate-limiter';
import { cache } from '@/utils/redis';
import { emitToUsers } from '../chat.realtime';
import { BlockedAddress, fetchPreview } from '../link-preview.fetch';
import { firstLink, type LinkPreview } from '../link-preview.rules';
import { requireMembers } from './conversation.service';
import { presentMessages } from './message.presenter';

/**
 * Previews for links in messages. The server fetches the page, never the devices: otherwise
 * sending a link would make the other person's phone contact a site of the sender's choosing,
 * which tells it their IP address and when they read the message. Only the page's title,
 * description and site name are kept; no images, for the same reason. How the page is fetched
 * safely is in link-preview.fetch.
 */

const CACHE_TTL_S = 24 * 60 * 60;
/** "Nothing to show" is remembered for less long: the site may have been down. */
const EMPTY_TTL_S = 60 * 60;

// Per sender. A preview is a request to someone else's site, so a burst of links is cut short.
const allowPreview = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** A preview for the link, from the cache when it was fetched in the last day. */
const previewFor = async (url: URL): Promise<LinkPreview | null> => {
  const key = `chat:link:v1:${url.toString()}`;
  const cached = await cache.get<{ preview: LinkPreview | null }>(key);
  if (cached) return cached.preview;
  let preview: LinkPreview | null = null;
  try {
    preview = await fetchPreview(url);
  } catch (error) {
    if (!(error instanceof BlockedAddress)) {
      console.warn('Link preview failed:', url.hostname, (error as Error).message);
    }
  }
  await cache.set(key, { preview }, preview ? CACHE_TTL_S : EMPTY_TTL_S);
  return preview;
};

/**
 * Adds a preview of the first link in a text message, once it's fetched, and tells the
 * conversation (chat:message:updated). Runs after the message was sent; it never holds it up.
 */
export const addLinkPreview = async (messageId: number, senderId: number): Promise<void> => {
  const message = await Message.findOne({ where: { id: messageId, deletedAt: null } });
  if (!message || message.type !== 'text') return;
  const meta = (message.meta as ContentMeta | null) ?? {};
  const url = firstLink(message.body);
  if (!url) {
    // Edited so there's no link any more: the old preview goes.
    if (meta.link) await updateLink(message, meta, null);
    return;
  }
  if (meta.link?.url === url.toString()) return;
  if (!allowPreview(senderId)) return;

  const preview = await previewFor(url);
  // Changed while the page was loading: whichever finished last for the latest text wins.
  await message.reload();
  if (message.deletedAt || firstLink(message.body)?.toString() !== url.toString()) return;
  await updateLink(message, (message.meta as ContentMeta | null) ?? {}, preview);
};

const updateLink = async (message: Message, meta: ContentMeta, link: LinkPreview | null) => {
  const { link: _old, ...rest } = meta;
  const next: ContentMeta = link ? { ...rest, link } : rest;
  if (!link && !_old) return;
  await message.update({ meta: Object.keys(next).length ? next : null });
  const members = await requireMembers(message.conversationId, message.senderId);
  const [updated] = await presentMessages([message]);
  emitToUsers(members, 'chat:message:updated', { message: updated });
};

/** Starts a preview without waiting for it; a failure only means there's no preview. */
export const queueLinkPreview = (messageId: number, senderId: number): void => {
  addLinkPreview(messageId, senderId).catch((error: unknown) =>
    console.error('Adding a link preview failed:', error)
  );
};
