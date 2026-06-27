import type { BackgroundEvent } from '@rntp/player';
import { dispatchTrackPlayerEvent } from '@/stores/trackPlayerBridge';

export async function handleBackgroundPlaybackEvent(event: BackgroundEvent) {
  await dispatchTrackPlayerEvent(event);
}
