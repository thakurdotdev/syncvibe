import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

interface VolumeControlNativeModule {
  startVolumeControl(): Promise<boolean>;
  stopVolumeControl(): Promise<boolean>;
  isRunning(): Promise<boolean>;
  consumeUserStop(): Promise<boolean>;
}

const NativeModule: VolumeControlNativeModule | null =
  Platform.OS === 'android' ? NativeModules.VolumeControlModule : null;

export const VolumeControl = {
  start: (): Promise<boolean> => NativeModule?.startVolumeControl() ?? Promise.resolve(false),

  stop: (): Promise<boolean> => NativeModule?.stopVolumeControl() ?? Promise.resolve(false),

  isRunning: (): Promise<boolean> => NativeModule?.isRunning() ?? Promise.resolve(false),

  wasStoppedByUser: (): Promise<boolean> =>
    NativeModule?.consumeUserStop() ?? Promise.resolve(false),

  onStateChanged: (listener: (running: boolean) => void) => {
    if (!NativeModule) return { remove: () => undefined };

    return DeviceEventEmitter.addListener('VolumeControlStateChanged', listener);
  },

  isAvailable: Platform.OS === 'android' && NativeModule != null,
} as const;
