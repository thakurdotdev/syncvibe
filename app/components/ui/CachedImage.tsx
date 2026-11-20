import { Image, type ImageProps } from 'expo-image';
import { memo } from 'react';

/** A cover that's missing (`{ uri: undefined }`) is drawn as nothing, like React Native's Image did. */
const sourceOf = (source: ImageProps['source']) =>
  source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source && !source.uri
    ? null
    : source;

/**
 * Every picture in the app: covers, avatars, room art. expo-image keeps decoded images in
 * memory as well as on disk, so a cover that scrolls back into view, or shows again on the next
 * screen, is there in the same frame instead of loading again. When its source changes it keeps
 * the old picture until the new one is ready, so a song change never flashes an empty square.
 * Images are decoded at the size they're shown.
 */
export const CachedImage = memo(function CachedImage({ source, ...props }: ImageProps) {
  return (
    <Image cachePolicy='memory-disk' contentFit='cover' {...props} source={sourceOf(source)} />
  );
});

/** The next song's cover dissolving into the last one's, where a cover changes in place. */
export const ART_SWAP = { duration: 180, effect: 'cross-dissolve' } as const;

/** Loads pictures into the memory cache before they're shown, so they appear without a fade. */
export const prefetchImages = (uris: (string | null | undefined)[]) => {
  const list = [...new Set(uris.filter((uri): uri is string => Boolean(uri)))];
  if (!list.length) return;
  Image.prefetch(list, 'memory-disk').catch(() => {});
};
