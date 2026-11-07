import { requireOptionalNativeModule } from 'expo';

export type DownloadStatus = 'pending' | 'running' | 'paused' | 'successful' | 'failed';

export interface DownloadInfo {
  status: DownloadStatus;
  bytesDownloaded: number;
  /** -1 until the server has answered. */
  totalBytes: number;
  /** DownloadManager's COLUMN_REASON: why it is paused or failed. */
  reason: number;
}

export type VerifyResult =
  | 'ok'
  | 'missing'
  | 'size'
  | 'checksum'
  | 'corrupt'
  | 'wrong-package'
  | 'wrong-signature'
  | 'downgrade';

interface AppUpdaterNative {
  startDownload(url: string, version: string, title: string): Promise<number>;
  /** Null when the system no longer knows the download, e.g. it was removed from Downloads. */
  getDownload(id: number): Promise<DownloadInfo | null>;
  removeDownload(id: number): Promise<void>;
  verify(version: string, sha256: string | null, size: number | null): Promise<VerifyResult>;
  canInstall(): Promise<boolean>;
  openInstallSettings(): Promise<void>;
  install(version: string): Promise<void>;
  cleanup(): Promise<void>;
}

/** Null on iOS and on any build made before this module existed. */
export const AppUpdater = requireOptionalNativeModule<AppUpdaterNative>('AppUpdater');
