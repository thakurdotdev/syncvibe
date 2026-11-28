/**
 * Web links in message text, found the way the server finds the one it previews
 * (server/src/features/chat/link-preview.rules.ts). The app has the same in app/lib/links.ts.
 */

const LINK = /\bhttps?:\/\/[^\s<>"'`]+/gi;
/** A sentence's punctuation after a link isn't part of it. */
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/** The text cut into plain runs and links (`{ text, url? }`), in order. */
export const splitLinks = (text) => {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;
    const url = match[0].replace(TRAILING, '');
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
};
