import { AppUpdater, type VerifyResult } from '@/modules/app-updater';
import { api } from '@/utils/hooks/useApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Linking, Platform } from 'react-native';
import { create } from 'zustand';

export interface AppUpdate {
  id: number;
  version: string;
  releaseNotes: string | null;
  downloadUrl: string | null;
  critical: boolean;
  createdAt: string;
  sha256?: string | null;
  /** Older servers send this as a string. */
  fileSize?: number | string | null;
}

export type UpdatePhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'permission' | 'error';

interface AppUpdateState {
  latest: AppUpdate | null;
  isUpdateAvailable: boolean;
  phase: UpdatePhase;
  bytesDownloaded: number;
  totalBytes: number;
  /** The download is paused until the device has a usable connection. */
  waitingForNetwork: boolean;
  errorMessage: string | null;
  sheetVisible: boolean;
}

interface SavedDownload {
  id: number;
  version: string;
}

const SAVED_DOWNLOAD_KEY = 'app-update-download';
const LAST_PROMPTED_KEY = 'last-notified-update-version';
const CHECK_DELAY_MS = 3000;
const POLL_INTERVAL_MS = 1000;

const DAMAGED_MESSAGE = 'The download was damaged. Please try again.';
const VERIFY_MESSAGES: Record<Exclude<VerifyResult, 'ok'>, string> = {
  missing: DAMAGED_MESSAGE,
  size: DAMAGED_MESSAGE,
  checksum: DAMAGED_MESSAGE,
  corrupt: DAMAGED_MESSAGE,
  'wrong-package': 'This update is for a different build of SyncVibe.',
  'wrong-signature':
    "This update can't replace the SyncVibe you have installed. Reinstall the app from the download page.",
  downgrade: 'You already have a newer build of SyncVibe.',
};

export const CURRENT_APP_VERSION = Constants.expoConfig?.version || '1.0.0';

export const useAppUpdateStore = create<AppUpdateState>(() => ({
  latest: null,
  isUpdateAvailable: false,
  phase: 'idle',
  bytesDownloaded: 0,
  totalBytes: 0,
  waitingForNetwork: false,
  errorMessage: null,
  sheetVisible: false,
}));

const { getState, setState } = useAppUpdateStore;

// The download in progress. Also how a slow async step notices it was cancelled while it waited.
let saved: SavedDownload | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;

const isNewerVersion = (current: string, latest: string): boolean => {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (lat > curr) return true;
    if (curr > lat) return false;
  }
  return false;
};

const fileSizeOf = (update: AppUpdate | null): number => Number(update?.fileSize) || 0;

const downloadFailureMessage = (reason: number): string => {
  if (reason === 1006) return 'Not enough free space. Free up some storage and try again.';
  if (reason === 1001 || reason === 1007) return "Your device's storage isn't available right now.";
  if (reason >= 400 && reason < 600)
    return "The update isn't available right now. Try again later.";
  return 'The connection dropped before the download finished. Please try again.';
};

const fail = (errorMessage: string) => {
  setState({ phase: 'error', errorMessage, waitingForNetwork: false, sheetVisible: true });
};

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
};

/** Forgets the download and frees its file. */
const discardDownload = async () => {
  stopPolling();
  const previous = saved;
  saved = null;
  await AsyncStorage.removeItem(SAVED_DOWNLOAD_KEY).catch(() => {});
  if (!AppUpdater) return;
  if (previous) await AppUpdater.removeDownload(previous.id).catch(() => {});
  await AppUpdater.cleanup().catch(() => {});
};

const verifyDownload = async (download: SavedDownload) => {
  if (!AppUpdater) return;
  setState({ phase: 'verifying', waitingForNetwork: false, errorMessage: null });
  const { latest } = getState();
  const size = fileSizeOf(latest);

  let result: VerifyResult;
  try {
    result = await AppUpdater.verify(download.version, latest?.sha256 ?? null, size || null);
  } catch {
    result = 'missing';
  }
  if (saved?.id !== download.id) return;

  if (result !== 'ok') {
    await discardDownload();
    fail(VERIFY_MESSAGES[result]);
    return;
  }

  setState({ phase: 'ready' });
  // Someone watching the sheet goes straight to the installer. Otherwise it waits to be asked,
  // because a system dialog shouldn't appear out of nowhere in the middle of listening.
  if (getState().sheetVisible && AppState.currentState === 'active') await installUpdate();
  else setState({ sheetVisible: true });
};

const pollDownload = async () => {
  const download = saved;
  if (!AppUpdater || !download) {
    stopPolling();
    return;
  }
  if (polling) return;

  polling = true;
  try {
    const info = await AppUpdater.getDownload(download.id);
    if (saved?.id !== download.id) return;

    if (!info) {
      // Removed outside the app, for example from the system's Downloads screen.
      await discardDownload();
      setState({ phase: 'idle', bytesDownloaded: 0, waitingForNetwork: false });
    } else if (info.status === 'successful') {
      stopPolling();
      await verifyDownload(download);
    } else if (info.status === 'failed') {
      await discardDownload();
      fail(downloadFailureMessage(info.reason));
    } else {
      setState({
        phase: 'downloading',
        bytesDownloaded: info.bytesDownloaded,
        totalBytes: info.totalBytes > 0 ? info.totalBytes : fileSizeOf(getState().latest),
        waitingForNetwork: info.status === 'paused',
      });
    }
  } catch (err) {
    console.error('Failed to read update download state:', err);
  } finally {
    polling = false;
  }
};

const startPolling = () => {
  if (pollTimer || AppState.currentState !== 'active') return;
  pollTimer = setInterval(pollDownload, POLL_INTERVAL_MS);
  void pollDownload();
};

export const openUpdateInBrowser = async () => {
  const url = getState().latest?.downloadUrl;
  if (url) await Linking.openURL(url).catch(() => {});
};

export const startUpdate = async () => {
  const { latest, phase } = getState();
  if (phase === 'downloading' || phase === 'verifying' || !latest?.downloadUrl) return;
  // A build without the native module can still get the update through the browser.
  if (!AppUpdater) {
    await openUpdateInBrowser();
    return;
  }

  setState({
    phase: 'downloading',
    bytesDownloaded: 0,
    totalBytes: fileSizeOf(latest),
    waitingForNetwork: false,
    errorMessage: null,
  });
  try {
    await discardDownload();
    const id = await AppUpdater.startDownload(
      latest.downloadUrl,
      latest.version,
      `SyncVibe ${latest.version}`
    );
    // Cancelled while the system was still queueing it.
    if (getState().phase !== 'downloading') {
      await AppUpdater.removeDownload(id);
      return;
    }
    saved = { id, version: latest.version };
    await AsyncStorage.setItem(SAVED_DOWNLOAD_KEY, JSON.stringify(saved));
    startPolling();
  } catch (err) {
    console.error('Failed to start update download:', err);
    fail("Couldn't start the download. Please try again.");
  }
};

export const cancelUpdate = async () => {
  await discardDownload();
  setState({ phase: 'idle', bytesDownloaded: 0, waitingForNetwork: false, errorMessage: null });
};

export const installUpdate = async () => {
  if (!AppUpdater || !saved) return;
  try {
    if (!(await AppUpdater.canInstall())) {
      setState({ phase: 'permission', sheetVisible: true });
      return;
    }
    setState({ phase: 'ready' });
    await AppUpdater.install(saved.version);
  } catch (err) {
    console.error('Failed to open the system installer:', err);
    await discardDownload();
    fail("Couldn't open Android's installer. Please try again.");
  }
};

export const openInstallPermissionSettings = async () => {
  await AppUpdater?.openInstallSettings().catch(() => {});
};

export const showUpdateSheet = () => setState({ sheetVisible: true });

export const hideUpdateSheet = () => {
  const { latest, isUpdateAvailable } = getState();
  if (latest?.critical && isUpdateAvailable) return;
  setState({ sheetVisible: false });
};

const checkForUpdate = async () => {
  try {
    const stored = await AsyncStorage.getItem(SAVED_DOWNLOAD_KEY);
    saved = stored ? (JSON.parse(stored) as SavedDownload) : null;

    const { data } = await api.get('/api/app-update/latest');
    const latest: AppUpdate | null = data?.latest ?? null;
    const available = !!latest && isNewerVersion(CURRENT_APP_VERSION, latest.version);
    setState({ latest, isUpdateAvailable: available });

    // Nothing to resume: this also drops an APK left behind by the install that just happened.
    if (!available || saved?.version !== latest.version) await discardDownload();
    if (!available) return;

    const lastPrompted = await AsyncStorage.getItem(LAST_PROMPTED_KEY);
    if (latest.critical || lastPrompted !== latest.version) {
      setState({ sheetVisible: true });
      await AsyncStorage.setItem(LAST_PROMPTED_KEY, latest.version);
    }

    if (saved) {
      setState({ phase: 'downloading', totalBytes: fileSizeOf(latest) });
      startPolling();
    }
  } catch (err) {
    console.error('Failed to check for updates:', err);
  }
};

const onAppStateChange = (state: string) => {
  if (state !== 'active') {
    stopPolling();
    return;
  }
  const { phase } = getState();
  if (phase === 'downloading') startPolling();
  // Back from Android's settings, where the user may have just allowed installs.
  else if (phase === 'permission') void installUpdate();
};

/** Starts the update check and returns how to stop it. Android only: iOS can't install an APK. */
export const initAppUpdates = (): (() => void) => {
  if (Platform.OS !== 'android') return () => {};
  const timer = setTimeout(checkForUpdate, CHECK_DELAY_MS);
  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => {
    clearTimeout(timer);
    subscription.remove();
    stopPolling();
  };
};

/** Release notes as lines to show: commit messages carry merge titles and trailers nobody needs. */
export const parseReleaseNotes = (notes: string | null | undefined): string[] =>
  (notes || '')
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•\s]+/, '')
        .replace(/\*\*/g, '')
    )
    .filter((line) => line && !/^(merge pull request|co-authored-by:|🤖)/i.test(line));
