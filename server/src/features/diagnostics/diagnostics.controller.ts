import type { Request, Response } from 'express';
import { AppCrashReport } from '@/models';

/** At most this many reports per request, and this much text per field. */
const MAX_REPORTS = 5;
const MAX_TEXT = 6000;

const text = (value: unknown, max = MAX_TEXT) =>
  typeof value === 'string' && value ? value.slice(0, max) : null;

/**
 * How the app last closed when it wasn't asked to: Android's own exit record (a crash, a native
 * crash, an ANR, a low-memory kill) and any fatal JS error, sent on the next launch. Kept in
 * `app_crash_reports` (so a crash nobody can reproduce still leaves its reason behind) and logged
 * as one `[app-crash]` line each.
 */
export const reportCrash = async (req: Request, res: Response): Promise<void> => {
  const list = Array.isArray(req.body?.reports) ? req.body.reports.slice(0, MAX_REPORTS) : [];
  const appVersion = text(req.body?.version, 20);
  const rows = list.map((report: Record<string, unknown>) => ({
    userId: req.user?.userid ?? null,
    appVersion,
    kind: text(report?.kind, 20) ?? 'unknown',
    reason: text(report?.reason, 40),
    description: text(report?.description, 500),
    message: text(report?.message, 1000),
    trace: text(report?.trace),
    happenedAt: typeof report?.at === 'number' ? new Date(report.at) : null,
  }));

  for (const row of rows)
    console.error('[app-crash]', JSON.stringify({ ...row, trace: undefined }));
  try {
    if (rows.length) await AppCrashReport.bulkCreate(rows);
  } catch (error) {
    console.error('Error saving crash reports:', error);
  }
  res.status(204).end();
};
