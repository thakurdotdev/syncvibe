import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { extensionOf } from '@/lib/attachments';

/**
 * Saves an image to the phone's gallery, as the type its name says (JPEG if it has none). Throws
 * if permission is refused or the download fails.
 */
export const saveImageToGallery = async (url: string, name?: string) => {
  const { status } = await MediaLibrary.requestPermissionsAsync(true);
  if (status !== 'granted') throw new Error('permission');

  const ext = extensionOf(name) || 'jpg';
  const destination = new File(Paths.cache, `syncvibe-${Date.now()}.${ext}`);
  const downloaded = url.startsWith('http')
    ? await File.downloadFileAsync(url, destination)
    : new File(url);
  await MediaLibrary.createAssetAsync(downloaded.uri);
};
