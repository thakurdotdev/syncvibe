import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

/** Saves an image to the phone's gallery. Throws if permission is refused or the download fails. */
export const saveImageToGallery = async (url: string) => {
  const { status } = await MediaLibrary.requestPermissionsAsync(true);
  if (status !== 'granted') throw new Error('permission');

  const destination = new File(Paths.cache, `syncvibe-${Date.now()}.jpg`);
  const downloaded = url.startsWith('http')
    ? await File.downloadFileAsync(url, destination)
    : new File(url);
  await MediaLibrary.createAssetAsync(downloaded.uri);
};
