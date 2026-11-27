import { requireOptionalNativeModule } from 'expo';

export interface ExitRecord {
  reason: string;
  description: string | null;
  at: number;
  importance: number;
  pssKb: number;
  rssKb: number;
  /** An ANR's thread dump; null otherwise. */
  trace: string | null;
}

interface ExitReasonsNative {
  /** Android's records of how the process ended, newest first, after `since` (ms). */
  recent(since: number): Promise<ExitRecord[]>;
  /** Kept synchronously, so it survives the crash it describes. */
  rememberJsError(json: string): void;
  /** The kept JS error, once: it's cleared as it's read. */
  takeJsError(): Promise<string | null>;
}

/** Null where the module isn't built in (web, iOS, an older dev build). */
export const ExitReasons = requireOptionalNativeModule<ExitReasonsNative>('ExitReasons');
