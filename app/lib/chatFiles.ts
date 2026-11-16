import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Crypto from 'expo-crypto';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { Image } from 'react-native';
import {
  checkFile,
  extensionOf,
  MAX_FILES_AT_ONCE,
  mimeOf,
  nameWithExtension,
} from '@/lib/attachments';
import { freshAttachment, type PickedFile } from '@/lib/chat';
import type { Attachment, ChatMessage } from '@/stores/chatStore';
import { useMediaStore } from '@/stores/mediaStore';
import { addToGallery, saveImageToGallery } from '@/utils/saveImage';

/**
 * Files in conversations, on the phone: picking them to send, and opening or saving the ones
 * received. Opening downloads the file once into the app's cache and hands it to an app that
 * can show it; saving puts photos and videos in the gallery and anything else in a folder the
 * person picks.
 */

export interface Picked {
  files: PickedFile[];
  /** Why some files were left out, to show the person. */
  problems: string[];
}

const sizeOf = (uri: string, fallback?: number | null): number => {
  try {
    const size = new File(uri).size;
    if (size) return size;
  } catch {
    // Some providers don't report a size; the picker's own figure is the next best.
  }
  return fallback ?? 0;
};

const accept = (candidates: Omit<PickedFile, 'kind' | 'key'>[], room: number): Picked => {
  const files: PickedFile[] = [];
  const problems: string[] = [];
  for (const candidate of candidates) {
    if (files.length >= room) {
      problems.push(`You can send up to ${MAX_FILES_AT_ONCE} files at once`);
      break;
    }
    const checked = checkFile(candidate.name, candidate.size);
    if (checked.kind) files.push({ ...candidate, kind: checked.kind, key: Crypto.randomUUID() });
    else problems.push(checked.error);
  }
  return { files, problems: [...new Set(problems)] };
};

const baseName = (name?: string | null) => (name || '').replace(/\.[^.]+$/, '');

/**
 * Photos and videos from the gallery. Photos are re-encoded a little smaller by the picker, so
 * the name takes the extension of the file it actually produced.
 */
export const pickMedia = async (room: number): Promise<Picked | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, room),
    orderedSelection: true,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;

  return accept(
    result.assets.map((asset, index) => {
      const ext =
        extensionOf(asset.uri.split('?')[0]?.split('/').pop()) ||
        extensionOf(asset.fileName ?? '') ||
        (asset.type === 'video' ? 'mp4' : 'jpg');
      const fallback = `${asset.type === 'video' ? 'video' : 'photo'}-${Date.now()}-${index + 1}`;
      return {
        uri: asset.uri,
        name: `${baseName(asset.fileName) || fallback}.${ext}`,
        size: sizeOf(asset.uri, asset.fileSize),
        width: asset.width || undefined,
        height: asset.height || undefined,
        durationSec: asset.duration ? Math.round(asset.duration / 1000) : undefined,
      };
    }),
    room
  );
};

const measure = (uri: string) =>
  new Promise<{ width?: number; height?: number }>((resolve) =>
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({})
    )
  );

/**
 * Any files, from the system's file picker. Each is copied into the app's cache under its real
 * name: the picker's own addresses (content://…/document/msf:123) carry no name or extension,
 * and a copy also stays readable if sending has to be tried again later.
 */
export const pickDocuments = async (room: number): Promise<Picked | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;

  const picked = accept(
    result.assets.map((asset) => ({
      uri: asset.uri,
      name: nameWithExtension(asset.name, asset.mimeType),
      size: sizeOf(asset.uri, asset.size),
    })),
    room
  );
  // Photos picked as files still show as photos; their size on screen keeps the layout steady.
  await Promise.all(
    picked.files.map(async (file) => {
      if (file.kind === 'image') Object.assign(file, await measure(file.uri));
    })
  );
  return picked;
};

// ── Received files ──────────────────────────────────────────────────────────

const cacheFolder = () => {
  const folder = new Directory(Paths.cache, 'chat-files');
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  return folder;
};

const cachedCopy = (attachment: Attachment) =>
  new File(cacheFolder(), `${attachment.id}.${extensionOf(attachment.name) || 'bin'}`);

const isComplete = (file: File, attachment: Attachment) =>
  file.exists && (!attachment.size || file.size === attachment.size);

// Tells file cards that one of them is now on the phone (it may have been saved from the menu).
const downloadListeners = new Set<() => void>();
export const onDownloaded = (listener: () => void) => {
  downloadListeners.add(listener);
  return () => void downloadListeners.delete(listener);
};

/** Already downloaded to this phone, so opening it needs no network. */
export const isDownloaded = (attachment: Attachment | null | undefined): boolean => {
  if (!attachment?.id) return false;
  try {
    return isComplete(cachedCopy(attachment), attachment);
  } catch {
    return false;
  }
};

/** The file on this phone, downloaded once. `onProgress` gets 0 to 1. */
export const downloadToCache = async (
  message: ChatMessage,
  onProgress?: (progress: number) => void
): Promise<{ file: File; attachment: Attachment }> => {
  const attachment = await freshAttachment(message);
  if (!attachment?.id || !attachment.downloadUrl) throw new Error('unavailable');

  const target = cachedCopy(attachment);
  if (isComplete(target, attachment)) return { file: target, attachment };
  if (target.exists) target.delete();

  const file = await File.createDownloadTask(attachment.downloadUrl, target, {
    onProgress: ({ bytesWritten, totalBytes }) =>
      onProgress?.(totalBytes ? bytesWritten / totalBytes : 0),
  }).downloadAsync();
  if (!file) throw new Error('download');
  downloadListeners.forEach((listener) => listener());
  return { file, attachment };
};

const FLAG_GRANT_READ_URI_PERMISSION = 1;

/** Shows the file in an app that can open it. Throws 'no-app' when the phone has none. */
export const openFile = async (file: File, name: string): Promise<void> => {
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      type: mimeOf(name),
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  } catch {
    throw new Error('no-app');
  }
};

const COPY_CHUNK = 512 * 1024;

/** Copies in pieces, giving the screen a moment between them, so a big file doesn't freeze it. */
const copyInto = async (source: File, destination: File) => {
  const input = source.open(FileMode.ReadOnly);
  const output = destination.open(FileMode.WriteOnly);
  try {
    for (;;) {
      const bytes = input.readBytes(COPY_CHUNK);
      if (bytes.length === 0) break;
      output.writeBytes(bytes);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    input.close();
    output.close();
  }
};

/**
 * Photos and videos go to the gallery; anything else to a folder the person picks. Resolves to
 * where it went, or null if they backed out. Throws 'permission' if the gallery was refused.
 */
export const saveAttachment = async (
  message: ChatMessage,
  onProgress?: (progress: number) => void
): Promise<'gallery' | 'folder' | null> => {
  const kind = message.attachment?.kind ?? 'image';
  // A photo from before files moved to private storage: a public address.
  if (!message.attachment?.id && message.attachment?.url) {
    await saveImageToGallery(message.attachment.url);
    return 'gallery';
  }
  if (kind === 'image' || kind === 'video') {
    const { status } = await requestPermissionsAsync(true);
    if (status !== 'granted') throw new Error('permission');
    const { file } = await downloadToCache(message, onProgress);
    await addToGallery(file.uri);
    return 'gallery';
  }

  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
  const { file, attachment } = await downloadToCache(message, onProgress);
  const name = attachment.name || file.name;
  await copyInto(file, folder.createFile(name, mimeOf(name)));
  return 'folder';
};

// ── Save to gallery (setting) ───────────────────────────────────────────────

/** Asks for the gallery when a chat's setting is turned on. False if the person said no. */
export const allowGallery = async () => (await requestPermissionsAsync(true)).status === 'granted';

let saving: Promise<void> = Promise.resolve();
const queued = new Set<string>();

/**
 * In a chat with "Save to gallery" on, a photo or video the other person sent is copied to the
 * gallery the first time it shows. Videos wait for Wi-Fi, so mobile data isn't spent on
 * them unasked. One at a time, quietly: the chat keeps working if any of it fails.
 */
export const autoSaveToGallery = (message: ChatMessage) => {
  const attachment = message.attachment;
  const id = attachment?.id;
  if (!id || message.id == null) return;
  if (attachment.kind !== 'image' && attachment.kind !== 'video') return;
  const media = useMediaStore.getState();
  const since = media.galleryChats[message.conversationId];
  if (since == null || Date.parse(message.createdAt) < since) return;
  if (queued.has(id) || media.savedIds.includes(id)) return;
  queued.add(id);

  saving = saving.then(async () => {
    try {
      if ((await getPermissionsAsync(true)).status !== 'granted') return;
      if (attachment.kind === 'video') {
        const network = await getNetworkStateAsync();
        if (network.type !== NetworkStateType.WIFI) return;
      }
      const { file } = await downloadToCache(message);
      await addToGallery(file.uri);
      useMediaStore.getState().markSaved(id);
    } catch {
      // Tried again the next time it shows.
    } finally {
      queued.delete(id);
    }
  });
};
