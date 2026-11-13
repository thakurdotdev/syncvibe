import { requireOptionalNativeModule } from 'expo';

interface ChatNotificationsNative {
  /**
   * Adds a photo to the posted notification `tag` once it shows `text`. `summary` replaces the
   * text while the photo is expanded. Resolves to whether the photo was added.
   */
  showPicture(tag: string, imageUrl: string, text: string, summary: string): Promise<boolean>;
}

/** Null on iOS and on any build made before this module existed. */
export const ChatNotifications =
  requireOptionalNativeModule<ChatNotificationsNative>('ChatNotifications');
