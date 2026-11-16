import { File, Paths } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import { extensionOf } from '@/lib/attachments';

const ALBUM = 'SyncVibe';

/**
 * Puts a file on this phone into the gallery, in a SyncVibe album like other chat apps keep.
 * Throws if the gallery refuses it; the album is a nicety, so failing to make one doesn't.
 */
export const addToGallery = async (uri: string) => {
  const album = await Album.get(ALBUM).catch(() => null);
  if (album) return Asset.create(uri, album);
  const asset = await Asset.create(uri);
  try {
    await Album.create(ALBUM, [asset], true);
  } catch {
    // Stays where the gallery put it.
  }
  return asset;
};

/**
 * Saves an image to the phone's gallery, as the type its name says (JPEG if it has none). Throws
 * if permission is refused or the download fails.
 */
export const saveImageToGallery = async (url: string, name?: string) => {
  const { status } = await requestPermissionsAsync(true);
  if (status !== 'granted') throw new Error('permission');

  const ext = extensionOf(name) || 'jpg';
  const destination = new File(Paths.cache, `syncvibe-${Date.now()}.${ext}`);
  const downloaded = url.startsWith('http')
    ? await File.downloadFileAsync(url, destination)
    : new File(url);
  await addToGallery(downloaded.uri);
};
