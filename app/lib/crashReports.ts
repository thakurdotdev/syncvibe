import { API_URL } from '@/constants';
import { getAuthHeaders } from '@/lib/auth-client';
import { ExitReasons } from '@/modules/exit-reasons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

/*
 * When the app closes without being asked to, the next launch says why: Android's record of the
 * exit (crash, native crash, ANR, low-memory kill) and any fatal JS error, sent to the server's
 * log. Nothing else is sent, and nothing at all when there's nothing new.
 */

const REPORTED_UNTIL = 'crash-reports:until';
/** The first time, look back this far, so a crash from before this version is still reported. */
const FIRST_LOOK_BACK_MS = 3 * 24 * 60 * 60 * 1000;

/** Ways of ending that say something went wrong. Swiping the app away, updates and the like don't. */
const WORTH_REPORTING = new Set([
  'crash',
  'crash-native',
  'anr',
  'low-memory',
  'signaled',
  'initialization-failure',
  'excessive-resource-usage',
  'dependency-died',
  'exit-self',
  'other',
  'unknown',
]);

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler: () => ErrorHandler;
  setGlobalHandler: (h: ErrorHandler) => void;
};

let installed = false;

/** Keeps a fatal JS error as the app goes down. Call once, as early as possible. */
export const captureFatalJsErrors = () => {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (installed || !ExitReasons || !errorUtils) return;
  installed = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      try {
        const e = error as { message?: unknown; stack?: unknown } | undefined;
        ExitReasons?.rememberJsError(
          JSON.stringify({
            message: String(e?.message ?? error).slice(0, 1000),
            stack: String(e?.stack ?? '').slice(0, 6000),
            at: Date.now(),
          })
        );
      } catch {
        // Never let reporting get in the way of the crash being handled.
      }
    }
    previous(error, isFatal);
  });
};

let sent = false;

/** Sends anything new since last time. Once per launch, signed in. */
export const sendCrashReports = async () => {
  if (sent || !ExitReasons) return;
  sent = true;
  let jsText: string | null = null;
  try {
    const saved = Number(await AsyncStorage.getItem(REPORTED_UNTIL));
    const since = saved > 0 ? saved : Date.now() - FIRST_LOOK_BACK_MS;
    const exits = (await ExitReasons.recent(since)).filter((e) => WORTH_REPORTING.has(e.reason));
    jsText = await ExitReasons.takeJsError();
    const js = jsText
      ? (JSON.parse(jsText) as { message?: string; stack?: string; at?: number })
      : null;

    const reports = [
      ...exits.map((e) => ({
        kind: 'exit',
        reason: e.reason,
        description: [
          e.description,
          `importance ${e.importance}`,
          `pss ${Math.round(e.pssKb / 1024)} MB`,
        ]
          .filter(Boolean)
          .join(' · '),
        at: e.at,
        trace: e.trace ?? undefined,
      })),
      ...(js
        ? [{ kind: 'js', reason: 'js-fatal', message: js.message, trace: js.stack, at: js.at }]
        : []),
    ];
    const until = Math.max(since, ...exits.map((e) => e.at));

    if (reports.length) {
      await axios.post(
        `${API_URL}/api/app/crash-reports`,
        { version: Constants.expoConfig?.version, reports },
        { headers: await getAuthHeaders(), timeout: 15_000 }
      );
    }
    await AsyncStorage.setItem(REPORTED_UNTIL, String(until));
  } catch {
    // Try again next launch, with the JS error put back.
    if (jsText) ExitReasons.rememberJsError(jsText);
    sent = false;
  }
};

/**
 * Something that went wrong without a crash (an update download that stalls or fails), sent now
 * to the same place as crash reports. Best effort: nothing waits on it, and a failure is dropped.
 */
export const reportProblem = (report: { kind: string; reason: string; description?: string }) => {
  void (async () => {
    try {
      await axios.post(
        `${API_URL}/api/app/crash-reports`,
        { version: Constants.expoConfig?.version, reports: [{ ...report, at: Date.now() }] },
        { headers: await getAuthHeaders(), timeout: 15_000 }
      );
    } catch {
      // Diagnostics only.
    }
  })();
};
