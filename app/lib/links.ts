/**
 * Web links in message text, found the way the server finds the one it previews
 * (server/src/features/chat/link-preview.rules.ts). The web has the same in client/src/lib/links.js.
 */

const LINK = /\bhttps?:\/\/[^\s<>"'`]+/gi;
/** A sentence's punctuation after a link isn't part of it. */
const TRAILING = /[.,;:!?)\]}'"»]+$/;

export type TextPart = { text: string; url?: string };

/** The text cut into plain runs and links, in order. */
export const splitLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
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
